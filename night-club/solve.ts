/**
 * Berghain Challenge Solver - Tuned Version
 *
 * This version includes "knobs" to fine-tune the decision-making logic.
 *
 * How to run:
 * 1. Fill in your `PLAYER_ID` below.
 * 2. Adjust the TUNING_KNOBS values to experiment with different strategies.
 * 3. Run for a scenario: `bun night-club/solve.ts <scenario>`
 *    - Scenario must be 1, 2, or 3
 *    - Example: `bun night-club/solve.ts 2`
 */

import {
  API_BASE,
  API_DELAY_MS,
  INITIAL_BACKOFF_MS,
  MAX_RETRIES,
  PLAYER_ID,
  TARGET_CAPACITY,
  TUNING_PROFILES,
} from "./constants";
import { shouldAccept } from "./should-accept";
import {
  type ClubState,
  type DecideResponse,
  type NewGameResponse,
} from "./types";

// Parse command line arguments
const commandLineArguments = process.argv.slice(2);
const scenarioArgument = commandLineArguments[0]; // First argument is the scenario number

// Validate scenario argument
if (!scenarioArgument || ![1, 2, 3].includes(Number(scenarioArgument))) {
  console.error(
    "❌ Error: Please provide a valid scenario number (1, 2, or 3) as the first argument.",
  );
  console.error("Usage: bun night-club/solve.ts <scenario>");
  console.error("Example: bun night-club/solve.ts 2");
  throw new Error("Invalid or missing scenario argument");
}

const scenarioToRun = Number(scenarioArgument) as 1 | 2 | 3;

// --- HELPER FUNCTION ---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- MAIN GAME PLAYER (Unchanged from original) ---
async function playGame(scenario: 1 | 2 | 3, playerId: string) {
  if (!playerId || playerId.includes("REPLACE")) {
    console.error(
      "❌ Error: Please replace the placeholder PLAYER_ID in the script.",
    );
    return;
  }

  // --- v13: Select the tuning profile for the current scenario ---
  const tuningKnobs = TUNING_PROFILES[scenario];

  try {
    console.log(
      `🚀 Starting game for scenario ${String(scenario)} with tuned parameters...`,
    );
    console.log("Tuning Knobs:", tuningKnobs);
    const newGameUrl = `${API_BASE}/new-game?scenario=${String(
      scenario,
    )}&playerId=${playerId}`;
    const gameResponse = await fetch(newGameUrl);

    if (!gameResponse.ok) {
      console.error(
        `API Error: ${String(gameResponse.status)} ${gameResponse.statusText}`,
      );
      console.error("Response:", await gameResponse.text());
      return;
    }

    const gameData = (await gameResponse.json()) as NewGameResponse;

    const { gameId } = gameData;
    const constraints = new Map(
      gameData.constraints.map(c => [c.attribute, c.minCount]),
    );
    const probabilities = new Map(
      Object.entries(gameData.attributeStatistics.relativeFrequencies),
    );
    const correlations = new Map(
      Object.entries(gameData.attributeStatistics.correlations).map(
        ([attribute, corrMap]) => [attribute, new Map(Object.entries(corrMap))],
      ),
    );

    console.log(`Game ID: ${gameId}`);

    // --- v13: Log initial expected counts for diagnosis ---
    const estimatedTotalPeople = TARGET_CAPACITY + 900; // A reasonable estimate
    console.log(
      `\n--- Scenario Diagnosis (estimated arrivals for ~${String(estimatedTotalPeople)} people) ---`,
    );
    for (const [attribute, minCount] of constraints) {
      const probability = probabilities.get(attribute) ?? 0;
      const expected = Math.round(estimatedTotalPeople * probability);
      const pressure = (minCount / expected).toFixed(2);
      console.log(
        `- ${attribute.padEnd(20)} | Need: ${String(minCount).padEnd(
          4,
        )} | Expect: ~${String(expected).padEnd(4)} | Pressure: ${pressure}`,
      );
    }
    console.log("---------------------------------------------------\n");

    const state: ClubState = { admittedCount: 0, currentCounts: new Map() };
    let url = `${API_BASE}/decide-and-next?gameId=${gameId}`;
    const initialResponse = await fetch(url);

    if (!initialResponse.ok) {
      console.error(
        `API Error: ${String(initialResponse.status)} ${initialResponse.statusText}`,
      );
      console.error("Response:", await initialResponse.text());
      return;
    }

    let response = (await initialResponse.json()) as DecideResponse;

    console.log("\n Bouncer is at the door... \n");

    let retries = 0;
    let backoffDelay = INITIAL_BACKOFF_MS;

    while (response.status === "running" && response.nextPerson) {
      try {
        const personToDecideOn = response.nextPerson;
        const accept = shouldAccept(
          personToDecideOn,
          state,
          constraints,
          probabilities,
          correlations,
          tuningKnobs, // Pass the selected tuning knobs to the decision function
        );

        await sleep(API_DELAY_MS);

        url = `${API_BASE}/decide-and-next?gameId=${gameId}&personIndex=${String(
          personToDecideOn.personIndex,
        )}&accept=${String(accept)}`;
        const decideResponse = await fetch(url);

        if (decideResponse.status >= 500) {
          throw new Error(
            `Server error ${String(decideResponse.status)}: ${await decideResponse.text()}`,
          );
        }

        if (!decideResponse.ok) {
          const errorText = await decideResponse.text();
          console.error(
            `\n\nAPI Client Error: ${String(decideResponse.status)} ${decideResponse.statusText}`,
          );
          console.error("Response:", errorText);

          // Attempt to resynchronize when the server reports an unexpected person index
          if (
            decideResponse.status === 400 &&
            /Expected person\s+\d+,\s+got\s+\d+/i.test(errorText)
          ) {
            console.warn("Attempting to resynchronize with server state...");
            const resyncResponse = await fetch(
              `${API_BASE}/decide-and-next?gameId=${gameId}`,
            );
            if (resyncResponse.ok) {
              response = (await resyncResponse.json()) as DecideResponse;
              // Do not update local state; just continue with authoritative next person
              // Reset retry state since we recovered
              retries = 0;
              backoffDelay = INITIAL_BACKOFF_MS;
              continue;
            }
          }

          break;
        }

        response = (await decideResponse.json()) as DecideResponse;

        // Only update local state after a successful decision
        if (accept) {
          state.admittedCount++;
          for (const [attribute, hasAttribute] of Object.entries(
            personToDecideOn.attributes,
          )) {
            if (hasAttribute) {
              state.currentCounts.set(
                attribute,
                (state.currentCounts.get(attribute) ?? 0) + 1,
              );
            }
          }
        }

        if (personToDecideOn.personIndex % 100 === 0) {
          console.log(
            `\n[Person #${String(personToDecideOn.personIndex)}] Admitted: ${String(
              state.admittedCount,
            )}/${String(TARGET_CAPACITY)}. Decision: ${
              accept ? "✅ Accept" : "❌ Reject"
            }`,
          );
        } else {
          process.stdout.write(accept ? "✅" : "❌");
        }

        // Reset retry state on success
        retries = 0;
        backoffDelay = INITIAL_BACKOFF_MS;
      } catch (error) {
        retries++;
        if (retries > MAX_RETRIES) {
          console.error(
            `\n\nFailed after ${String(MAX_RETRIES)} retries. Aborting.`,
            error,
          );
          break;
        }
        console.warn(
          `\nAPI call failed. Retrying in ${String(backoffDelay / 1000)}s... (Attempt ${String(retries)})`,
        );
        await sleep(backoffDelay);
        backoffDelay *= 2; // Exponentially increase delay
        // The loop will continue with the same `response` object, retrying the same person.
      }
    }

    console.log("\n\n--- 🏁 Game Over ---");

    if (state.admittedCount > 0) {
      console.log(
        `Of the ${String(state.admittedCount)} people in the club, the breakdown is:`,
      );
      const attributeCounts = Object.fromEntries(state.currentCounts.entries());
      console.log(JSON.stringify(attributeCounts, undefined, 2));
    }

    if (response.status === "completed") {
      console.log(
        `🏆 Success! Final rejection count: ${String(response.rejectedCount)}`,
      );
    } else if (response.status === "failed") {
      console.error(`💔 Failed! Reason: ${response.reason ?? "Unknown"}`);
    } else {
      console.log("Game ended with status:", response.status, response);
    }
  } catch (error) {
    console.error("An unexpected error occurred:", error);
  }
}

await playGame(scenarioToRun, PLAYER_ID);
