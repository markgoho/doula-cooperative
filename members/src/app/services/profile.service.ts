import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { type ProfileData } from '../types/profile-data';
import { CreateProfileService } from './create-profile.service';
import { MembershipService } from './membership.service';

const IMAGEKIT_BASE_URL = 'https://ik.imagekit.io/doulacoop';

/**
 * Build an ImageKit display URL with transformations and default image fallback.
 * Matches the Hugo site's URL pattern so missing images show a default placeholder.
 */
function buildImageKitDisplayUrl(slug: string, width: number, height: number): string {
  return `${IMAGEKIT_BASE_URL}/tr:w-${width},h-${height},fo-face,z-0.5,di-default-profile.png/doulas/${slug}/${slug}-profile`;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private http = inject(HttpClient);
  private membershipService = inject(MembershipService);
  private createProfileService = inject(CreateProfileService);

  /**
   * Whether the image actually exists on ImageKit (server-side check via HEAD request).
   * undefined = not yet checked, true = exists, false = 404.
   */
  private readonly imageExistsOnServer = signal<boolean | undefined>(undefined);

  private readonly imageCacheBust = signal(Date.now());

  constructor() {
    // Clean up any leftover optimistic state from the old implementation
    try {
      localStorage.removeItem('optimisticProfileImage');
    } catch {
      // Ignore localStorage errors
    }

    // Clear optimistic data once the resource successfully loads from the server
    effect(() => {
      if (this.profileResource.hasValue()) {
        this.createProfileService.clearOptimisticProfile();
      }
    });

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

  // Resource automatically loads profile based on membership status
  readonly profileResource = resource({
    params: () => {
      const user = this.membershipService.userDocument();
      // Only load if user has active membership and a slug
      return user?.membershipActive && user?.slug ? { slug: user.slug } : undefined;
    },
    loader: async ({ params }) => {
      return this.fetchProfileFromServer(params.slug);
    },
  });

  /** Profile data — prefers optimistic data after creation, falls back to server data. */
  readonly profile = computed((): ProfileData | undefined => {
    return (
      this.createProfileService.optimisticProfile() ??
      (this.profileResource.hasValue() ? this.profileResource.value() : undefined)
    );
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
      await firstValueFrom(this.http.put<{ success: boolean }>(`/api/profiles/${slug}`, data));

      // Set optimistic data so the form shows submitted values even if
      // the reload 404s due to GitHub eventual consistency.
      this.createProfileService.optimisticProfile.set(data);
      this.profileResource.reload();
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

  private async fetchProfileFromServer(slug: string): Promise<ProfileData> {
    return firstValueFrom(this.http.get<ProfileData>(`/api/profiles/${slug}`));
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
