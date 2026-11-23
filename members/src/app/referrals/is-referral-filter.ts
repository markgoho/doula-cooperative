import type { CanMatchFn } from '@angular/router';
import { REFERRAL_FILTER_SLUGS } from './referral.constants';
import type { ReferralFilter } from './referral.types';

/**
 * Matches `/referrals/:filter` only for a known filter slug, so a legacy
 * `/referrals/:id` link falls through to its redirect.
 */
export const isReferralFilter: CanMatchFn = (_route, segments) =>
  REFERRAL_FILTER_SLUGS.includes(segments[0]?.path as ReferralFilter);
