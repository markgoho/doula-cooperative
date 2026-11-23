import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { MatchRequestDocument } from "../collections/match-requests.js";
import type { MemberResponseDocument } from "../collections/member-responses.js";
import {
  MARK_EMAIL,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../constants/email-addresses.js";
import { ERROR_IDS } from "../constants/error-ids.js";
import { EmailNetworkError } from "../shared-api/services/email/errors.js";
import type { EmailMessage } from "../shared-api/services/email/index.js";
import type { Logger } from "../shared-api/types/logger.js";
import { handleNoOutreachAlertSweep } from "./handler.js";
import type {
  NoOutreachAlertStore,
  NotifiedMatchRequest,
  ReferralResponses,
} from "./types/services.js";

/**
 * Tests for the No-Outreach Alert sweep handler.
 * The handler is called directly with mocked services (no emulators).
 */

const NOW = new Date("2026-11-23T14:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Timestamp {
  return Timestamp.fromDate(new Date(NOW.getTime() - days * DAY_MS));
}

function matchRequest(
  overrides: Partial<MatchRequestDocument> = {},
): MatchRequestDocument {
  return {
    name: "Priya Requester",
    phone: "585-555-0199",
    email: "priya@example.com",
    zipcode: "14620",
    estimatedDueDate: { month: "3", day: "14", year: "2027" },
    services: ["Birth Doula", "Postpartum Doula"],
    birthLocation: "Highland Hospital",
    otherInfo: "Secret notes about my pregnancy",
    insurance: ["Excellus BCBS"],
    submitted: daysAgo(5),
    sent: false,
    locale: "en",
    memberNotificationSentAt: daysAgo(4),
    ...overrides,
  };
}

function memberResponse(
  overrides: Partial<MemberResponseDocument> = {},
): MemberResponseDocument {
  return { memberUid: "member-1", ...overrides };
}

const NO_RESPONSES: ReferralResponses = {
  memberResponses: [],
  legacyResponseCount: 0,
};

interface SetupOptions {
  v2Enabled?: boolean;
  candidates?: NotifiedMatchRequest[];
  responsesById?: Record<string, ReferralResponses>;
  responsesError?: Error;
  listError?: Error;
  sendEmailErrors?: (Error | undefined)[];
  markerError?: Error;
}

function setup({
  v2Enabled = true,
  candidates = [{ id: "mr-1", matchRequest: matchRequest() }],
  responsesById = {},
  responsesError,
  listError,
  sendEmailErrors = [],
  markerError,
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
  const listMatchRequestsNotifiedBetween = mock<
    NoOutreachAlertStore["listMatchRequestsNotifiedBetween"]
  >(() =>
    listError ? Promise.reject(listError) : Promise.resolve(candidates),
  );
  const markNoOutreachAlertSent = mock<
    NoOutreachAlertStore["markNoOutreachAlertSent"]
  >(() => (markerError ? Promise.reject(markerError) : Promise.resolve()));
  const logger = {
    error: mock(),
    warn: mock(),
    info: mock(),
  } satisfies Logger;

  const run = () =>
    handleNoOutreachAlertSweep({
      now: () => NOW,
      services: {
        emailService: { sendEmail },
        referralPortalSettingsService: {
          getReferralPortalSettings: () => Promise.resolve({ v2Enabled }),
        },
        noOutreachAlertStore: {
          listMatchRequestsNotifiedBetween,
          listReferralResponses: (id: string) =>
            responsesError
              ? Promise.reject(responsesError)
              : Promise.resolve(responsesById[id] ?? NO_RESPONSES),
          markNoOutreachAlertSent,
        },
        logger,
      },
    });

  const alerts = () =>
    sentMessages.filter(message => message.subject?.startsWith("No Outreach"));
  const failureAlerts = () =>
    sentMessages.filter(message => message.subject?.includes("sweep had"));
  const onlyMessage = (messages: EmailMessage[]): EmailMessage => {
    expect(messages).toHaveLength(1);
    const [message] = messages;
    if (message === undefined) {
      throw new Error("Expected one message");
    }
    return message;
  };
  const markedIds = () => markNoOutreachAlertSent.mock.calls.map(([id]) => id);
  const errorIds = () =>
    logger.error.mock.calls.map(
      call => (call[1] as { errorId?: string } | undefined)?.errorId,
    );

  return {
    run,
    alerts,
    failureAlerts,
    onlyMessage,
    markedIds,
    errorIds,
    sendEmail,
    listMatchRequestsNotifiedBetween,
    logger,
  };
}

describe("No-Outreach Alert sweep", () => {
  describe("gate", () => {
    it("sends nothing and lists nothing while Referral Portal v2 is off", async () => {
      const { run, sendEmail, listMatchRequestsNotifiedBetween, markedIds } =
        setup({ v2Enabled: false });

      await run();

      expect(sendEmail).not.toHaveBeenCalled();
      expect(listMatchRequestsNotifiedBetween).not.toHaveBeenCalled();
      expect(markedIds()).toEqual([]);
    });
  });

  describe("selection", () => {
    it("scans Referral Notifications sent between 30 and 3 days ago", async () => {
      const { run, listMatchRequestsNotifiedBetween } = setup();

      await run();

      expect(listMatchRequestsNotifiedBetween).toHaveBeenCalledWith({
        from: new Date(NOW.getTime() - 30 * DAY_MS),
        to: new Date(NOW.getTime() - 3 * DAY_MS),
      });
    });

    it("alerts an unanswered Referral and sets the marker", async () => {
      const { run, alerts, markedIds } = setup();

      await run();

      expect(alerts()).toHaveLength(1);
      expect(markedIds()).toEqual(["mr-1"]);
    });

    it("skips a Referral already alerted", async () => {
      const { run, sendEmail, markedIds } = setup({
        candidates: [
          {
            id: "mr-1",
            matchRequest: matchRequest({ noOutreachAlertSentAt: daysAgo(1) }),
          },
        ],
      });

      await run();

      expect(sendEmail).not.toHaveBeenCalled();
      expect(markedIds()).toEqual([]);
    });

    it("never alerts a Match Request without a Referral Notification", async () => {
      const neverNotified = matchRequest();
      delete neverNotified.memberNotificationSentAt;
      const { run, sendEmail } = setup({
        candidates: [{ id: "mr-1", matchRequest: neverNotified }],
      });

      await run();

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("still alerts a Match Request an Admin marked processed", async () => {
      const { run, alerts } = setup({
        candidates: [
          { id: "mr-1", matchRequest: matchRequest({ sent: true }) },
        ],
      });

      await run();

      expect(alerts()).toHaveLength(1);
    });
  });

  describe("answered Referrals", () => {
    it("skips a Referral with Outreach from a Member", async () => {
      const { run, sendEmail, markedIds } = setup({
        responsesById: {
          "mr-1": {
            memberResponses: [memberResponse({ outreachSentAt: daysAgo(2) })],
            legacyResponseCount: 0,
          },
        },
      });

      await run();

      expect(sendEmail).not.toHaveBeenCalled();
      expect(markedIds()).toEqual([]);
    });

    it("skips a Referral with a Member's Offline Response", async () => {
      const { run, sendEmail } = setup({
        responsesById: {
          "mr-1": {
            memberResponses: [
              memberResponse({
                offlineResponse: {
                  recordedBy: "coordinator-1",
                  recordedAt: daysAgo(1),
                },
              }),
            ],
            legacyResponseCount: 0,
          },
        },
      });

      await run();

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("skips a Referral with a Legacy Membership's Offline Response", async () => {
      const { run, sendEmail } = setup({
        responsesById: {
          "mr-1": { memberResponses: [], legacyResponseCount: 1 },
        },
      });

      await run();

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("alerts when the only response is an Outreach still pending", async () => {
      const { run, alerts } = setup({
        responsesById: {
          "mr-1": {
            memberResponses: [
              memberResponse({ outreachPendingAt: daysAgo(1) }),
            ],
            legacyResponseCount: 0,
          },
        },
      });

      await run();

      expect(alerts()).toHaveLength(1);
    });

    it("alerts when a Member's response holds neither Outreach nor an Offline Response", async () => {
      const { run, alerts } = setup({
        responsesById: {
          "mr-1": {
            memberResponses: [memberResponse()],
            legacyResponseCount: 0,
          },
        },
      });

      await run();

      expect(alerts()).toHaveLength(1);
    });
  });

  describe("content", () => {
    it("sends to both admins from no-reply with no Reply-To", async () => {
      const { run, alerts, onlyMessage } = setup();

      await run();

      const alert = onlyMessage(alerts());
      expect(alert.to).toEqual([MARK_EMAIL, REFERRAL_EMAIL]);
      expect(alert.from).toBe(`Doula Cooperative <${NO_REPLY_EMAIL}>`);
      expect(alert["h:Reply-To"]).toBeUndefined();
    });

    it("carries due month, area, services, days elapsed, the Facebook note and the admin link", async () => {
      const { run, alerts, onlyMessage } = setup();

      await run();

      const alert = onlyMessage(alerts());
      expect(alert.subject).toBe(
        "No Outreach yet: due Mar 2027 · Rochester, NY",
      );
      expect(alert.html).toContain("Mar 2027");
      expect(alert.html).toContain("Rochester, NY");
      expect(alert.html).toContain("Birth Doula, Postpartum Doula");
      expect(alert.html).toContain("4 days ago");
      expect(alert.html).toContain(
        "The requester may have been contacted via Facebook.",
      );
      expect(alert.html).toContain(
        "https://admin.doulacooperative.com/match-requests/mr-1",
      );
    });

    it("flags a Spanish-preferring requester in subject and body", async () => {
      const { run, alerts, onlyMessage } = setup({
        candidates: [
          { id: "mr-1", matchRequest: matchRequest({ locale: "es" }) },
        ],
      });

      await run();

      const alert = onlyMessage(alerts());
      expect(alert.subject).toEndWith(" · Spanish");
      expect(alert.html).toContain("Requester prefers Spanish");
    });

    it("never includes name, contact details, notes, birth location, insurance or due day", async () => {
      const { run, alerts, onlyMessage } = setup();

      await run();

      const alert = onlyMessage(alerts());
      const content = `${alert.subject}\n${alert.html ?? ""}`;
      for (const secret of [
        "Priya",
        "585-555-0199",
        "priya@example.com",
        "Secret notes",
        "Highland Hospital",
        "Excellus",
        "14620",
        "Mar 14",
        "3/14",
      ]) {
        expect(content).not.toContain(secret);
      }
    });

    it("escapes HTML in Match Request values", async () => {
      const { run, alerts, onlyMessage } = setup({
        candidates: [
          {
            id: "mr-1",
            matchRequest: matchRequest({ services: ["<script>x</script>"] }),
          },
        ],
      });

      await run();

      const alert = onlyMessage(alerts());
      expect(alert.html).not.toContain("<script>");
      expect(alert.html).toContain("&lt;script&gt;");
    });
  });

  describe("failures", () => {
    it("keeps sweeping after a Mailgun failure and leaves that Referral unmarked", async () => {
      const { run, alerts, markedIds, errorIds } = setup({
        candidates: [
          { id: "mr-1", matchRequest: matchRequest() },
          { id: "mr-2", matchRequest: matchRequest() },
        ],
        sendEmailErrors: [new EmailNetworkError("Mailgun down")],
      });

      await run();

      expect(alerts()).toHaveLength(2);
      expect(markedIds()).toEqual(["mr-2"]);
      expect(errorIds()).toContain(ERROR_IDS.NO_OUTREACH_ALERT_SEND_FAILED);
    });

    it("sends one Admin Failure Notification for a sweep with several failures", async () => {
      const { run, failureAlerts, onlyMessage } = setup({
        candidates: [
          { id: "mr-1", matchRequest: matchRequest() },
          { id: "mr-2", matchRequest: matchRequest() },
        ],
        sendEmailErrors: [
          new EmailNetworkError("Mailgun down"),
          new EmailNetworkError("Mailgun down"),
        ],
      });

      await run();

      const notification = onlyMessage(failureAlerts());
      expect(notification.to).toEqual([MARK_EMAIL, REFERRAL_EMAIL]);
      expect(notification.html).toContain("mr-1");
      expect(notification.html).toContain("mr-2");
      expect(notification.html).not.toContain("Mailgun down");
    });

    it("sends no Admin Failure Notification for a clean sweep", async () => {
      const { run, failureAlerts } = setup();

      await run();

      expect(failureAlerts()).toHaveLength(0);
    });

    it("does not alert when the responses can't be read", async () => {
      const { run, alerts, failureAlerts, errorIds } = setup({
        responsesError: new Error("Firestore unavailable"),
      });

      await run();

      expect(alerts()).toHaveLength(0);
      expect(failureAlerts()).toHaveLength(1);
      expect(errorIds()).toContain(
        ERROR_IDS.NO_OUTREACH_ALERT_RESPONSES_READ_FAILED,
      );
    });

    it("logs CRITICAL when the marker write fails after Mailgun accepts", async () => {
      const { run, alerts, failureAlerts, logger } = setup({
        markerError: new Error("Firestore unavailable"),
      });

      await run();

      expect(alerts()).toHaveLength(1);
      expect(failureAlerts()).toHaveLength(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("CRITICAL"),
        expect.objectContaining({
          errorId: ERROR_IDS.NO_OUTREACH_ALERT_MARKER_WRITE_FAILED,
          severity: "CRITICAL",
          matchRequestId: "mr-1",
        }),
      );
    });

    it("logs CRITICAL when the Admin Failure Notification also fails", async () => {
      const { run, logger } = setup({
        sendEmailErrors: [
          new EmailNetworkError("Mailgun down"),
          new EmailNetworkError("Mailgun down"),
        ],
      });

      await run();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("CRITICAL"),
        expect.objectContaining({
          errorId: ERROR_IDS.NO_OUTREACH_ALERT_FAILURE_ALERT_FAILED,
          severity: "CRITICAL",
        }),
      );
    });

    it("notifies admins and rethrows when the sweep can't list Match Requests", async () => {
      const listError = new Error("Firestore unavailable");
      const { run, failureAlerts, errorIds } = setup({ listError });

      let thrown: unknown;
      try {
        await run();
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(listError);
      expect(failureAlerts()).toHaveLength(1);
      expect(errorIds()).toContain(ERROR_IDS.NO_OUTREACH_ALERT_SWEEP_FAILED);
    });
  });
});
