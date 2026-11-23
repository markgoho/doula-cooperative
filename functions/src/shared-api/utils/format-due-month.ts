const MONTH_ABBREVIATIONS: Record<string, string> = {
  "1": "Jan",
  "2": "Feb",
  "3": "Mar",
  "4": "Apr",
  "5": "May",
  "6": "Jun",
  "7": "Jul",
  "8": "Aug",
  "9": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dec",
};

/**
 * Formats an estimated due date as month and year only (e.g. "Mar 2027").
 *
 * Omits the day so notification emails never carry a full due date.
 * Never throws: an unrecognized month falls back to the year alone.
 */
export function formatDueMonth({
  month,
  year,
}: {
  month: string;
  year: string;
}): string {
  const normalizedMonth = String(Math.trunc(Number(month)));
  const abbreviation = MONTH_ABBREVIATIONS[normalizedMonth];

  if (abbreviation === undefined) {
    return year;
  }

  return `${abbreviation} ${year}`;
}
