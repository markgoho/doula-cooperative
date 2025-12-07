import { Injectable, computed, inject, resource } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { load } from 'js-yaml';
import { isFirebaseFunctionsError } from '../types/firebase-error';
import { type ProfileData, type ProfileFrontMatter } from '../types/profile-data';
import { MembershipService } from './membership.service';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private functions = inject(Functions);
  private membershipService = inject(MembershipService);

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

      // Use the image URL directly from the backend
      if (profileData && result.image) {
        profileData.image = result.image;
      }

      return profileData;
    },
  });

  readonly profile = computed(() => {
    if (this.profileResource.hasValue()) {
      return this.profileResource.value();
    }

    return;
  });

  async updateProfile(data: ProfileData): Promise<void> {
    const writeProfileCallable = httpsCallable<ProfileData, { success: boolean }>(
      this.functions,
      'writeProfile',
    );

    try {
      await writeProfileCallable(data);

      // Only reload on success
      this.profileResource.reload();
    } catch (error: unknown) {
      console.error('Profile update failed:', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (isFirebaseFunctionsError(error)) {
        switch (error.code) {
          case 'unauthenticated': {
            throw new Error('You must be signed in to update your profile.');
          }

          case 'failed-precondition': {
            if (error.message.includes('active membership')) {
              throw new Error('Active membership required to update profile.');
            }
            if (error.message.includes('modified by another process')) {
              throw new Error('Profile was modified elsewhere. Please refresh and try again.');
            }
            break;
          }

          case 'not-found': {
            throw new Error('Profile not found. Please create a profile first.');
          }

          case 'resource-exhausted': {
            throw new Error('Too many requests. Please try again in a few minutes.');
          }

          case 'deadline-exceeded': {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
        }
      }

      throw new Error('Failed to update profile. Please try again.');
    }
  }

  async createProfileContent(data: ProfileData): Promise<void> {
    const createProfileCallable = httpsCallable<ProfileData, { success: boolean }>(
      this.functions,
      'createProfile',
    );

    try {
      await createProfileCallable(data);

      // Only reload on success
      this.profileResource.reload();
    } catch (error: unknown) {
      console.error('Profile creation failed:', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (isFirebaseFunctionsError(error)) {
        switch (error.code) {
          case 'unauthenticated': {
            throw new Error('You must be signed in to create a profile.');
          }

          case 'failed-precondition': {
            if (error.message.includes('slug')) {
              throw new Error(
                'You must set up your profile slug first. Please return to the membership page.',
              );
            }
            if (error.message.includes('membership')) {
              throw new Error('Active membership required to create a profile.');
            }
            break;
          }

          case 'resource-exhausted': {
            throw new Error('Too many requests. Please try again in a few minutes.');
          }

          case 'already-exists': {
            throw new Error('Profile already exists. Try refreshing the page.');
          }

          case 'deadline-exceeded': {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
        }
      }

      throw new Error('Failed to create profile. Please try again or contact support.');
    }
  }

  private async fetchProfileFromServer(): Promise<{ content: string; image?: string }> {
    const readProfileCallable = httpsCallable<unknown, { content: string; image?: string }>(
      this.functions,
      'readProfile',
    );
    const { data } = await readProfileCallable();
    return data;
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
}
