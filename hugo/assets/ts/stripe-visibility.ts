declare const STRIPE_SECRET_KEY: string;

const urlParams = new URLSearchParams(window.location.search);
const providedKey = urlParams.get("key");

const isValidKey = providedKey === STRIPE_SECRET_KEY;

const stripePricing = document.querySelector(".stripe-pricing");
const pricingPaused = document.querySelector(".pricing-paused");

if (stripePricing && pricingPaused) {
  if (isValidKey) {
    stripePricing.classList.remove("pricing-hidden");
    stripePricing.classList.add("pricing-visible");
    pricingPaused.classList.remove("pricing-visible");
    pricingPaused.classList.add("pricing-hidden");
  } else {
    stripePricing.classList.remove("pricing-visible");
    stripePricing.classList.add("pricing-hidden");
    pricingPaused.classList.remove("pricing-hidden");
    pricingPaused.classList.add("pricing-visible");
  }
}
