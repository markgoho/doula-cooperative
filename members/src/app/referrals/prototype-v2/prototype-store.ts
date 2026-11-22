// PROTOTYPE — throwaway. Referral Portal v2 UI prototype (map #100, ticket #107).
// In-memory stub state only. No backend, no persistence. Fake people only.
import { Injectable, computed, signal } from '@angular/core';

export type Outcome = 'hired' | 'not-hired' | 'not-a-fit';

export interface PrototypeReferral {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  due: { month: number; day: number; year: number };
  services: string[];
  zipcode: string;
  area: string;
  birthLocation: string;
  costOffset: string[];
  notes: string;
  spanish: boolean;
  submittedDaysAgo: number;
  othersReachedOut: number;
  othersHired: boolean;
  myOutreach?: { sentAt: string; message: string } | undefined;
  myOutcome?: { value: Outcome; updatedAt: string } | undefined;
}

export const OUTCOME_LABELS: Record<Outcome, string> = {
  hired: 'Hired me',
  'not-hired': 'Did not hire me',
  'not-a-fit': 'Not a fit',
};

export const PROTO_SERVICE_LABELS: Record<string, string> = {
  'birth-doula': 'Birth',
  'postpartum-doula': 'Postpartum',
  'lactation-support': 'Lactation',
  'childbirth-classes': 'Classes',
};

export const PROTO_MEMBER = {
  name: 'Jamie Rivera',
  email: 'jamie@example.com',
  profileUrl: 'https://doulacooperative.com/doulas/jamie-rivera/',
};

const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const seed = (): PrototypeReferral[] => [
  {
    id: 'r1',
    firstName: 'Maya',
    lastName: 'Okafor',
    email: 'maya.o@example.com',
    phone: '(718) 555-0101',
    due: { month: 4, day: 12, year: 2027 },
    services: ['birth-doula', 'postpartum-doula'],
    zipcode: '11215',
    area: 'Brooklyn, NY',
    birthLocation: 'NYU Langone Brooklyn',
    costOffset: ['Medicaid'],
    notes: 'First baby. Hoping for an unmedicated birth if possible.',
    spanish: false,
    submittedDaysAgo: 1,
    othersReachedOut: 0,
    othersHired: false,
  },
  {
    id: 'r2',
    firstName: 'Priya',
    lastName: 'Shah',
    email: 'priya.s@example.com',
    phone: '(917) 555-0102',
    due: { month: 2, day: 3, year: 2027 },
    services: ['birth-doula'],
    zipcode: '10025',
    area: 'New York, NY',
    birthLocation: 'Home birth',
    costOffset: ['Private insurance'],
    notes: '',
    spanish: false,
    submittedDaysAgo: 4,
    othersReachedOut: 3,
    othersHired: false,
  },
  {
    id: 'r3',
    firstName: 'Jordan',
    lastName: 'Lee',
    email: 'jordan.l@example.com',
    phone: '(347) 555-0103',
    due: { month: 12, day: 20, year: 2026 },
    services: ['birth-doula', 'lactation-support'],
    zipcode: '11375',
    area: 'Forest Hills, NY',
    birthLocation: 'Long Island Jewish Forest Hills',
    costOffset: [],
    notes: 'Due soon — would love someone who can start right away.',
    spanish: false,
    submittedDaysAgo: 8,
    othersReachedOut: 4,
    othersHired: true,
  },
  {
    id: 'r4',
    firstName: 'Ana',
    lastName: 'Morales',
    email: 'ana.m@example.com',
    phone: '(718) 555-0104',
    due: { month: 5, day: 30, year: 2027 },
    services: ['postpartum-doula'],
    zipcode: '10458',
    area: 'Bronx, NY',
    birthLocation: 'Montefiore',
    costOffset: ['Medicaid'],
    notes: 'Prefiero hablar en español.',
    spanish: true,
    submittedDaysAgo: 6,
    othersReachedOut: 1,
    othersHired: false,
    myOutreach: { sentAt: daysAgoIso(5), message: '(sent message, BCC copy in your inbox)' },
  },
  {
    id: 'r5',
    firstName: 'Leah',
    lastName: 'Cohen',
    email: 'leah.c@example.com',
    phone: '(646) 555-0105',
    due: { month: 3, day: 8, year: 2027 },
    services: ['birth-doula', 'childbirth-classes'],
    zipcode: '11201',
    area: 'Brooklyn, NY',
    birthLocation: 'Brooklyn Birthing Center',
    costOffset: ['Self-pay'],
    notes: '',
    spanish: false,
    submittedDaysAgo: 11,
    othersReachedOut: 2,
    othersHired: false,
    myOutreach: { sentAt: daysAgoIso(10), message: '(sent message, BCC copy in your inbox)' },
    myOutcome: { value: 'not-hired', updatedAt: daysAgoIso(3) },
  },
  {
    id: 'r6',
    firstName: 'Sam',
    lastName: 'Alvarez',
    email: 'sam.a@example.com',
    phone: '(929) 555-0106',
    due: { month: 1, day: 15, year: 2027 },
    services: ['birth-doula'],
    zipcode: '11103',
    area: 'Astoria, NY',
    birthLocation: 'Mount Sinai Queens',
    costOffset: ['Private insurance'],
    notes: '',
    spanish: false,
    submittedDaysAgo: 34,
    othersReachedOut: 2,
    othersHired: false,
    myOutreach: { sentAt: daysAgoIso(33), message: '(sent message, BCC copy in your inbox)' },
    myOutcome: { value: 'hired', updatedAt: daysAgoIso(25) },
  },
  {
    id: 'r7',
    firstName: 'Taylor',
    lastName: 'Nguyen',
    email: 'taylor.n@example.com',
    phone: '(718) 555-0107',
    due: { month: 2, day: 22, year: 2027 },
    services: ['birth-doula'],
    zipcode: '11220',
    area: 'Brooklyn, NY',
    birthLocation: 'Maimonides',
    costOffset: [],
    notes: '',
    spanish: false,
    submittedDaysAgo: 20,
    othersReachedOut: 1,
    othersHired: false,
  },
];

@Injectable({ providedIn: 'root' })
export class PrototypeStore {
  readonly referrals = signal<PrototypeReferral[]>(seed());
  readonly failNextSend = signal(false);

  readonly open = computed(() => this.referrals().filter((r) => r.submittedDaysAgo <= 14));
  readonly mine = computed(() => this.referrals().filter((r) => r.myOutreach));
  readonly needsOutcome = computed(() => this.mine().filter((r) => !r.myOutcome));

  byId(id: string | undefined) {
    return this.referrals().find((r) => r.id === id);
  }

  reset() {
    this.referrals.set(seed());
    this.failNextSend.set(false);
  }

  async sendOutreach(id: string, message: string) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (this.failNextSend()) {
      this.failNextSend.set(false);
      throw new Error('Mailgun rejected the send');
    }
    this.patch(id, { myOutreach: { sentAt: new Date().toISOString(), message } });
  }

  setOutcome(id: string, value: Outcome | undefined) {
    this.patch(id, {
      myOutcome: value ? { value, updatedAt: new Date().toISOString() } : undefined,
    });
  }

  private patch(id: string, changes: Partial<PrototypeReferral>) {
    this.referrals.update((list) => list.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }
}

// Derived view helpers shared by variants.
export const reachedOutCount = (r: PrototypeReferral) =>
  r.othersReachedOut + (r.myOutreach ? 1 : 0);
export const hasHiredBadge = (r: PrototypeReferral) =>
  r.othersHired || r.myOutcome?.value === 'hired';
export const isExpiredForMe = (r: PrototypeReferral) => r.submittedDaysAgo > 14 && !r.myOutreach;
export const dueLabel = (r: PrototypeReferral) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(r.due.year, r.due.month - 1, r.due.day),
  );
export const submittedLabel = (r: PrototypeReferral) => {
  if (r.submittedDaysAgo === 0) return 'Today';
  if (r.submittedDaysAgo === 1) return 'Yesterday';
  return `${r.submittedDaysAgo} days ago`;
};
export const daysLeftLabel = (r: PrototypeReferral) => {
  const left = 14 - r.submittedDaysAgo;
  if (left <= 0) return 'Closed to new Outreach';
  return `Open ${left} more ${left === 1 ? 'day' : 'days'}`;
};
export const servicesLabel = (r: PrototypeReferral) =>
  r.services.map((s) => PROTO_SERVICE_LABELS[s] ?? s).join(', ');
export const reachedOutLabel = (r: PrototypeReferral) => {
  const n = reachedOutCount(r);
  if (n === 0) return 'No one has reached out yet';
  return `${n} ${n === 1 ? 'member' : 'members'} reached out`;
};
export const defaultMessage = (r: PrototypeReferral) =>
  `Hi ${r.firstName},

I'm ${PROTO_MEMBER.name}, a doula with the Doula Cooperative. I saw your request for ${servicesLabel(r).toLowerCase()} support around ${dueLabel(r)} and I'd love to talk about how I can help.

You can read more about me here: ${PROTO_MEMBER.profileUrl}

Just reply to this email, or let me know a good time to call.

Warmly,
${PROTO_MEMBER.name}`;
