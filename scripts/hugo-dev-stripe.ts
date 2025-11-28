#!/usr/bin/env bun

/**
 * Start Hugo dev server with Stripe configuration from .env
 *
 * Bun automatically loads .env file, so just run:
 *   bun run hugo:dev:stripe
 */

import { $ } from "bun";

// Bun loads .env automatically, verify keys exist
if (!process.env.STRIPE_TEST_PUBLISHABLE_KEY) {
  console.error("❌ STRIPE_TEST_PUBLISHABLE_KEY not found in .env");
  console.log("\n💡 Copy .env.example to .env and add your Stripe test keys");
  process.exit(1);
}

if (!process.env.STRIPE_TEST_PRICING_TABLE_ID) {
  console.error("❌ STRIPE_TEST_PRICING_TABLE_ID not found in .env");
  console.log("\n💡 Copy .env.example to .env and add your Stripe test keys");
  process.exit(1);
}

console.log("🚀 Starting Hugo dev server with Stripe enabled (test mode)...\n");
console.log("📍 http://localhost:1313/join-the-doula-cooperative/\n");

// Run Hugo with Stripe env vars
await $`cd hugo && hugo server --disableFastRender -D`.env({
  HUGO_PARAMS_STRIPE_PUBLISHABLEKEY: process.env.STRIPE_TEST_PUBLISHABLE_KEY,
  HUGO_PARAMS_STRIPE_PRICINGTABLEID: process.env.STRIPE_TEST_PRICING_TABLE_ID,
  HUGO_PARAMS_STRIPE_MODE: "test",
});
