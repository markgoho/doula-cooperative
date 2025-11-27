export interface DueDate {
  month: string;
  day: string;
  year: string;
}

export function isValidDueDate(dueDate: DueDate | undefined | null): boolean {
  if (!dueDate || !dueDate.month || !dueDate.day || !dueDate.year) {
    return false;
  }
  const month = Number.parseInt(dueDate.month, 10);
  const day = Number.parseInt(dueDate.day, 10);
  const year = Number.parseInt(dueDate.year, 10);
  return !Number.isNaN(month) && !Number.isNaN(day) && !Number.isNaN(year);
}

export function parseDueDate(dueDate: DueDate): Date {
  // Month is 1-based in the form, but Date() expects 0-based months
  const month = Number.parseInt(dueDate.month, 10) - 1;
  const day = Number.parseInt(dueDate.day, 10);
  const year = Number.parseInt(dueDate.year, 10);
  return new Date(year, month, day);
}

export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
