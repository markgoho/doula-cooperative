#!/usr/bin/env bun

/**
 * Start Hugo dev server with Stripe configuration from .env
 *
 * How it works:
 * 1. Bun loads .env file (native feature)
 * 2. Script reads STRIPE_* variables from .env
 * 3. Script spawns Hugo child process with HUGO_PARAMS_* env vars
 * 4. Hugo reads HUGO_PARAMS_* from its environment (native Hugo feature)
 *
 * Usage:
 *   bun run hugo:dev:stripe
 */

import { $ } from "bun";

// Bun loads .env automatically, verify keys exist
if (!process.env["STRIPE_TEST_PUBLISHABLE_KEY"]) {
  console.error("❌ STRIPE_TEST_PUBLISHABLE_KEY not found in .env");
  console.log("\n💡 Copy .env.example to .env and add your Stripe test keys");
  process.exit(1);
}

if (!process.env["STRIPE_TEST_PRICING_TABLE_ID"]) {
  console.error("❌ STRIPE_TEST_PRICING_TABLE_ID not found in .env");
  console.log("\n💡 Copy .env.example to .env and add your Stripe test keys");
  process.exit(1);
}

console.log("🚀 Starting Hugo dev server with Stripe enabled (test mode)...\n");
console.log("📍 http://localhost:1313/join-the-doula-cooperative/\n");

// Spawn Hugo process with HUGO_PARAMS_* environment variables
// Hugo will read these from its process environment
await $`cd hugo && hugo server --disableFastRender -D`.env({
  HUGO_PARAMS_STRIPE_PUBLISHABLEKEY: process.env["STRIPE_TEST_PUBLISHABLE_KEY"],
  HUGO_PARAMS_STRIPE_PRICINGTABLEID:
    process.env["STRIPE_TEST_PRICING_TABLE_ID"],
  HUGO_PARAMS_STRIPE_MODE: "test",
});
