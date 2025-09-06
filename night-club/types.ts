// --- TYPE DEFINITIONS ---
export interface NewGameResponse {
  gameId: string;
  constraints: { attribute: string; minCount: number }[];
  attributeStatistics: {
    relativeFrequencies: Record<string, number>;
    correlations: Record<string, Record<string, number>>;
  };
}

export interface Person {
  personIndex: number;
  attributes: Record<string, boolean>;
}

export interface DecideResponse {
  status: "running" | "completed" | "failed";
  admittedCount?: number;
  rejectedCount: number;
  nextPerson: Person | null;
  reason?: string;
}

export interface ClubState {
  admittedCount: number;
  currentCounts: Map<string, number>;
}

export interface TuningKnobs {
  CLOSING_TIME_AGGRESSIVENESS: number;
  CORRELATION_BONUS_FACTOR: number;
  FUDGE_FACTOR: number;
  REJECTION_RATE_SENSITIVITY: number;
  DESPERATION_MULTIPLIER: number;
  PRESSURE_MULTIPLIER: number;
  TARGET_REJECTION_COUNT: number;
  THRESHOLD_MULTIPLIER: number;
  MINIMUM_PEOPLE_TO_EVALUATE: number;
  NEGATIVE_CORRELATION_BREAKER_BONUS: number;
  NEGATIVE_CORRELATION_COMPENSATION_BONUS: number;
}
