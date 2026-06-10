import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

export interface ReferralDueDate {
  month: string;
  day: string;
  year: string;
}

export interface ReferralListItem {
  id: string;
  submitted: string;
  estimatedDueDate: ReferralDueDate;
  services: string[];
  zipcode: string;
  birthLocation: string;
}

export interface ReferralDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  zipcode: string;
  estimatedDueDate: ReferralDueDate;
  services: string[];
  birthLocation: string;
  otherInfo: string;
  insurance: string[];
  submitted: string;
}

@Injectable({
  providedIn: 'root',
})
export class ReferralsService {
  private auth = inject(Auth);
  private http = inject(HttpClient);

  async listReferrals(): Promise<ReferralListItem[]> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in to view referrals.');

    const response = await firstValueFrom(
      this.http.get<{ referrals: ReferralListItem[] }>(`/api/members/${uid}/referrals`),
    );
    return response.referrals;
  }

  async getReferral(id: string): Promise<ReferralDetail> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in to view referrals.');

    return firstValueFrom(
      this.http.get<ReferralDetail>(`/api/members/${uid}/referrals/${id}`),
    );
  }
}
