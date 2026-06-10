import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import type { MatchRequest } from '../admin/admin.types';

export type ReferralDueDate = MatchRequest['estimatedDueDate'];

export type ReferralListItem = Pick<
  MatchRequest,
  'id' | 'submitted' | 'estimatedDueDate' | 'services' | 'zipcode' | 'birthLocation'
>;

export type ReferralDetail = Omit<MatchRequest, 'sent' | 'recaptchaScore'>;

@Injectable({
  providedIn: 'root',
})
export class ReferralsService {
  private auth = inject(Auth);
  private http = inject(HttpClient);

  async listReferrals(): Promise<ReferralListItem[]> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in to view referrals.');

    try {
      const response = await firstValueFrom(
        this.http.get<{ referrals: ReferralListItem[] }>(`/api/members/${uid}/referrals`),
      );
      return response.referrals;
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
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
      throw new Error('Failed to load referrals. Please try again.');
    }
  }

  async getReferral(id: string): Promise<ReferralDetail> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in to view referrals.');

    try {
      return await firstValueFrom(
        this.http.get<ReferralDetail>(`/api/members/${uid}/referrals/${id}`),
      );
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 403: {
            throw new Error(
              'Your membership is not currently active. Renew your membership to view referrals.',
            );
          }
          case 404: {
            throw new Error('Referral not found.');
          }
        }
      }
      throw new Error('Failed to load referral. Please try again.');
    }
  }
}
