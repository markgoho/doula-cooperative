#!/usr/bin/env bun

/**
 * Test Stripe Webhook Script
 *
 * Manually trigger a Stripe webhook for testing purposes.
 *
 * Usage:
 *   bun run scripts/test-stripe-webhook.ts --email test@example.com
 *   bun run scripts/test-stripe-webhook.ts --email test@example.com --name "Test User"
 *   bun run scripts/test-stripe-webhook.ts --use-stripe-cli
 *
 * Options:
 *   --email <email>       Email address for test user (required unless --use-stripe-cli)
 *   --name <name>         Customer name (optional)
 *   --use-stripe-cli      Use Stripe CLI to trigger real event instead of mock
 *   --webhook-url <url>   Custom webhook URL (default: localhost:5001/PROJECT/us-central1/stripeWebhook)
 *
 * Requirements:
 *   - Firebase emulators must be running (Auth, Firestore, Functions)
 *   - For --use-stripe-cli: `stripe listen` must be running
 */

import { $ } from "bun";

// Parse command line arguments
const commandLineArguments = process.argv.slice(2);
const email = commandLineArguments[commandLineArguments.indexOf("--email") + 1];
const name =
  commandLineArguments[commandLineArguments.indexOf("--name") + 1] ??
  "Test User";
const shouldUseStripeCLI = commandLineArguments.includes("--use-stripe-cli");
const customWebhookUrl =
  commandLineArguments[commandLineArguments.indexOf("--webhook-url") + 1];

// Default webhook URL for emulator
const DEFAULT_WEBHOOK_URL =
  customWebhookUrl ??
  "http://localhost:5001/doula-cooperative-test/us-central1/stripeWebhook";

/**
 * Generate a mock Stripe checkout.session.completed event
 */
function generateMockEvent(testEmail: string, customerName: string) {
  const eventId = `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const customerId = `cus_test_${Math.random().toString(36).slice(2, 9)}`;
  const subscriptionId = `sub_test_${Math.random().toString(36).slice(2, 9)}`;

  return {
    id: eventId,
    object: "event",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `cs_test_${Math.random().toString(36).slice(2, 9)}`,
        object: "checkout.session",
        customer: customerId,
        customer_email: testEmail,
        subscription: subscriptionId,
        customer_details: {
          name: customerName,
          email: testEmail,
          phone: undefined,
          tax_exempt: "none",
          tax_ids: undefined,
          address: undefined,
        },
        mode: "subscription",
        payment_status: "paid",
        status: "complete",
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: undefined,
      idempotency_key: undefined,
    },
    type: "checkout.session.completed",
  };
}

/**
 * Call webhook directly with mock event
 */
async function callWebhookDirectly(testEmail: string, customerName: string) {
  console.log("\n🔄 Generating mock Stripe event...");

  const event = generateMockEvent(testEmail, customerName);

  console.log(`   Event ID: ${event.id}`);
  console.log(`   Customer: ${testEmail}`);
  console.log(`   Name: ${customerName}`);
  console.log(`   Subscription: ${event.data.object.subscription}`);

  console.log(`\n📤 Sending webhook to: ${DEFAULT_WEBHOOK_URL}`);

  try {
    const response = await fetch(DEFAULT_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "test-signature", // Will fail signature verification
      },
      body: JSON.stringify(event),
    });

    const responseText = await response.text();

    console.log(`\n📥 Response Status: ${response.status}`);

    if (response.status === 400 && responseText.includes("signature")) {
      console.log(
        "\n⚠️  Signature verification failed (expected for direct calls)",
      );
      console.log(
        "   To test with real signature verification, use --use-stripe-cli",
      );
    } else if (response.status === 200) {
      console.log(`\n✅ Webhook processed successfully!`);
      console.log(`   Response: ${responseText}`);
    } else {
      console.log(`\n❌ Webhook failed`);
      console.log(`   Response: ${responseText}`);
    }

    // Show verification steps
    console.log("\n📋 Verification Steps:");
    console.log("   1. Check Firebase emulator UI (http://localhost:4000)");
    console.log("      - Auth tab: Look for user with email", testEmail);
    console.log(
      "      - Firestore tab: members collection → Check for document",
    );
    console.log("   2. Check function logs:");
    console.log("      firebase functions:log --only stripeWebhook --follow");
    console.log(
      "   3. Check processed events: Firestore → processedStripeEvents",
    );
  } catch (error) {
    console.error("\n❌ Error calling webhook:", error);
    console.log("\n💡 Make sure Firebase emulators are running:");
    console.log("   bun start");
  }
}

/**
 * Use Stripe CLI to trigger event
 */
async function useStripeCLI() {
  console.log("\n🔄 Triggering event via Stripe CLI...");
  console.log(
    "   Note: This uses Stripe's test data (jenny.rosen@example.com)",
  );
  console.log(
    "   To use custom email, use direct mode without --use-stripe-cli",
  );

  console.log("\n📋 Prerequisites:");
  console.log("   - Stripe CLI installed: stripe --version");
  console.log("   - Stripe listen running:");
  console.log(
    `     stripe listen --forward-to ${DEFAULT_WEBHOOK_URL} --skip-verify`,
  );

  console.log("\n📤 Triggering checkout.session.completed event...\n");

  try {
    // Run stripe trigger command
    await $`stripe trigger checkout.session.completed`.quiet();

    console.log("\n✅ Event triggered via Stripe CLI!");
    console.log("\n📋 Verification Steps:");
    console.log("   1. Check `stripe listen` output for webhook delivery");
    console.log("   2. Check Firebase emulator UI (http://localhost:4000)");
    console.log("      - Auth tab: Look for jenny.rosen@example.com");
    console.log("      - Firestore tab: members collection");
    console.log("   3. Check function logs:");
    console.log("      firebase functions:log --only stripeWebhook --follow");
  } catch (error) {
    console.error("\n❌ Error triggering via Stripe CLI");
    console.log("\n💡 Make sure:");
    console.log(
      "   1. Stripe CLI is installed: brew install stripe/stripe-cli/stripe",
    );
    console.log("   2. You're logged in: stripe login");
    console.log("   3. stripe listen is running in another terminal");
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("\n🧪 Stripe Webhook Testing Tool\n");

  if (shouldUseStripeCLI) {
    await useStripeCLI();
  } else {
    if (!email) {
      console.error(
        "❌ Error: --email is required when not using --use-stripe-cli",
      );
      console.log("\nUsage:");
      console.log(
        "  bun run scripts/test-stripe-webhook.ts --email test@example.com",
      );
      console.log("  bun run scripts/test-stripe-webhook.ts --use-stripe-cli");
      process.exit(1);
    }

    await callWebhookDirectly(email, name);
  }

  console.log("\n✨ Done!");
}

// Run script with top-level await
await main().catch((error: unknown) => {
  console.error("\n❌ Error:", error);
  process.exit(1);
});
