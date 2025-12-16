import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { load } from 'js-yaml';
import { firstValueFrom } from 'rxjs';
import { type CropData } from '../types/crop-data';
import { isFirebaseFunctionsError } from '../types/firebase-error';
import { type ProfileData, type ProfileFrontMatter } from '../types/profile-data';
import { MembershipService } from './membership.service';

// Re-export for consumers
export type { CropData } from '../types/crop-data';

interface UploadProfileImageRequest {
  imageData: string;
  mimeType: string;
  cropData: CropData;
}

/** Optimistic state for image uploads - stores the preview URL */
interface OptimisticImageUpload {
  url: string;
  slug: string;
}

/** Optimistic state for image deletions */
interface OptimisticImageDelete {
  deleted: true;
  slug: string;
}

type OptimisticImageState = OptimisticImageUpload | OptimisticImageDelete | undefined;

const OPTIMISTIC_IMAGE_KEY = 'optimisticProfileImage';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private http = inject(HttpClient);
  private functions = inject(Functions);
  private membershipService = inject(MembershipService);

  /**
   * Optimistic image state - stores preview URL after upload or deleted flag after delete.
   * Persisted to localStorage for cross-refresh persistence, auto-cleared when backend catches up.
   */
  private readonly optimisticImage = signal<OptimisticImageState>(this.loadOptimisticState());

  // Resource automatically loads profile based on membership status
  readonly profileResource = resource({
    params: () => {
      const user = this.membershipService.userDocument();
      // Only load if user has active membership and a slug
      return user?.membershipActive && user?.slug ? { slug: user.slug } : undefined;
    },
    loader: async () => {
      const result = await this.fetchProfileFromServer();
      const profileData = this.parseProfileContent(result.content);
      const userSlug = this.membershipService.userDocument()?.slug;

      // Use the image URL directly from the backend
      if (profileData && result.image) {
        profileData.image = result.image;

        // Backend has image - clear optimistic upload state only if it's for the current user
        // This prevents clearing state when viewing a different user's profile
        const optimistic = this.optimisticImage();
        if (optimistic && 'url' in optimistic && optimistic.slug === userSlug) {
          this.saveOptimisticState(undefined);
        }
      } else if (profileData && !result.image) {
        // Backend confirms no image - clear optimistic delete state only if it's for the current user
        // This prevents clearing state when viewing a different user's profile
        const optimistic = this.optimisticImage();
        if (optimistic && 'deleted' in optimistic && optimistic.slug === userSlug) {
          this.saveOptimisticState(undefined);
        }
      }

      return profileData;
    },
  });

  /**
   * Computed profile that merges optimistic image state with server data.
   * Optimistic state takes precedence until the backend catches up.
   */
  readonly profile = computed((): ProfileData | undefined => {
    const serverProfile = this.profileResource.hasValue() ? this.profileResource.value() : undefined;
    if (!serverProfile) return undefined;

    const optimistic = this.optimisticImage();
    const userSlug = this.membershipService.userDocument()?.slug;

    // Only apply optimistic state if it matches current user's slug
    if (optimistic && optimistic.slug === userSlug) {
      if ('deleted' in optimistic) {
        // Remove the image for delete state
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { image: _, ...profileWithoutImage } = serverProfile;
        return profileWithoutImage as ProfileData;
      }
      return { ...serverProfile, image: optimistic.url };
    }

    return serverProfile;
  });

  async updateProfile(data: ProfileData): Promise<void> {
    try {
      await firstValueFrom(this.http.put<{ success: boolean }>('/api/profiles/me', data));

      // Only reload on success
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

  async createProfileContent(data: ProfileData): Promise<void> {
    try {
      await firstValueFrom(this.http.post<{ success: boolean }>('/api/profiles/me', data));

      // Only reload on success
      this.profileResource.reload();
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

  private async fetchProfileFromServer(): Promise<{ content: string; image?: string }> {
    return firstValueFrom(this.http.get<{ content: string; image?: string }>('/api/profiles/me'));
  }

  private parseProfileContent(content: string): ProfileData | undefined {
    // Parse front matter (YAML between --- markers)
    const frontMatterMatch = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(content);

    if (!frontMatterMatch) {
      console.error('No front matter found in profile content');
      throw new Error('Profile data is corrupted. Please contact support.');
    }

    const [, frontMatter, bodyContent] = frontMatterMatch;

    if (!frontMatter || bodyContent === undefined) {
      console.error('Invalid front matter format');
      throw new Error('Profile data format is invalid. Please contact support.');
    }

    // Parse YAML front matter with proper typing
    const parsed = load(frontMatter) as ProfileFrontMatter;

    // Build ProfileData object from parsed YAML
    const data: ProfileData = {
      title: parsed.title ?? '',
      bio: bodyContent.trim(),
      draft: parsed.draft ?? false,
    };

    if (parsed.credentials) {
      data.credentials = parsed.credentials;
    }

    if (parsed.pronouns) {
      data.pronouns = parsed.pronouns;
    }

    if (parsed.tags) {
      data.tags = parsed.tags;
    }

    if (parsed.contact) {
      data.contact = parsed.contact;
    }

    return data;
  }

  getTagUrl(tag: string): string {
    return tag.toLowerCase().replaceAll(/\s+/g, '-');
  }

  /**
   * Upload a profile image with crop data.
   * The server will apply the crop and save the image.
   * @param file - The image file to upload
   * @param cropData - Crop coordinates and zoom
   * @param previewUrl - Optional preview URL for optimistic display
   */
  async uploadProfileImage(file: File, cropData: CropData, previewUrl?: string): Promise<void> {
    const uploadCallable = httpsCallable<UploadProfileImageRequest, { success: boolean }>(
      this.functions,
      'uploadProfileImage',
    );

    try {
      // Convert file to base64
      const imageData = await this.fileToBase64(file);

      await uploadCallable({
        imageData,
        mimeType: file.type,
        cropData,
      });

      // Set optimistic state for immediate display
      const slug = this.membershipService.userDocument()?.slug;
      if (previewUrl && slug) {
        this.saveOptimisticState({ url: previewUrl, slug });
      }

      // Reload profile - will auto-clear optimistic state when backend catches up
      this.profileResource.reload();
    } catch (error: unknown) {
      console.error('Profile image upload failed:', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (isFirebaseFunctionsError(error)) {
        const errorMessages: Record<string, string> = {
          'unauthenticated': 'You must be signed in to upload a profile image.',
          'invalid-argument': error.message || 'Invalid image. Please try a different file.',
          'resource-exhausted': 'Too many requests. Please try again in a few minutes.',
        };

        if (error.code === 'failed-precondition') {
          if (error.message.includes('membership')) {
            throw new Error('Active membership required to upload a profile image.');
          }
          if (error.message.includes('slug')) {
            throw new Error('Please set up your profile first.');
          }
          console.warn('Unhandled failed-precondition:', error.message);
          throw new Error(error.message || 'A precondition for this operation was not met.');
        }

        const message = errorMessages[error.code];
        if (message) {
          throw new Error(message);
        }
      }

      throw new Error('Failed to upload profile image. Please try again.');
    }
  }

  /**
   * Delete the profile image.
   */
  async deleteProfileImage(): Promise<void> {
    const deleteCallable = httpsCallable<void, { success: boolean }>(
      this.functions,
      'deleteProfileImage',
    );

    try {
      await deleteCallable();

      // Set optimistic state to show image as deleted immediately
      const slug = this.membershipService.userDocument()?.slug;
      if (slug) {
        this.saveOptimisticState({ deleted: true, slug });
      }

      // Reload profile - will auto-clear optimistic state when backend catches up
      this.profileResource.reload();
    } catch (error: unknown) {
      console.error('Profile image delete failed:', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (isFirebaseFunctionsError(error)) {
        const errorMessages: Record<string, string> = {
          'unauthenticated': 'You must be signed in to delete your profile image.',
          'resource-exhausted': 'Too many requests. Please try again in a few minutes.',
        };

        if (error.code === 'failed-precondition') {
          if (error.message.includes('membership')) {
            throw new Error('Active membership required to delete your profile image.');
          }
          console.warn('Unhandled failed-precondition:', error.message);
          throw new Error(error.message || 'A precondition for this operation was not met.');
        }

        const message = errorMessages[error.code];
        if (message) {
          throw new Error(message);
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

  /**
   * Load optimistic image state from localStorage.
   * Called once during service initialization.
   */
  private loadOptimisticState(): OptimisticImageState {
    try {
      const stored = localStorage.getItem(OPTIMISTIC_IMAGE_KEY);
      if (!stored) return undefined;

      const parsed: unknown = JSON.parse(stored);

      // Validate structure before returning
      if (!this.isValidOptimisticState(parsed)) {
        console.warn('Invalid optimistic state in localStorage, clearing', { parsed });
        localStorage.removeItem(OPTIMISTIC_IMAGE_KEY);
        return undefined;
      }

      return parsed as OptimisticImageState;
    } catch (error) {
      console.error('Failed to load optimistic state, clearing', { error });
      localStorage.removeItem(OPTIMISTIC_IMAGE_KEY);
      return undefined;
    }
  }

  /**
   * Validate that an unknown value matches the OptimisticImageState structure.
   */
  private isValidOptimisticState(value: unknown): value is OptimisticImageState {
    if (!value || typeof value !== 'object') return false;
    if (!('slug' in value) || typeof value.slug !== 'string') return false;

    // Check for upload state (has url)
    if ('url' in value) {
      return typeof value.url === 'string';
    }

    // Check for delete state (has deleted)
    if ('deleted' in value) {
      return value.deleted === true;
    }

    return false;
  }

  /**
   * Save optimistic image state to both signal and localStorage.
   * Pass null to clear the state.
   * Image URLs with data URIs are not persisted to avoid quota errors.
   */
  private saveOptimisticState(state: OptimisticImageState): void {
    this.optimisticImage.set(state);
    try {
      if (state) {
        // Don't persist image URLs with base64 data to localStorage (can exceed quota)
        // They only need to exist in memory until the profile resource reloads
        const shouldPersist = !('url' in state) || !state.url.startsWith('data:');

        if (shouldPersist) {
          localStorage.setItem(OPTIMISTIC_IMAGE_KEY, JSON.stringify(state));
        }
      } else {
        localStorage.removeItem(OPTIMISTIC_IMAGE_KEY);
      }
    } catch (error) {
      console.warn('Failed to persist optimistic state to localStorage', { error });
      // State is still set in memory, just won't persist across page refreshes
    }
  }
}
