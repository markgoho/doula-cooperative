/**
 * Benchmark runner for the Night Club simulator.
 *
 * Usage:
 *   bun night-club/bench.ts <scenario:1|2|3> [runs=50] [queueSize=20000] [startSeed=1]
 *
 * It runs the simulator with seeds startSeed..startSeed+runs-1, parses the
 * rejection counts, and prints mean, sd, and 95% CI. You can run this for a
 * baseline and again after knob tweaks, then compare the two summaries or
 * diff the per-seed outputs to get paired-seed deltas.
 */

import { $ } from "bun";

function parseRejected(output: string): number | undefined {
  const regex = /Rejected:\s+(\d+)/;
  const match = regex.exec(output);
  if (match?.[1] !== undefined) return Number(match[1]);
  return undefined;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  const n = values.length;
  if (n <= 1) return 0;
  const m = mean(values);
  const variance =
    values.reduce((accumulator, x) => accumulator + (x - m) * (x - m), 0) /
    (n - 1);
  return Math.sqrt(variance);
}

async function main() {
  const arguments_ = process.argv.slice(2);
  const scenario = Number(arguments_[0]);
  if (![1, 2, 3].includes(scenario)) {
    throw new Error(
      "Usage: bun night-club/bench.ts <scenario:1|2|3> [runs=50] [queueSize=20000] [startSeed=1]",
    );
  }
  const runs = arguments_[1] ? Math.max(1, Number(arguments_[1])) : 50;
  const queueSize = arguments_[2]
    ? Math.max(1000, Number(arguments_[2]))
    : 20_000;
  const startSeed = arguments_[3] ? Math.max(1, Number(arguments_[3])) : 1;

  const rejectedCounts: number[] = [];
  const seedsUsed: number[] = [];
  for (let offset = 0; offset < runs; offset++) {
    const seed = startSeed + offset;
    const proc =
      await $`bun night-club/simulator.ts ${scenario} ${queueSize} ${seed}`.quiet();
    const stdout = proc.stdout.toString();
    const rejected = parseRejected(stdout);
    if (typeof rejected === "number" && Number.isFinite(rejected)) {
      rejectedCounts.push(rejected);
      seedsUsed.push(seed);
    } else {
      console.warn(`Seed ${String(seed)}: could not parse rejected count`);
    }
  }

  const m = mean(rejectedCounts);
  const sd = stddev(rejectedCounts);
  const n = rejectedCounts.length;
  const se = n > 0 ? sd / Math.sqrt(n) : 0;
  const ciLow = m - 1.96 * se;
  const ciHigh = m + 1.96 * se;

  console.log("\n--- Benchmark Summary ---");
  console.log(`Scenario: ${String(scenario)}`);
  console.log(
    `Runs: ${String(n)} (seeds ${String(seedsUsed[0] ?? startSeed)}..${String(
      seedsUsed[n - 1] ?? startSeed + runs - 1,
    )})`,
  );
  console.log(`Queue size: ${String(queueSize)}`);
  console.log(`Rejected (mean): ${m.toFixed(2)}`);
  console.log(`Rejected (sd):   ${sd.toFixed(2)}`);
  console.log(`95% CI:          ${ciLow.toFixed(2)} .. ${ciHigh.toFixed(2)}`);
}

await main();
