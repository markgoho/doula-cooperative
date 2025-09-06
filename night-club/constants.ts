import type { TuningKnobs } from "./types";

// --- CONFIGURATION ---
export const API_BASE = "https://berghain.challenges.listenlabs.ai";
export const PLAYER_ID = "4c92c8d7-7dc1-467d-a6e0-c19276646758"; // REPLACE WITH YOUR ID
export const SCENARIO_TO_RUN: 1 | 2 | 3 = 1;

// --- TUNING KNOBS ---
// We now have scenario-specific tuning profiles.
export const TUNING_PROFILES: Record<1 | 2 | 3, TuningKnobs> = {
  1: {
    // Optimal profile for S1. Uses simple desperation, no pressure.
    CLOSING_TIME_AGGRESSIVENESS: 1.5,
    CORRELATION_BONUS_FACTOR: 500,
    FUDGE_FACTOR: 1.1,
    REJECTION_RATE_SENSITIVITY: 1.2,
    DESPERATION_MULTIPLIER: 5,
    PRESSURE_MULTIPLIER: 0,
    TARGET_REJECTION_COUNT: 750,
    THRESHOLD_MULTIPLIER: 1, // No change for S1.
    MINIMUM_PEOPLE_TO_EVALUATE: 0, // Not needed for S1
    NEGATIVE_CORRELATION_BREAKER_BONUS: 0, // NEW: Reward unicorns
    NEGATIVE_CORRELATION_COMPENSATION_BONUS: 0, // NEW: Compensate for full constraints
  },
  2: {
    // Reverted to v30 profile and added Negative Correlation Breaker
    CLOSING_TIME_AGGRESSIVENESS: 0,
    CORRELATION_BONUS_FACTOR: 1500,
    FUDGE_FACTOR: 1.1,
    REJECTION_RATE_SENSITIVITY: 0,
    DESPERATION_MULTIPLIER: 0,
    PRESSURE_MULTIPLIER: 450,
    TARGET_REJECTION_COUNT: 3200,
    THRESHOLD_MULTIPLIER: 1.2,
    MINIMUM_PEOPLE_TO_EVALUATE: 250, // Prevents end-game panic
    NEGATIVE_CORRELATION_BREAKER_BONUS: 1000, // NEW: Reward unicorns
    NEGATIVE_CORRELATION_COMPENSATION_BONUS: 0, // NEW: Compensate for full constraints
  },
  3: {
    // v37: Introducing a new "compensation" bonus to solve the core
    // architectural flaw identified in the v36 run.
    // v41: Resetting tuning after making threshold fully bonus-aware.
    CLOSING_TIME_AGGRESSIVENESS: 0,
    CORRELATION_BONUS_FACTOR: 1000,
    FUDGE_FACTOR: 1.1, // Unused, kept at default
    REJECTION_RATE_SENSITIVITY: 0,
    DESPERATION_MULTIPLIER: 0, // Use pressure system instead
    PRESSURE_MULTIPLIER: 3500,
    TARGET_REJECTION_COUNT: 4000,
    THRESHOLD_MULTIPLIER: 1.2,
    MINIMUM_PEOPLE_TO_EVALUATE: 250,
    NEGATIVE_CORRELATION_BREAKER_BONUS: 2500,
    NEGATIVE_CORRELATION_COMPENSATION_BONUS: 3000,
  },
};

export const TARGET_CAPACITY = 1000;
export const MAX_REJECTIONS = 20_000;
export const API_DELAY_MS = 1; // Small delay between requests

// --- RETRY CONFIGURATION ---
export const MAX_RETRIES = 5;
export const INITIAL_BACKOFF_MS = 1000;
