/**
 * Local Simulator that mirrors the live decision loop but runs fully offline.
 *
 * Usage: bun night-club/simulator.ts <scenario:1|2|3> [queueSize]
 */

import { TARGET_CAPACITY, TUNING_PROFILES } from "./constants";
import { shouldAccept } from "./should-accept";
import { type ClubState, type Person, type TuningKnobs } from "./types";

// Define the specific attribute names used in the night club scenarios
type ClubAttribute =
  // Scenario 1 attributes
  | "young"
  | "well_dressed"
  // Scenario 2 attributes
  | "techno_lover"
  | "well_connected"
  | "creative"
  | "berlin_local"
  // Scenario 3 attributes
  | "underground_veteran"
  | "international"
  | "fashion_forward"
  | "queer_friendly"
  | "vinyl_collector"
  | "german_speaker";

// Helper type for correlations access - permissive but type-safe for runtime data
type CorrelationMatrix = Record<string, Record<string, number>>;

interface ScenarioStats {
  constraints: Map<ClubAttribute, number>;
  relativeFrequencies: Partial<Record<ClubAttribute, number>>;
  correlations: CorrelationMatrix;
}

// Deterministic PRNG for reproducible simulations
function createMulberry32(seed: number): () => number {
  let t = seed >>> 0;
  const CONST = 1_831_565_813; // decimal for 0x6d2b79f5
  return () => {
    t = (t + CONST) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296; // 0..1
  };
}

// Safe correlation accessor - handles the type safety issues with static data access
function getCorrelation(
  correlations: CorrelationMatrix,
  a: string,
  b: string,
): number {
  const rowA = correlations[a];
  if (rowA && typeof rowA[b] === "number") return rowA[b];
  const rowB = correlations[b];
  if (rowB && typeof rowB[a] === "number") return rowB[a];
  return 0;
}

const OFFLINE_STATS: Record<1 | 2 | 3, ScenarioStats> = {
  1: {
    constraints: new Map<ClubAttribute, number>([
      ["young", 600],
      ["well_dressed", 600],
    ]),
    relativeFrequencies: {
      well_dressed: 0.3225,
      young: 0.3225,
    },
    correlations: {
      well_dressed: {
        well_dressed: 1,
        young: 0.183_042_993_220_629_92,
      },
      young: {
        well_dressed: 0.183_042_993_220_629_92,
        young: 1,
      },
    },
  },
  2: {
    constraints: new Map<ClubAttribute, number>([
      ["techno_lover", 650],
      ["well_connected", 450],
      ["creative", 300],
      ["berlin_local", 750],
    ]),
    relativeFrequencies: {
      techno_lover: 0.6265,
      well_connected: 0.47,
      creative: 0.062_27,
      berlin_local: 0.398,
    },
    correlations: {
      techno_lover: {
        techno_lover: 1,
        well_connected: -0.469_616_933_267_432_4,
        creative: 0.094_633_170_398_915_86,
        berlin_local: -0.654_940_381_560_618_2,
      },
      well_connected: {
        techno_lover: -0.469_616_933_267_432_4,
        well_connected: 1,
        creative: 0.141_972_591_404_714_85,
        berlin_local: 0.572_406_780_843_645_2,
      },
      creative: {
        techno_lover: 0.094_633_170_398_915_86,
        well_connected: 0.141_972_591_404_714_85,
        creative: 1,
        berlin_local: 0.144_464_595_056_507_72,
      },
      berlin_local: {
        techno_lover: -0.654_940_381_560_618_2,
        well_connected: 0.572_406_780_843_645_2,
        creative: 0.144_464_595_056_507_72,
        berlin_local: 1,
      },
    },
  },
  3: {
    constraints: new Map<ClubAttribute, number>([
      ["underground_veteran", 500],
      ["international", 650],
      ["fashion_forward", 550],
      ["queer_friendly", 250],
      ["vinyl_collector", 200],
      ["german_speaker", 800],
    ]),
    relativeFrequencies: {
      underground_veteran: 0.6795,
      international: 0.5735,
      fashion_forward: 0.691_000_000_000_000_2,
      queer_friendly: 0.046_14,
      vinyl_collector: 0.044_54,
      german_speaker: 0.4565,
    },
    correlations: {
      underground_veteran: {
        underground_veteran: 1,
        international: -0.081_101_757_771_529_92,
        fashion_forward: -0.169_656_347_550_530_9,
        queer_friendly: 0.037_199_283_767_538_85,
        vinyl_collector: 0.072_235_211_563_898_42,
        german_speaker: 0.111_887_667_034_227_99,
      },
      international: {
        underground_veteran: -0.081_101_757_771_529_92,
        international: 1,
        fashion_forward: 0.375_711_059_360_155,
        queer_friendly: 0.003_669_331_438_871_168_6,
        vinyl_collector: -0.030_832_470_981_810_75,
        german_speaker: -0.717_252_938_251_939_5,
      },
      fashion_forward: {
        underground_veteran: -0.169_656_347_550_530_9,
        international: 0.375_711_059_360_155,
        fashion_forward: 1,
        queer_friendly: -0.003_453_092_679_337_747_6,
        vinyl_collector: -0.110_247_196_063_585_46,
        german_speaker: -0.352_102_446_159_740_3,
      },
      queer_friendly: {
        underground_veteran: 0.037_199_283_767_538_85,
        international: 0.003_669_331_438_871_168_6,
        fashion_forward: -0.003_453_092_679_337_747_6,
        queer_friendly: 1,
        vinyl_collector: 0.479_906_408_031_673_06,
        german_speaker: 0.047_973_811_326_805_03,
      },
      vinyl_collector: {
        underground_veteran: 0.072_235_211_563_898_42,
        international: -0.030_832_470_981_810_75,
        fashion_forward: -0.110_247_196_063_585_46,
        queer_friendly: 0.479_906_408_031_673_06,
        vinyl_collector: 1,
        german_speaker: 0.099_844_522_862_698_97,
      },
      german_speaker: {
        underground_veteran: 0.111_887_667_034_227_99,
        international: -0.717_252_938_251_939_5,
        fashion_forward: -0.352_102_446_159_740_3,
        queer_friendly: 0.047_973_811_326_805_03,
        vinyl_collector: 0.099_844_522_862_698_97,
        german_speaker: 1,
      },
    },
  },
};

function inverseStandardNormalCdf(probability: number): number {
  const a1 = -39.696_830_286_653_8;
  const a2 = 220.946_098_424_521;
  const a3 = -275.928_510_446_969;
  const a4 = 138.357_751_867_269;
  const a5 = -30.664_798_066_147_2;
  const a6 = 2.506_628_277_459_24;
  const b1 = -54.476_098_798_224_1;
  const b2 = 161.585_836_858_041;
  const b3 = -155.698_979_859_887;
  const b4 = 66.801_311_887_719_7;
  const b5 = -13.280_681_552_885_7;
  const c1 = -0.007_784_894_002_430_29;
  const c2 = -0.322_396_458_041_136;
  const c3 = -2.400_758_277_161_84;
  const c4 = -2.549_732_539_343_73;
  const c5 = 4.374_664_141_464_97;
  const c6 = 2.938_163_982_698_78;
  const d1 = 0.007_784_695_709_041_46;
  const d2 = 0.322_467_129_070_04;
  const d3 = 2.445_134_137_143;
  const d4 = 3.754_408_661_907_42;
  const pLow = 0.024_25;
  const pHigh = 1 - pLow;
  if (probability <= 0 || probability >= 1 || Number.isNaN(probability)) {
    if (probability === 0) return -Infinity;
    if (probability === 1) return Infinity;
    return Number.NaN;
  }
  if (probability < pLow) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }
  if (probability > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - probability));
    return -(
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }
  const q = probability - 0.5;
  const r = q * q;
  return (
    ((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
    (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
  );
}

function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  const lower: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );
  for (let index = 0; index < n; index++) {
    for (let index_ = 0; index_ <= index; index_++) {
      const rowI = matrix[index] ?? [];
      let sum = rowI[index_] ?? 0;
      const lowerRowI = lower[index] ?? [];
      const lowerRowJ = lower[index_] ?? [];
      for (let k = 0; k < index_; k++) {
        const lik = lowerRowI[k] ?? 0;
        const ljk = lowerRowJ[k] ?? 0;
        sum -= lik * ljk;
      }
      if (index === index_) {
        lowerRowI[index_] = Math.sqrt(Math.max(sum, 0));
      } else {
        const ljj = lowerRowJ[index_] ?? 0;
        lowerRowI[index_] = ljj > 0 ? sum / ljj : 0;
      }
    }
  }
  return lower;
}

function sampleCorrelatedBernoulli(
  attributeOrder: string[],
  thresholds: number[],
  choleskyLower: number[][],
  rng: () => number,
): Record<string, boolean> {
  const dimension = attributeOrder.length;
  const z: number[] = Array.from({ length: dimension }, () => {
    // Clamp away from 0/1 to avoid infinities in inverse CDF
    const u = Math.min(1 - 1e-12, Math.max(1e-12, rng()));
    return inverseStandardNormalCdf(u);
  });
  const y: number[] = Array.from({ length: dimension }, () => 0);
  for (let index = 0; index < dimension; index++) {
    let sum = 0;
    const row = choleskyLower[index] ?? [];
    for (let k = 0; k <= index; k++) {
      const rik = row[k] ?? 0;
      const zk = z[k] ?? 0;
      sum += rik * zk;
    }
    y[index] = sum;
  }
  const attributes: Record<string, boolean> = {};
  for (let index = 0; index < dimension; index++) {
    const name = attributeOrder[index];
    if (!name) continue;
    const thresh = thresholds[index] ?? Infinity;
    attributes[name] = (y[index] ?? Infinity) < thresh;
  }
  return attributes;
}

function buildCorrelationMatrix(
  attributes: ClubAttribute[],
  correlations: CorrelationMatrix,
): number[][] {
  const n = attributes.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );
  for (let index = 0; index < n; index++) {
    // Type assertion is safe here because matrix is initialized with the correct dimensions
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const row = matrix[index]!;
    for (let index_ = 0; index_ < n; index_++) {
      if (index === index_) {
        row[index_] = 1;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const ai = attributes[index]!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const aj = attributes[index_]!;
        const cij = getCorrelation(correlations, ai, aj);
        row[index_] = cij;
      }
    }
  }
  return matrix;
}

function toMapOfMaps(
  attributes: ClubAttribute[],
  correlations: CorrelationMatrix,
): Map<ClubAttribute, Map<ClubAttribute, number>> {
  const outer = new Map<ClubAttribute, Map<ClubAttribute, number>>();
  for (const a of attributes) {
    const inner = new Map<ClubAttribute, number>();
    for (const b of attributes) {
      if (a === b) continue;
      const value = getCorrelation(correlations, a, b);
      inner.set(b, value);
    }
    outer.set(a, inner);
  }
  return outer;
}

function runSimulation(scenario: 1 | 2 | 3, queueSize: number, seed?: number) {
  const stats = OFFLINE_STATS[scenario];
  const attributes: ClubAttribute[] = Object.keys(
    stats.relativeFrequencies,
  ) as ClubAttribute[];
  const thresholds = attributes.map(a =>
    inverseStandardNormalCdf(stats.relativeFrequencies[a] ?? 0),
  );
  const corrMatrix = buildCorrelationMatrix(attributes, stats.correlations);
  const choleskyLower = choleskyDecomposition(corrMatrix);

  const constraints = stats.constraints;
  const probabilities = new Map<ClubAttribute, number>(
    Object.entries(stats.relativeFrequencies) as [ClubAttribute, number][],
  );
  const correlationsMap = toMapOfMaps(attributes, stats.correlations);
  const tuningKnobs: TuningKnobs = TUNING_PROFILES[scenario];

  // Quiet mode: no per-person progress or scenario diagnosis

  const state: ClubState = { admittedCount: 0, currentCounts: new Map() };
  let rejectedCount = 0;
  const randomSeed =
    (Date.now() ^ Math.floor(Math.random() * 4_294_967_296)) >>> 0;
  const seedToUse: number =
    typeof seed === "number" && Number.isFinite(seed) ? seed >>> 0 : randomSeed;
  const rng = createMulberry32(seedToUse);

  for (let index = 0; index < queueSize; index++) {
    if (state.admittedCount >= TARGET_CAPACITY) break;
    const attributesSample = sampleCorrelatedBernoulli(
      attributes,
      thresholds,
      choleskyLower,
      rng,
    );
    const person: Person = { personIndex: index, attributes: attributesSample };
    const accept = shouldAccept(
      person,
      state,
      constraints,
      probabilities,
      correlationsMap,
      tuningKnobs,
    );
    if (accept) {
      state.admittedCount++;
      for (const [attribute, hasAttribute] of Object.entries(
        person.attributes,
      )) {
        if (hasAttribute) {
          state.currentCounts.set(
            attribute,
            (state.currentCounts.get(attribute) ?? 0) + 1,
          );
        }
      }
    } else {
      rejectedCount++;
    }

    // No per-person progress output
  }

  // Final concise summary
  const totalProcessed = state.admittedCount + rejectedCount;
  const efficiency =
    totalProcessed > 0 ? state.admittedCount / totalProcessed : 0;
  const attributeCounts = Object.fromEntries(state.currentCounts.entries());
  console.log("\n--- Offline Simulation Summary ---");
  console.log(`Scenario ${String(scenario)}`);
  console.log(
    `Admitted: ${String(state.admittedCount)}/${String(TARGET_CAPACITY)}`,
  );
  console.log(`Rejected: ${String(rejectedCount)}`);
  console.log(`Efficiency: ${efficiency.toFixed(4)}`);
  console.log(`Seed: ${String(seedToUse)}`);
  console.log("\n## Constraint Progress (text)");
  for (const [attribute, need] of constraints.entries()) {
    const have = state.currentCounts.get(attribute) ?? 0;
    const percent = need > 0 ? (have / need) * 100 : 0;
    const diff = have - need;
    const label = attribute.replaceAll("_", " ").toUpperCase();
    console.log(
      `${label} ${String(have)}/${String(need)} (${percent.toFixed(1)}%)`,
    );
    console.log(
      `${diff >= 0 ? "Over" : "Under"} target by ${String(Math.abs(diff))}`,
    );
    console.log(
      `${String(have)} of ${String(need)} required (out of ${String(TARGET_CAPACITY)} total)`,
    );
  }
  console.log("\nAttribute counts (raw):");
  console.log(JSON.stringify(attributeCounts, undefined, 2));
}

if (import.meta.main) {
  const arguments_ = process.argv.slice(2);
  const scenarioArgument = Number(arguments_[0]);
  if (![1, 2, 3].includes(scenarioArgument)) {
    console.error(
      "Usage: bun night-club/simulator.ts <scenario:1|2|3> [queueSize] [seed]",
    );
    throw new Error("Invalid or missing scenario argument");
  }
  const queueSize = arguments_[1]
    ? Math.max(1000, Number(arguments_[1]))
    : 20_000;
  const seedArgument =
    arguments_[2] === undefined ? undefined : Number(arguments_[2]);
  runSimulation(scenarioArgument as 1 | 2 | 3, queueSize, seedArgument);
}
