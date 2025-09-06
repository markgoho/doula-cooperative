import { TARGET_CAPACITY } from "./constants";
import { type ClubState, type Person, type TuningKnobs } from "./types";

export function shouldAccept(
  person: Person,
  state: ClubState,
  constraints: Map<string, number>,
  probabilities: Map<string, number>,
  correlations: Map<string, Map<string, number>>,
  tuningKnobs: TuningKnobs,
): boolean {
  const spotsLeft = TARGET_CAPACITY - state.admittedCount;
  if (spotsLeft <= 0) return false;

  const currentAcceptanceRate =
    person.personIndex > 0 ? state.admittedCount / person.personIndex : 0.5; // Start with a reasonable guess
  const peopleToFill = spotsLeft / currentAcceptanceRate;
  const peopleToEvaluate = Math.max(
    peopleToFill,
    tuningKnobs.MINIMUM_PEOPLE_TO_EVALUATE,
  );

  // v13: Calculate "Constraint Pressure" for each attribute.
  const baseNeeds = new Map<string, number>();
  const pressureScores = new Map<string, number>();
  const isDesperate = new Map<string, boolean>(); // Also bring back simple desperation

  for (const [attribute, requiredCount] of constraints.entries()) {
    const currentCount = state.currentCounts.get(attribute) ?? 0;
    const neededCount = Math.max(0, requiredCount - currentCount);
    baseNeeds.set(attribute, neededCount);

    const probability = probabilities.get(attribute) ?? 0;
    const expectedToArrive = peopleToEvaluate * probability;

    // Logic for simple desperation (for S1)
    isDesperate.set(
      attribute,
      neededCount > 0 &&
        expectedToArrive < neededCount * tuningKnobs.FUDGE_FACTOR,
    );

    // Logic for pressure (for S2)
    if (neededCount > 0 && expectedToArrive > 0) {
      const pressure = neededCount / expectedToArrive;
      pressureScores.set(attribute, pressure);
    } else {
      pressureScores.set(attribute, 0);
    }
  }

  // Calculate the base expected value of a random person from this point on,
  // making it "fully bonus-aware" to prevent the threshold from collapsing.
  let expectedValue = 0;
  // 1. Expected base value + pressure bonus
  for (const [attribute, neededCount] of baseNeeds.entries()) {
    if (neededCount > 0) {
      const probability = probabilities.get(attribute) ?? 0;
      expectedValue += neededCount * probability;
    }
    // Pressure bonus is always calculated, even if need is 0, as it can be > 0
    const probability = probabilities.get(attribute) ?? 0;
    const pressure = pressureScores.get(attribute) ?? 0;
    const expectedPressureBonus =
      pressure * tuningKnobs.PRESSURE_MULTIPLIER * probability;
    expectedValue += expectedPressureBonus;
  }

  // 2. Expected correlation-based bonuses
  const neededAttributes = [...baseNeeds.keys()].filter(
    attribute => (baseNeeds.get(attribute) ?? 0) > 0,
  );

  // For unicorn bonus (two needed attributes)
  for (let index = 0; index < neededAttributes.length; index++) {
    for (let index_ = index + 1; index_ < neededAttributes.length; index_++) {
      const attribute1 = neededAttributes[index];
      const attribute2 = neededAttributes[index_];
      if (!attribute1 || !attribute2) continue;
      const p1 = probabilities.get(attribute1) ?? 0;
      const p2 = probabilities.get(attribute2) ?? 0;
      const correlation = correlations.get(attribute1)?.get(attribute2) ?? 0;
      if (p1 > 0 && p1 < 1 && p2 > 0 && p2 < 1) {
        const p_both =
          p1 * p2 + correlation * Math.sqrt(p1 * (1 - p1) * p2 * (1 - p2));
        if (correlation > 0) {
          expectedValue +=
            correlation * p_both * tuningKnobs.CORRELATION_BONUS_FACTOR;
        } else if (correlation < 0) {
          expectedValue +=
            Math.abs(correlation) *
            p_both *
            tuningKnobs.NEGATIVE_CORRELATION_BREAKER_BONUS;
        }
      }
    }
  }

  // For compensation bonus (one needed, one NOT, and negatively correlated)
  const satisfiedAttributes = [...baseNeeds.keys()].filter(
    attribute => (baseNeeds.get(attribute) ?? 0) === 0,
  );
  for (const neededAttribute of neededAttributes) {
    for (const satisfiedAttribute of satisfiedAttributes) {
      const correlation =
        correlations.get(neededAttribute)?.get(satisfiedAttribute) ?? 0;
      if (correlation < 0) {
        const p_needed = probabilities.get(neededAttribute) ?? 0;
        const p_satisfied = probabilities.get(satisfiedAttribute) ?? 0;
        if (
          p_needed > 0 &&
          p_needed < 1 &&
          p_satisfied > 0 &&
          p_satisfied < 1
        ) {
          const p_both =
            p_needed * p_satisfied +
            correlation *
              Math.sqrt(
                p_needed * (1 - p_needed) * p_satisfied * (1 - p_satisfied),
              );
          const p_needed_not_satisfied = p_needed - p_both;
          expectedValue +=
            Math.abs(correlation) *
            p_needed_not_satisfied *
            tuningKnobs.NEGATIVE_CORRELATION_COMPENSATION_BONUS;
        }
      }
    }
  }

  const progress = spotsLeft / TARGET_CAPACITY;
  const closingTimeFactor = Math.pow(
    progress,
    tuningKnobs.CLOSING_TIME_AGGRESSIVENESS,
  );
  let acceptanceThreshold = expectedValue * closingTimeFactor;

  // v15: Apply the global pickiness multiplier.
  acceptanceThreshold *= tuningKnobs.THRESHOLD_MULTIPLIER;

  // Adjust pickiness based on how we're tracking against our target rejection rate.
  if (person.personIndex > 50) {
    const targetAcceptanceRate =
      TARGET_CAPACITY / (TARGET_CAPACITY + tuningKnobs.TARGET_REJECTION_COUNT);
    const acceptanceRateRatio = currentAcceptanceRate / targetAcceptanceRate;

    const adjustmentFactor = Math.pow(
      acceptanceRateRatio,
      tuningKnobs.REJECTION_RATE_SENSITIVITY,
    );
    acceptanceThreshold *= adjustmentFactor;
  }

  // Calculate the value of THIS person, applying a bonus based on the pressure they relieve.
  let personValue = 0;
  const personAttributes = Object.keys(person.attributes).filter(
    attribute => person.attributes[attribute],
  );

  for (const attribute of personAttributes) {
    let value = baseNeeds.get(attribute) ?? 0;

    // Apply simple desperation bonus (for S1)
    if (isDesperate.get(attribute)) {
      value *= tuningKnobs.DESPERATION_MULTIPLIER;
    }

    // Apply pressure bonus (for S2) - CORRECTED CALCULATION
    const pressure = pressureScores.get(attribute) ?? 0;
    const pressureBonus = pressure * tuningKnobs.PRESSURE_MULTIPLIER;
    value += pressureBonus;

    personValue += value;
  }

  if (personAttributes.length > 1) {
    let correlationBonus = 0;
    for (let index = 0; index < personAttributes.length; index++) {
      for (let index_ = index + 1; index_ < personAttributes.length; index_++) {
        const attribute1 = personAttributes[index];
        const attribute2 = personAttributes[index_];

        if (
          attribute1 &&
          attribute2 &&
          (baseNeeds.get(attribute1) ?? 0) > 0 &&
          (baseNeeds.get(attribute2) ?? 0) > 0
        ) {
          const correlation =
            correlations.get(attribute1)?.get(attribute2) ?? 0;
          if (correlation > 0) {
            correlationBonus +=
              correlation * tuningKnobs.CORRELATION_BONUS_FACTOR;
          } else if (correlation < 0) {
            // v33: Add a bonus for breaking negative correlations
            correlationBonus +=
              Math.abs(correlation) *
              tuningKnobs.NEGATIVE_CORRELATION_BREAKER_BONUS;
          }
        }
      }
    }
    personValue += correlationBonus;
  }

  // v37: Apply the new compensation bonus
  let compensationBonus = 0;
  for (const attribute of personAttributes) {
    if ((baseNeeds.get(attribute) ?? 0) > 0) {
      // Find attributes this one is negatively correlated with
      const personCorrelations = correlations.get(attribute);
      if (personCorrelations) {
        for (const [
          otherAttribute,
          correlation,
        ] of personCorrelations.entries()) {
          if (
            correlation < 0 &&
            !person.attributes[otherAttribute] &&
            (baseNeeds.get(otherAttribute) ?? 0) === 0
          ) {
            compensationBonus +=
              Math.abs(correlation) *
              tuningKnobs.NEGATIVE_CORRELATION_COMPENSATION_BONUS;
          }
        }
      }
    }
  }
  personValue += compensationBonus;

  return personValue >= acceptanceThreshold;
}
