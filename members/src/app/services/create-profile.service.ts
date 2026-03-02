import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { type ProfileData } from '../types/profile-data';
import { MembershipService } from './membership.service';

/**
 * Handles profile creation (HTTP POST) and stores optimistic data.
 *
 * Separated from ProfileService so that the create-profile page can inject
 * this lightweight service without triggering ProfileService's profileResource,
 * which would fire a spurious GET for a profile that doesn't exist yet.
 *
 * ProfileService injects this service to read the optimistic data.
 */
@Injectable({
  providedIn: 'root',
})
export class CreateProfileService {
  private http = inject(HttpClient);
  private membershipService = inject(MembershipService);

  /**
   * Optimistic profile data set after successful creation.
   * Used to render the edit form immediately without waiting for GitHub API.
   */
  readonly optimisticProfile = signal<ProfileData | undefined>(undefined);

  clearOptimisticProfile(): void {
    this.optimisticProfile.set(undefined);
  }

  async createProfileContent(data: ProfileData): Promise<void> {
    const slug = this.membershipService.userDocument()?.slug;
    if (!slug) {
      throw new Error('User slug not found. Please refresh the page.');
    }

    try {
      await firstValueFrom(this.http.post<{ success: boolean }>(`/api/profiles/${slug}`, data));

      // Store submitted data as optimistic profile so the edit page can render
      // immediately without waiting for GitHub API eventual consistency.
      this.optimisticProfile.set(data);
    } catch (error: unknown) {
      console.error('Profile creation failed:', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401: {
            throw new Error('You must be signed in to create a profile.');
          }

          case 403: {
            if (error.error?.error?.includes('slug')) {
              throw new Error(
                'You must set up your profile slug first. Please return to the membership page.',
              );
            }
            if (error.error?.error?.includes('membership')) {
              throw new Error('Active membership required to create a profile.');
            }
            throw new Error('You do not have permission to create a profile.');
          }

          case 409: {
            throw new Error('Profile already exists. Try refreshing the page.');
          }

          case 429: {
            throw new Error('Too many requests. Please try again in a few minutes.');
          }

          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
        }
      }

      throw new Error('Failed to create profile. Please try again or contact support.');
    }
  }
}
