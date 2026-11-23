import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { MatchRequestDocument } from "../collections/match-requests.js";
import {
  MARK_EMAIL,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../constants/email-addresses.js";
import { ERROR_IDS } from "../constants/error-ids.js";
import {
  EmailAuthError,
  EmailNetworkError,
} from "../shared-api/services/email/errors.js";
import type { EmailMessage } from "../shared-api/services/email/index.js";
import type { Logger } from "../shared-api/types/logger.js";
import type { MemberDocument } from "../types/member-document.js";
import { handleReferralNotification } from "./handler.js";

/**
 * Tests for the Referral Notification trigger handler.
 * The handler is called directly with mocked services (no emulators).
 */

const MATCH_REQUEST_ID = "match-request-123";
const EVENT_TIME = "2026-11-23T12:00:00.000Z";

const BASE_MATCH_REQUEST: MatchRequestDocument = {
  name: "Priya Requester",
  phone: "585-555-0199",
  email: "priya@example.com",
  zipcode: "14620",
  estimatedDueDate: { month: "3", day: "14", year: "2027" },
  services: ["Birth Doula", "Postpartum Doula"],
  birthLocation: "Highland Hospital",
  otherInfo: "Secret notes about my pregnancy",
  insurance: ["Excellus BCBS"],
  submitted: Timestamp.fromDate(new Date(EVENT_TIME)),
  sent: true,
  locale: "en",
};

function member(overrides: Partial<MemberDocument> = {}): MemberDocument {
  return {
    uid: overrides.uid ?? overrides.email ?? "uid",
    email: "member@example.com",
    createdAt: Timestamp.fromDate(new Date("2024-01-01")),
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    subscriptionStatus: "active",
    subscriptionStart: Timestamp.fromDate(new Date("2025-01-01")),
    membershipExpiresAt: Timestamp.fromDate(new Date("2027-01-01")),
    membershipActive: true,
    ...overrides,
  };
}

interface SetupOptions {
  v2Enabled?: boolean;
  matchRequest?: Partial<MatchRequestDocument>;
  isMatchRequestMissing?: boolean;
  members?: MemberDocument[];
  sendEmailErrors?: Error[];
  markerError?: Error;
  minutesSinceEvent?: number;
}

function setup({
  v2Enabled = true,
  matchRequest = {},
  isMatchRequestMissing = false,
  members = [
    member({ uid: "a", email: "alice@example.com" }),
    member({ uid: "b", email: "bea@example.com" }),
  ],
  sendEmailErrors = [],
  markerError,
  minutesSinceEvent = 1,
}: SetupOptions = {}) {
  const sentMessages: EmailMessage[] = [];
  const remainingErrors = [...sendEmailErrors];
  const sendEmail = mock(
    ({ message }: { message: EmailMessage }): Promise<void> => {
      sentMessages.push(message);
      const error = remainingErrors.shift();
      return error === undefined ? Promise.resolve() : Promise.reject(error);
    },
  );
  const markMemberNotificationSent = mock((): Promise<void> =>
    markerError ? Promise.reject(markerError) : Promise.resolve(),
  );
  const logger = {
    error: mock(),
    warn: mock(),
    info: mock(),
  } satisfies Logger;

  const storedMatchRequest = isMatchRequestMissing
    ? undefined
    : { ...BASE_MATCH_REQUEST, ...matchRequest };

  const run = () =>
    handleReferralNotification({
      matchRequestId: MATCH_REQUEST_ID,
      eventTime: EVENT_TIME,
      now: () =>
        new Date(Date.parse(EVENT_TIME) + minutesSinceEvent * 60 * 1000),
      services: {
        emailService: { sendEmail },
        referralPortalSettingsService: {
          getReferralPortalSettings: () => Promise.resolve({ v2Enabled }),
        },
        referralNotificationStore: {
          getMatchRequest: () => Promise.resolve(storedMatchRequest),
          listMembersWithLiveSubscription: () => Promise.resolve(members),
          markMemberNotificationSent,
        },
        logger,
      },
    });

  return { run, sentMessages, sendEmail, markMemberNotificationSent, logger };
}

function messageAt(sentMessages: EmailMessage[], index: number): EmailMessage {
  const message = sentMessages[index];
  if (message === undefined) {
    throw new Error(`No email sent at index ${String(index)}`);
  }
  return message;
}

function onlyMessage(sentMessages: EmailMessage[]): EmailMessage {
  expect(sentMessages).toHaveLength(1);
  return messageAt(sentMessages, 0);
}

describe("handleReferralNotification", () => {
  describe("Referral Portal v2 switch", () => {
    it("sends nothing and sets no marker while the switch is off", async () => {
      const { run, sendEmail, markMemberNotificationSent } = setup({
        v2Enabled: false,
      });

      await run();

      expect(sendEmail).not.toHaveBeenCalled();
      expect(markMemberNotificationSent).not.toHaveBeenCalled();
    });
  });

  describe("recipients", () => {
    it("sends one batch to active Stripe Members, each seeing only their own To", async () => {
      const { run, sentMessages } = setup();

      await run();

      const message = onlyMessage(sentMessages);
      expect(message.to).toEqual(["alice@example.com", "bea@example.com"]);
      const variables = JSON.parse(
        String(message["recipient-variables"]),
      ) as Record<string, unknown>;
      expect(Object.keys(variables)).toEqual(message.to as string[]);
    });

    it("excludes Members who turned Referral Notifications off", async () => {
      const { run, sentMessages } = setup({
        members: [
          member({ uid: "a", email: "alice@example.com" }),
          member({
            uid: "b",
            email: "optout@example.com",
            referralNotificationsEnabled: false,
          }),
          member({
            uid: "c",
            email: "opted-in@example.com",
            referralNotificationsEnabled: true,
          }),
        ],
      });

      await run();

      expect(onlyMessage(sentMessages).to).toEqual([
        "alice@example.com",
        "opted-in@example.com",
      ]);
    });

    it("excludes Members without a complete active Stripe membership", async () => {
      const { run, sentMessages } = setup({
        members: [
          member({ uid: "a", email: "alice@example.com" }),
          member({
            uid: "b",
            email: "no-stripe@example.com",
            stripeCustomerId: "",
          }),
          member({
            uid: "c",
            email: "lapsed@example.com",
            subscriptionStatus: "past_due",
          }),
          member({
            uid: "d",
            email: "trial@example.com",
            subscriptionStatus: "trialing",
          }),
        ],
      });

      await run();

      expect(onlyMessage(sentMessages).to).toEqual([
        "alice@example.com",
        "trial@example.com",
      ]);
    });

    it("drops duplicate and blank emails", async () => {
      const { run, sentMessages } = setup({
        members: [
          member({ uid: "a", email: "alice@example.com" }),
          member({ uid: "b", email: " alice@example.com " }),
          member({ uid: "c", email: "" }),
        ],
      });

      await run();

      expect(onlyMessage(sentMessages).to).toEqual(["alice@example.com"]);
    });

    it("sets the marker and sends nothing when there are zero recipients", async () => {
      const { run, sendEmail, markMemberNotificationSent } = setup({
        members: [],
      });

      await run();

      expect(sendEmail).not.toHaveBeenCalled();
      expect(markMemberNotificationSent).toHaveBeenCalledWith(MATCH_REQUEST_ID);
    });

    it("splits more than 1,000 recipients into Mailgun-sized batches", async () => {
      const members = Array.from({ length: 1001 }, (_, index) =>
        member({ uid: `m${index}`, email: `m${index}@example.com` }),
      );
      const { run, sentMessages, markMemberNotificationSent } = setup({
        members,
      });

      await run();

      expect(sentMessages).toHaveLength(2);
      expect((sentMessages[0]?.to as string[]).length).toBe(1000);
      expect(sentMessages[1]?.to).toEqual(["m1000@example.com"]);
      expect(markMemberNotificationSent).toHaveBeenCalledTimes(1);
    });
  });

  describe("content", () => {
    it("uses the §6 subject, sender and Reply-To", async () => {
      const { run, sentMessages } = setup();

      await run();

      const message = onlyMessage(sentMessages);
      expect(message.subject).toBe(
        "New referral: due Mar 2027 · Rochester, NY",
      );
      expect(message.from).toBe(`Doula Cooperative <${NO_REPLY_EMAIL}>`);
      expect(message["h:Reply-To"]).toBe(REFERRAL_EMAIL);
    });

    it("carries due month, services, area, referral link and opt-out footer", async () => {
      const { run, sentMessages } = setup();

      await run();

      const html = String(onlyMessage(sentMessages).html);
      expect(html).toContain("Mar 2027");
      expect(html).toContain("Birth Doula, Postpartum Doula");
      expect(html).toContain("Rochester, NY");
      expect(html).toContain(
        `https://members.doulacooperative.com/referrals/${MATCH_REQUEST_ID}`,
      );
      expect(html).toContain(
        "You're getting this because you're a Doula Cooperative member.",
      );
      expect(html).toContain("https://members.doulacooperative.com/membership");
      expect(html).toContain("Manage referral emails");
      expect(html).not.toContain("Requester prefers Spanish");
    });

    it("flags Spanish in subject and body when the requester's locale is es", async () => {
      const { run, sentMessages } = setup({ matchRequest: { locale: "es" } });

      await run();

      const message = onlyMessage(sentMessages);
      expect(message.subject).toBe(
        "New referral: due Mar 2027 · Rochester, NY · Spanish",
      );
      expect(message.html).toContain("Requester prefers Spanish");
    });

    it("never includes name, contact details, notes, birth location, insurance or day", async () => {
      const { run, sentMessages } = setup();

      await run();

      const message = onlyMessage(sentMessages);
      const content = `${String(message.subject)}\n${String(message.html)}`;
      for (const secret of [
        "Priya",
        "Requester",
        "priya@example.com",
        "585-555-0199",
        "Secret notes",
        "Highland Hospital",
        "Excellus",
        "14 ",
        "14620",
      ]) {
        expect(content).not.toContain(secret);
      }
    });

    it("HTML-escapes requester-supplied values", async () => {
      const { run, sentMessages } = setup({
        matchRequest: { services: ["<script>alert(1)</script>"] },
      });

      await run();

      const html = String(onlyMessage(sentMessages).html);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("idempotency", () => {
    it("sets memberNotificationSentAt after Mailgun accepts", async () => {
      const { run, sendEmail, markMemberNotificationSent } = setup();

      await run();

      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(markMemberNotificationSent).toHaveBeenCalledWith(MATCH_REQUEST_ID);
    });

    it("does not resend on a retry after the marker was set", async () => {
      const { run, sendEmail, markMemberNotificationSent } = setup({
        matchRequest: {
          memberNotificationSentAt: Timestamp.fromDate(new Date(EVENT_TIME)),
        },
      });

      await run();

      expect(sendEmail).not.toHaveBeenCalled();
      expect(markMemberNotificationSent).not.toHaveBeenCalled();
    });

    it("skips a Match Request that no longer exists", async () => {
      const { run, sendEmail } = setup({ isMatchRequestMissing: true });

      await run();

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("logs CRITICAL and does not throw when the marker write fails after sending", async () => {
      const { run, sendEmail, logger } = setup({
        markerError: new Error("Firestore unavailable"),
      });

      await run();

      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("CRITICAL"),
        expect.objectContaining({
          errorId: ERROR_IDS.REFERRAL_NOTIFICATION_MARKER_WRITE_FAILED,
          severity: "CRITICAL",
        }),
      );
    });
  });

  describe("failure", () => {
    it("throws so the trigger retries when Mailgun fails early on", async () => {
      const { run, markMemberNotificationSent, sentMessages } = setup({
        sendEmailErrors: [new EmailNetworkError("timeout")],
      });

      let caught: unknown;
      try {
        await run();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EmailNetworkError);

      expect(markMemberNotificationSent).not.toHaveBeenCalled();
      expect(sentMessages).toHaveLength(1);
    });

    it("sends an admin alert and stops retrying once the event is over an hour old", async () => {
      const { run, sentMessages, markMemberNotificationSent } = setup({
        sendEmailErrors: [new EmailNetworkError("timeout")],
        minutesSinceEvent: 61,
      });

      await run();

      expect(markMemberNotificationSent).not.toHaveBeenCalled();
      expect(sentMessages).toHaveLength(2);
      const alert = messageAt(sentMessages, 1);
      expect(alert.to).toEqual([MARK_EMAIL, REFERRAL_EMAIL]);
      expect(alert.subject).toContain(MATCH_REQUEST_ID);
      expect(alert.html).toContain(
        `https://admin.doulacooperative.com/match-requests/${MATCH_REQUEST_ID}`,
      );
    });

    it("sends the admin alert immediately when Mailgun rejects permanently", async () => {
      const { run, sentMessages } = setup({
        sendEmailErrors: [new EmailAuthError("bad key")],
      });

      await run();

      expect(sentMessages).toHaveLength(2);
      expect(sentMessages[1]?.to).toEqual([MARK_EMAIL, REFERRAL_EMAIL]);
    });

    it("alerts when a non-email step keeps failing past the hour", async () => {
      const { run, sentMessages } = setup({
        minutesSinceEvent: 90,
        members: [],
        markerError: new Error("Firestore unavailable"),
      });

      await run();

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]?.to).toEqual([MARK_EMAIL, REFERRAL_EMAIL]);
    });

    it("logs CRITICAL when the admin alert also fails", async () => {
      const { run, logger } = setup({
        sendEmailErrors: [
          new EmailNetworkError("timeout"),
          new EmailNetworkError("still down"),
        ],
        minutesSinceEvent: 61,
      });

      await run();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("CRITICAL"),
        expect.objectContaining({
          errorId: ERROR_IDS.REFERRAL_NOTIFICATION_ALERT_FAILED,
          severity: "CRITICAL",
          matchRequestId: MATCH_REQUEST_ID,
        }),
      );
    });
  });
});
