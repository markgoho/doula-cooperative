import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { auth } from '../lib/firebase';
import type { MatchRequest } from '../admin/admin.types';

export type ReferralDueDate = MatchRequest['estimatedDueDate'];

export type ReferralListItem = Pick<
  MatchRequest,
  'id' | 'submitted' | 'estimatedDueDate' | 'services' | 'zipcode' | 'birthLocation'
>;

export type ReferralDetail = Pick<
  MatchRequest,
  | 'id'
  | 'name'
  | 'email'
  | 'phone'
  | 'zipcode'
  | 'estimatedDueDate'
  | 'services'
  | 'birthLocation'
  | 'otherInfo'
  | 'insurance'
  | 'submitted'
>;

@Injectable({
  providedIn: 'root',
})
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
            throw new Error('Unable to connect. Check your network and try again.');
          }
          case 401: {
            throw new Error('Your session has expired. Please sign in again.');
          }
          case 403: {
            throw new Error(
              'Your membership is not currently active. Renew your membership to view referrals.',
            );
          }
          case 404: {
            throw new Error('Member account not found. Please contact support.');
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
            throw new Error('Unable to connect. Check your network and try again.');
          }
          case 401: {
            throw new Error('Your session has expired. Please sign in again.');
          }
          case 403: {
            throw new Error(
              'Your membership is not currently active. Renew your membership to view referrals.',
            );
          }
          case 404: {
            throw new Error('Referral not found.');
          }
          case 422: {
            throw new Error('Invalid referral link. Please check the URL and try again.');
          }
        }
      }
      throw new Error('Failed to load referral. Please try again.', { cause: error });
    }
  }
}
