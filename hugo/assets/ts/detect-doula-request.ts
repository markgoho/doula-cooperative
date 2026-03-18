const strongSignals = [
  "doula",
  "birth support",
  "postpartum support",
  "birth worker",
  "find a doula",
  "looking for a doula",
  "need a doula",
  "hire a doula",
];

const weakSignals = [
  "pregnant",
  "pregnancy",
  "due date",
  "expecting",
  "birth",
  "labor",
  "delivery",
  "postpartum",
  "midwife",
  "midwifery",
  "birthing",
  "prenatal",
  "newborn",
  "lactation",
  "breastfeeding",
  "c-section",
  "cesarean",
  "contractions",
  "trimester",
];

function escapeRegex(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

export function detectDoulaRequest(text: string): boolean {
  const normalizedText = text.toLowerCase();

  if (strongSignals.some(signal => normalizedText.includes(signal))) {
    return true;
  }

  const weakMatchCount = weakSignals.filter(signal => {
    const pattern = new RegExp(String.raw`\b${escapeRegex(signal)}\b`, "i");
    return pattern.test(normalizedText);
  }).length;

  return weakMatchCount >= 2;
}
