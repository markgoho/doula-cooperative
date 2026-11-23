import type { ReferralOutcome } from './referral.types';

/** Referral Outcome labels, in the order the pane offers them. */
export const OUTCOME_LABELS: Record<ReferralOutcome, string> = {
  hired: 'Hired',
  not_hired: 'Not hired',
  not_a_fit: 'Not a fit',
};

export const SERVICE_LABELS: Record<string, string> = {
  'birth-doula': 'Birth',
  'postpartum-doula': 'Postpartum',
  'lactation-support': 'Lactation',
  'childbirth-classes': 'Classes',
  'other-info-looking-for': 'Other',
};
