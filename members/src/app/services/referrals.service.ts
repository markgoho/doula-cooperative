import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { auth } from '../lib/firebase';
import { MembershipRequiredError } from '../referrals/membership-required-error';
import { ReferralNotOpenError } from '../referrals/referral-not-open-error';
import { ReferralPortalDisabledError } from '../referrals/referral-portal-disabled-error';
import type {
  ReferralDetail,
  ReferralList,
  ReferralOutcome,
  ReferralOutcomeState,
  SentOutreach,
} from '../referrals/referral.types';

export type {
  ReferralDetail,
  ReferralList,
  ReferralListItem,
  ReferralOutcome,
  ReferralOutcomeState,
  SentOutreach,
} from '../referrals/referral.types';

const OUTCOME_SAVE_FAILED = "Your outcome wasn't saved. Please try again.";

const REFERRAL_PORTAL_DISABLED_CODE = 'REFERRAL_PORTAL_DISABLED';
const REFERRAL_NOT_OPEN_CODE = 'REFERRAL_NOT_OPEN';

function errorCode(error: HttpErrorResponse): unknown {
  const body: unknown = error.error;
  if (typeof body === 'object' && body !== null && 'code' in body) return body.code;
  return undefined;
}

function errorMessage(error: HttpErrorResponse): string | undefined {
  const body: unknown = error.error;
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string'
  )
    return body.error;
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

  async listReferrals(): Promise<ReferralList> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in to view referrals.');

    const memberId = encodeURIComponent(uid);
    try {
      const response = await firstValueFrom(
        this.http.get<Partial<ReferralList>>(`/api/members/${memberId}/referrals`),
      );
      return {
        referrals: response.referrals ?? [],
        showsAllReferrals: response.showsAllReferrals === true,
      };
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

  /**
   * Send your one Outreach on a Referral. Resolves once the email was accepted,
   * with the sent time and the requester's now-revealed contact details.
   * Rejects with a message to show beside the composer; nothing was shared.
   */
  async sendOutreach(id: string, message: string): Promise<SentOutreach> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in to send Outreach.');

    const memberId = encodeURIComponent(uid);
    const referralId = encodeURIComponent(id);
    try {
      return await firstValueFrom(
        this.http.post<SentOutreach>(`/api/members/${memberId}/referrals/${referralId}/outreach`, {
          message,
        }),
      );
    } catch (error: unknown) {
      console.error('Failed to send Outreach', { uid, id, error });
      if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
          throw new Error('Unable to connect. Check your network and try again.', {
            cause: error,
          });
        }
        if (error.status === 401) {
          throw new Error('Your session has expired. Please sign in again.', { cause: error });
        }
        const serverMessage = errorMessage(error);
        if (serverMessage) throw new Error(serverMessage, { cause: error });
      }
      throw new Error("Your message wasn't sent, and nothing was shared. Please try again.", {
        cause: error,
      });
    }
  }

  /**
   * Set or change your Referral Outcome on a Referral you reached out on.
   * Resolves with the saved Outcome and the current hired badge.
   */
  async setOutcome(id: string, outcome: ReferralOutcome): Promise<ReferralOutcomeState> {
    return this.saveOutcome(id, (url) => this.http.put<ReferralOutcomeState>(url, { outcome }));
  }

  /** Clear your Referral Outcome. Resolves with the current hired badge. */
  async clearOutcome(id: string): Promise<ReferralOutcomeState> {
    return this.saveOutcome(id, (url) => this.http.delete<ReferralOutcomeState>(url));
  }

  private async saveOutcome(
    id: string,
    request: (url: string) => Observable<ReferralOutcomeState>,
  ): Promise<ReferralOutcomeState> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in to record an outcome.');

    const memberId = encodeURIComponent(uid);
    const referralId = encodeURIComponent(id);
    try {
      return await firstValueFrom(
        request(`/api/members/${memberId}/referrals/${referralId}/outcome`),
      );
    } catch (error: unknown) {
      console.error('Failed to save Referral Outcome', { uid, id, error });
      if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
          throw new Error('Unable to connect. Check your network and try again.', {
            cause: error,
          });
        }
        if (error.status === 401) {
          throw new Error('Your session has expired. Please sign in again.', { cause: error });
        }
        const serverMessage = errorMessage(error);
        if (serverMessage) throw new Error(serverMessage, { cause: error });
      }
      throw new Error(OUTCOME_SAVE_FAILED, { cause: error });
    }
  }
}
