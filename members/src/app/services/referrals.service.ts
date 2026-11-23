import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { auth } from '../lib/firebase';
import { MembershipRequiredError } from '../referrals/membership-required-error';
import { ReferralNotOpenError } from '../referrals/referral-not-open-error';
import { ReferralPortalDisabledError } from '../referrals/referral-portal-disabled-error';
import type { ReferralDetail, ReferralListItem } from '../referrals/referral.types';

export type { ReferralDetail, ReferralListItem } from '../referrals/referral.types';

const REFERRAL_PORTAL_DISABLED_CODE = 'REFERRAL_PORTAL_DISABLED';
const REFERRAL_NOT_OPEN_CODE = 'REFERRAL_NOT_OPEN';

function errorCode(error: HttpErrorResponse): unknown {
  const body: unknown = error.error;
  if (typeof body === 'object' && body !== null && 'code' in body) return body.code;
  return undefined;
}

function forbiddenError(error: HttpErrorResponse): Error {
  if (errorCode(error) === REFERRAL_PORTAL_DISABLED_CODE) {
    return new ReferralPortalDisabledError({ cause: error });
  }
  return new MembershipRequiredError({ cause: error });
}

@Service()
export class ReferralsService {
  private http = inject(HttpClient);

  async listReferrals(): Promise<ReferralListItem[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in to view referrals.');

    const memberId = encodeURIComponent(uid);
    try {
      const response = await firstValueFrom(
        this.http.get<{ referrals: ReferralListItem[] }>(`/api/members/${memberId}/referrals`),
      );
      return response.referrals;
    } catch (error: unknown) {
      console.error('Failed to load referrals', { uid, error });
      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 0: {
            throw new Error('Unable to connect. Check your network and try again.', {
              cause: error,
            });
          }
          case 401: {
            throw new Error('Your session has expired. Please sign in again.', { cause: error });
          }
          case 403: {
            throw forbiddenError(error);
          }
          case 404: {
            throw new Error('Member account not found. Please contact support.', { cause: error });
          }
        }
      }
      throw new Error('Failed to load referrals. Please try again.', { cause: error });
    }
  }

  async getReferral(id: string): Promise<ReferralDetail> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in to view referrals.');

    const memberId = encodeURIComponent(uid);
    const referralId = encodeURIComponent(id);
    try {
      return await firstValueFrom(
        this.http.get<ReferralDetail>(`/api/members/${memberId}/referrals/${referralId}`),
      );
    } catch (error: unknown) {
      console.error('Failed to load referral', { uid, id, error });
      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 0: {
            throw new Error('Unable to connect. Check your network and try again.', {
              cause: error,
            });
          }
          case 401: {
            throw new Error('Your session has expired. Please sign in again.', { cause: error });
          }
          case 403: {
            throw forbiddenError(error);
          }
          case 404: {
            if (errorCode(error) === REFERRAL_NOT_OPEN_CODE) {
              throw new ReferralNotOpenError({ cause: error });
            }
            throw new Error('Referral not found.', { cause: error });
          }
          case 422: {
            throw new Error('Invalid referral link. Please check the URL and try again.', {
              cause: error,
            });
          }
        }
      }
      throw new Error('Failed to load referral. Please try again.', { cause: error });
    }
  }
}
