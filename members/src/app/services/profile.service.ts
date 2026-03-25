import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { buildImageKitDisplayUrl } from '../shared/profile-image-url';
import { type ProfileData } from '../types/profile-data';
import { MembershipService } from './membership.service';

const IMAGEKIT_BASE_URL = 'https://ik.imagekit.io/doulacoop';

interface ProfileResponse {
  success: true;
  profile?: ProfileData;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private http = inject(HttpClient);
  private membershipService = inject(MembershipService);

  /**
   * Whether the image actually exists on ImageKit (server-side check via HEAD request).
   * undefined = not yet checked, true = exists, false = 404.
   */
  private readonly imageExistsOnServer = signal<boolean | undefined>(undefined);

  private readonly imageCacheBust = signal(Date.now());

  /**
   * Whether profile loading has been requested.
   * Pages that need the profile (edit-profile, edit-profile-image) call loadProfile().
   * Pages that don't (create-profile) skip calling it, avoiding a spurious 404.
   */
  private readonly loadRequested = signal(false);

  constructor() {
    // TODO(2026-06-01): Remove this localStorage cleanup once all users have loaded the app at least once.
    // Clean up any leftover optimistic state from the old implementation
    try {
      localStorage.removeItem('optimisticProfileImage');
    } catch {
      // Ignore localStorage errors
    }

    // When profile loads, check if the image actually exists on ImageKit.
    // This detects "no custom image" even though the backend always sets profile.image.
    effect(() => {
      const profile = this.profile();
      const slug = this.membershipService.userDocument()?.slug;
      if (!profile?.image || !slug) return;

      // Track cache-bust so the effect re-runs after upload/delete
      this.imageCacheBust();

      this.checkImageExists(slug);
    });
  }

  /**
   * Request profile loading. Call this from components that need the profile data.
   * The resource won't fetch until this is called, preventing spurious 404s
   * on pages like /profile/create where the profile doesn't exist yet.
   */
  loadProfile(): void {
    this.loadRequested.set(true);
  }

  // Resource loads profile only after loadProfile() is called
  readonly profileResource = resource({
    params: () => {
      if (!this.loadRequested()) return;
      const user = this.membershipService.userDocument();
      // Only load if user has active membership and a slug
      return user?.membershipActive && user?.slug ? { slug: user.slug } : undefined;
    },
    loader: async ({ params }) => {
      return this.fetchProfileFromServer(params.slug);
    },
  });

  /** Profile data from the resource. */
  readonly profile = computed((): ProfileData | undefined => {
    return this.profileResource.hasValue() ? this.profileResource.value() : undefined;
  });

  /**
   * Display-ready profile image URL with ImageKit transformations and default fallback.
   * Includes a cache-busting version param after upload/delete to force a fresh CDN response.
   */
  readonly profileImageUrl = computed((): string | undefined => {
    const slug = this.membershipService.userDocument()?.slug;
    if (!slug) return undefined;

    const profile = this.profile();
    if (!profile) return undefined;

    return `${buildImageKitDisplayUrl(slug, 300, 300)}?v=${this.imageCacheBust()}`;
  });

  /**
   * Whether the user has a custom uploaded profile image (via HEAD check).
   * Defaults to true while checking to avoid flickering the "no image" UI.
   */
  readonly hasCustomImage = computed((): boolean => {
    const profile = this.profile();
    if (!profile) return false;

    return this.imageExistsOnServer() ?? true;
  });

  async updateProfile(data: ProfileData): Promise<void> {
    const slug = this.membershipService.userDocument()?.slug;
    if (!slug) {
      throw new Error('User slug not found. Please refresh the page.');
    }

    try {
      const response = await firstValueFrom(
        this.http.put<ProfileResponse>(`/api/profiles/${slug}`, data),
      );

      // Use response data directly to avoid extra Firestore round-trip
      if (response.profile) {
        this.profileResource.set(response.profile);
      } else {
        this.profileResource.reload();
      }
    } catch (error: unknown) {
      console.error('Profile update failed:', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401: {
            throw new Error('You must be signed in to update your profile.');
          }

          case 403: {
            if (error.error?.error?.includes('active membership')) {
              throw new Error('Active membership required to update profile.');
            }
            throw new Error('You do not have permission to update this profile.');
          }

          case 404: {
            throw new Error('Profile not found. Please create a profile first.');
          }

          case 409: {
            throw new Error('Profile was modified elsewhere. Please refresh and try again.');
          }

          case 429: {
            throw new Error('Too many requests. Please try again in a few minutes.');
          }

          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
        }
      }

      throw new Error('Failed to update profile. Please try again.');
    }
  }

  async createProfileContent(data: ProfileData): Promise<void> {
    const slug = this.membershipService.userDocument()?.slug;
    if (!slug) {
      throw new Error('User slug not found. Please refresh the page.');
    }

    try {
      const response = await firstValueFrom(
        this.http.post<ProfileResponse>(`/api/profiles/${slug}`, data),
      );

      // Use response data directly to avoid extra Firestore round-trip
      if (response.profile) {
        this.profileResource.set(response.profile);
      } else {
        this.profileResource.reload();
      }

      // Reload user document so profileCreatedAt is reflected in the header button
      this.membershipService.reloadUserDocument();
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

  private async fetchProfileFromServer(slug: string): Promise<ProfileData> {
    try {
      return await firstValueFrom(this.http.get<ProfileData>(`/api/profiles/${slug}`));
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        console.error('Profile not found (404):', {
          slug,
          status: error.status,
          errorBody: error.error,
          hint: 'If the profile exists but is draft, this may be a draft access control issue. Check that the auth token is being sent and that ownerUid matches.',
        });
      } else {
        console.error('Profile fetch failed:', {
          slug,
          error:
            error instanceof HttpErrorResponse
              ? { status: error.status, body: error.error }
              : String(error),
        });
      }
      throw error;
    }
  }

  getTagUrl(tag: string): string {
    return tag.toLowerCase().replaceAll(/\s+/g, '-');
  }

  /**
   * Upload a profile image.
   * The server will upload to ImageKit and update the profile.
   * @param file - The image file to upload
   */
  async uploadProfileImage(file: File): Promise<void> {
    const slug = this.membershipService.userDocument()?.slug;
    if (!slug) {
      throw new Error('User slug not found. Please refresh the page.');
    }

    try {
      // Convert file to base64
      const imageData = await this.fileToBase64(file);

      await firstValueFrom(
        this.http.post<{ success: boolean; url: string }>(`/api/profiles/${slug}/image`, {
          imageData,
          mimeType: file.type,
        }),
      );

      // Image is now on ImageKit — set timestamp to bust CDN + browser cache
      this.imageCacheBust.set(Date.now());
      this.imageExistsOnServer.set(true);
    } catch (error: unknown) {
      console.error('Profile image upload failed:', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401: {
            throw new Error('You must be signed in to upload a profile image.');
          }

          case 413: {
            throw new Error('Image too large. Maximum size is 10MB.');
          }

          case 428: {
            if (error.error?.error?.includes('slug')) {
              throw new Error('Please set up your profile first.');
            }
            throw new Error('Profile setup required to upload an image.');
          }

          case 429: {
            throw new Error('Too many requests. Please try again in a few minutes.');
          }

          case 403: {
            if (error.error?.error?.includes('membership')) {
              throw new Error('Active membership required to upload a profile image.');
            }
            throw new Error('You do not have permission to upload a profile image.');
          }

          case 409: {
            throw new Error('Profile was modified by another operation. Please try again.');
          }

          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
        }
      }

      throw new Error('Failed to upload profile image. Please try again.');
    }
  }

  /**
   * Delete the profile image.
   */
  async deleteProfileImage(): Promise<void> {
    const slug = this.membershipService.userDocument()?.slug;
    if (!slug) {
      throw new Error('User slug not found. Please refresh the page.');
    }

    try {
      await firstValueFrom(this.http.delete<{ success: boolean }>(`/api/profiles/${slug}/image`));

      // Image is now deleted — set timestamp to bust CDN + browser cache
      this.imageCacheBust.set(Date.now());
      this.imageExistsOnServer.set(false);
    } catch (error: unknown) {
      console.error('Profile image delete failed:', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401: {
            throw new Error('You must be signed in to delete your profile image.');
          }

          case 428: {
            if (error.error?.error?.includes('slug')) {
              throw new Error('Please set up your profile first.');
            }
            throw new Error('Profile setup required to delete an image.');
          }

          case 429: {
            throw new Error('Too many requests. Please try again in a few minutes.');
          }

          case 403: {
            if (error.error?.error?.includes('membership')) {
              throw new Error('Active membership required to delete your profile image.');
            }
            throw new Error('You do not have permission to delete a profile image.');
          }

          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
        }
      }

      throw new Error('Failed to delete profile image. Please try again.');
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        resolve(reader.result as string);
      });
      reader.addEventListener('error', () => {
        reject(new Error('Failed to read file'));
      });
      reader.readAsDataURL(file);
    });
  }

  private checkImageExists(slug: string): void {
    const url = `${IMAGEKIT_BASE_URL}/doulas/${slug}/${slug}-profile?v=${this.imageCacheBust()}`;
    this.imageExistsOnServer.set(undefined);

    void fetch(url, { method: 'HEAD' }).then(
      (response) => this.imageExistsOnServer.set(response.ok),
      () => this.imageExistsOnServer.set(undefined),
    );
  }
}
