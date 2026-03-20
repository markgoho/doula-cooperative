const COMMON_NAME_PARTS = new Set([
  "anna",
  "anne",
  "beth",
  "brown",
  "chris",
  "david",
  "doe",
  "emma",
  "jane",
  "john",
  "joseph",
  "kate",
  "lee",
  "mary",
  "michael",
  "mike",
  "rose",
  "sarah",
  "smith",
  "test",
]);

const COMMON_MESSAGE_WORDS = new Set([
  "about",
  "birth",
  "care",
  "contact",
  "doula",
  "help",
  "hello",
  "looking",
  "message",
  "need",
  "postpartum",
  "pregnancy",
  "question",
  "support",
  "thanks",
]);

function getWords({ text }: { text: string }): string[] {
  return text
    .split(/[^A-Za-z]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}

function getVowelRatio({ text }: { text: string }): number | undefined {
  let letterCount = 0;
  let vowelCount = 0;

  for (const character of text) {
    if (!/[A-Za-z]/.test(character)) {
      continue;
    }

    letterCount += 1;
    if (/[AEIOUaeiou]/.test(character)) {
      vowelCount += 1;
    }
  }

  if (letterCount === 0) {
    return undefined;
  }

  return vowelCount / letterCount;
}

function hasMixedCaseMidWord({ word }: { word: string }): boolean {
  if (word.length < 8) {
    return false;
  }

  let hasUppercaseBeyondFirstCharacter = false;
  for (const character of word.slice(1)) {
    if (/[A-Z]/.test(character)) {
      hasUppercaseBeyondFirstCharacter = true;
      break;
    }
  }

  const hasLowercase = /[a-z]/.test(word);

  return hasUppercaseBeyondFirstCharacter && hasLowercase;
}

function hasRecognizableWord({
  words,
  dictionary,
}: {
  words: string[];
  dictionary: Set<string>;
}): boolean {
  return words.some((word) => dictionary.has(word.toLowerCase()));
}

function getConsonantClusterRatio({ words }: { words: string[] }): number {
  if (words.length === 0) {
    return 0;
  }

  const clusteredWords = words.filter((word) =>
    /[bcdfghjklmnpqrstvwxyz]{3,}/i.test(word),
  );
  return clusteredWords.length / words.length;
}

export function detectGibberish({ text }: { text: string }): boolean {
  const normalizedText = text.trim();
  if (normalizedText.length === 0) {
    return false;
  }

  const words = getWords({ text: normalizedText });
  if (words.length === 0) {
    return false;
  }

  const consonantClusterRatio = getConsonantClusterRatio({ words });
  const vowelRatio = getVowelRatio({ text: normalizedText });
  const mixedCaseWordCount = words.filter((word) =>
    hasMixedCaseMidWord({ word }),
  ).length;
  const hasNameWord = hasRecognizableWord({
    words,
    dictionary: COMMON_NAME_PARTS,
  });
  const hasMessageWord = hasRecognizableWord({
    words,
    dictionary: COMMON_MESSAGE_WORDS,
  });
  const firstWord = words[0];
  const longSingleWord =
    words.length === 1 && firstWord !== undefined && firstWord.length >= 12;

  if (
    longSingleWord &&
    mixedCaseWordCount > 0 &&
    consonantClusterRatio >= 1
  ) {
    return true;
  }

  if (
    consonantClusterRatio >= 0.6 &&
    vowelRatio !== undefined &&
    (vowelRatio < 0.15 || vowelRatio > 0.6) &&
    !hasNameWord &&
    !hasMessageWord
  ) {
    return true;
  }

  return false;
}
