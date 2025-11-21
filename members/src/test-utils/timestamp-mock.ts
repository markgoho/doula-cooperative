/**
 * Mock Timestamp class to avoid loading @angular/fire during tests.
 * This prevents the Angular Fire JIT compilation error.
 * Implements the same interface as Firebase Firestore Timestamp.
 */
export class Timestamp {
  constructor(
    public seconds: number,
    public nanoseconds: number,
  ) {}

  static fromDate(date: Date): Timestamp {
    const milliseconds = date.getTime();
    return new Timestamp(
      Math.floor(milliseconds / 1000),
      (milliseconds % 1000) * 1_000_000,
    );
  }

  static now(): Timestamp {
    return Timestamp.fromDate(new Date());
  }

  toDate(): Date {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1_000_000);
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1_000_000);
  }

  isEqual(other: Timestamp): boolean {
    return this.seconds === other.seconds && this.nanoseconds === other.nanoseconds;
  }

  toJSON(): { seconds: number; nanoseconds: number; type: string } {
    return {
      seconds: this.seconds,
      nanoseconds: this.nanoseconds,
      type: 'timestamp',
    };
  }

  valueOf(): string {
    return `Timestamp(seconds=${this.seconds}, nanoseconds=${this.nanoseconds})`;
  }
}
