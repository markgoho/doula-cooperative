/**
 * Stripe Webhook Integration Tests
 *
 * **NOTE:** These integration tests are currently skipped in CI/CD because they require:
 * 1. Stripe CLI installed and authenticated
 * 2. `stripe listen` process running to forward webhooks
 * 3. Complex async timing between triggers, webhooks, and Firebase Auth triggers
 *
 * ## Recommended Manual Testing Approach:
 *
 * 1. Start emulators: `firebase emulators:start`
 * 2. In another terminal: `cd functions && stripe listen --forward-to http://127.0.0.1:5001/doula-cooperative-test/us-central1/stripeWebhook --skip-verify`
 * 3. In a third terminal: `stripe trigger checkout.session.completed`
 * 4. Check emulator logs and Firestore UI to verify user creation and member document update
 *
 * ## For Automated Testing:
 * - Unit tests in `stripe-webhook.test.ts` provide full coverage with mocked Stripe events
 * - These integration tests are kept for reference but may be flaky
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  cleanupTestMembers,
  getMemberData,
} from "../test-utils/firestore-helpers.js";
import {
  initializeTest,
  TEST_PROJECT_ID,
} from "../test-utils/test-setup.js";

const test = initializeTest();

// Helper to check if Stripe CLI is available
async function isStripeCLIAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["stripe", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

// Helper to trigger a Stripe event (requires stripe listen to be running)
async function triggerStripeEvent(eventType: string): Promise<void> {
  const proc = Bun.spawn(["stripe", "trigger", eventType], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    const stdout = await new Response(proc.stdout).text();
    throw new Error(
      `Stripe trigger failed with exit code ${exitCode}\nstderr: ${stderr}\nstdout: ${stdout}`,
    );
  }

  // Wait for webhook to be forwarded and processed
  await new Promise(resolve => setTimeout(resolve, 3000));
}

describe.skip("Integration Tests - Stripe CLI", () => {
  const WEBHOOK_URL = `http://127.0.0.1:5001/${TEST_PROJECT_ID}/us-central1/stripeWebhook`;
  let stripeCLIAvailable = false;
  let stripeListenProcess: ReturnType<typeof Bun.spawn> | undefined;

  beforeAll(async () => {
    stripeCLIAvailable = await isStripeCLIAvailable();

    if (!stripeCLIAvailable) {
      console.warn(
        "⚠️  Stripe CLI not found. Integration tests will be skipped.",
        "\n   Install: https://stripe.com/docs/stripe-cli",
        "\n   Then run: stripe login",
      );
      return;
    }

    // Start stripe listen process to forward webhooks to local endpoint
    stripeListenProcess = Bun.spawn(
      ["stripe", "listen", "--forward-to", WEBHOOK_URL, "--skip-verify"],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    // Wait for stripe listen to be ready (look for "Ready!" in output)
    console.log("Starting Stripe webhook listener...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Note: STRIPE_API_KEY and STRIPE_WEBHOOK_SECRET should be in functions/.secret.local
    // The emulator loads them automatically, so we don't check here
  });

  afterAll(async () => {
    // Stop stripe listen process
    if (stripeListenProcess) {
      stripeListenProcess.kill();
    }

    // Clean up any test users created
    const firestore = getFirestore();
    await cleanupTestMembers({ firestore });
    test.cleanup();
  });

  it("should process checkout.session.completed webhook triggered by Stripe CLI", async () => {
    if (!stripeCLIAvailable) {
      console.log("⏭️  Skipping: Stripe CLI not available");
      return;
    }

    // Act - Trigger the event using Stripe CLI (uses jenny.rosen@example.com by default)
    await triggerStripeEvent("checkout.session.completed");

    // Assert - Check that a user was created
    const firestore = getFirestore();
    const auth = getAuth();
    const testEmail = "jenny.rosen@example.com"; // Default email used by Stripe CLI

    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(testEmail);
    } catch {
      // User might not exist, which is a test failure
      throw new Error(
        `Expected user to be created by webhook with email ${testEmail}, but not found`,
      );
    }

    expect(userRecord).toBeDefined();
    expect(userRecord.email).toBe(testEmail);

    // Verify member document was created with subscription data
    const memberData = await getMemberData({
      firestore,
      uid: userRecord.uid,
    });

    // Debug: Log what we actually got if test fails
    if (memberData?.membershipActive !== true) {
      console.log("Member data:", JSON.stringify(memberData, undefined, 2));
    }

    // The createMemberOnUserCreated trigger creates a basic member document,
    // and the webhook should update it with Stripe data. Check both exist.
    expect(memberData).toBeDefined();
    expect(memberData?.email).toBe(testEmail);
    expect(memberData?.stripeCustomerId).toBeDefined();
    expect(memberData?.stripeSubscriptionId).toBeDefined();
    expect(memberData?.membershipActive).toBe(true);
    expect(memberData?.subscriptionStatus).toBe("active");

    // Cleanup
    await auth.deleteUser(userRecord.uid);
  }, 30_000); // 30 second timeout for Stripe CLI operations
});
