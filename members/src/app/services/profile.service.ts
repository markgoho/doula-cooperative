import { Injectable, inject, signal } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { firstValueFrom } from 'rxjs';
import { MembershipService } from './membership.service';

export interface ProfileData {
  title: string;
  credentials?: string;
  tags?: string[];
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
    business_name?: string;
  };
  bio: string;
  draft?: boolean;
  image?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private functions = inject(Functions);
  private membershipService = inject(MembershipService);
  private cachedProfile = signal<ProfileData | undefined>(undefined);

  // Public readonly signal for components to subscribe to profile changes
  readonly profile = this.cachedProfile.asReadonly();

  async loadAndParseProfile(): Promise<ProfileData | undefined> {
    // Return cached profile if available
    const cached = this.cachedProfile();
    if (cached) {
      return cached;
    }

    try {
      // Check if user has active membership and a profile before attempting to fetch
      const userDocument = await firstValueFrom(this.membershipService.userDocument$);

      if (!userDocument) {
        console.info('No user document found - cannot load profile');
        return undefined;
      }

      if (!userDocument.membershipActive) {
        console.info('User does not have active membership - cannot load profile');
        return undefined;
      }

      if (!userDocument.hasProfile) {
        console.info('User does not have a profile yet - cannot load profile');
        return undefined;
      }

      const result = await this.fetchProfileFromServer();
      const profileData = this.parseProfileContent(result.content);

      // Use the image URL directly from the backend
      if (profileData && result.image) {
        profileData.image = result.image;
      }

      // Cache the profile data
      this.cachedProfile.set(profileData);
      return profileData;
    } catch (error) {
      // Check if this is a "profile not found" error which is normal for users without profiles
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('Profile not found') ||
        errorMessage.includes('may need to claim')
      ) {
        console.info('Profile not found - user may need to claim their membership');
      } else {
        console.error('Error loading profile:', error);
      }
      return undefined;
    }
  }

  async fetchProfileFromServer(): Promise<{ content: string; image?: string }> {
    const readProfileCallable = httpsCallable<unknown, { content: string; image?: string }>(
      this.functions,
      'readProfile',
    );
    try {
      const { data } = await readProfileCallable();
      return data;
    } catch (error) {
      // Check if this is a "profile not found" error which is normal for users without profiles
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('Profile not found') ||
        errorMessage.includes('may need to claim')
      ) {
        console.info('Profile not found - user may need to claim their membership:', errorMessage);
      } else {
        console.error('Error calling readProfile function:', error);
      }
      // Re-throw the error so the component can handle it
      throw error;
    }
  }

  async preloadProfile(): Promise<ProfileData | undefined> {
    try {
      // Check if user has active membership and a profile before attempting to fetch
      const userDocument = await firstValueFrom(this.membershipService.userDocument$);

      if (!userDocument) {
        console.info('No user document found - skipping profile preload');
        return undefined;
      }

      if (!userDocument.membershipActive) {
        console.info('User does not have active membership - skipping profile preload');
        return undefined;
      }

      if (!userDocument.hasProfile) {
        console.info('User does not have a profile yet - skipping profile preload');
        return undefined;
      }

      return await this.loadAndParseProfile();
    } catch (error) {
      // Check if this is a "profile not found" error which is normal for users without profiles
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('Profile not found') ||
        errorMessage.includes('may need to claim')
      ) {
        console.info('Profile not found during preload - user may need to claim their membership');
      } else {
        console.error('Error preloading profile:', error);
      }
      return undefined;
    }
  }

  clearProfileCache(): void {
    this.cachedProfile.set(undefined);
  }

  private parseProfileContent(content: string): ProfileData | undefined {
    // Parse front matter (YAML between --- markers)
    const frontMatterMatch = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(content);

    if (!frontMatterMatch) {
      console.warn('No front matter found in profile content');
      return undefined;
    }

    const [, frontMatter, bodyContent] = frontMatterMatch;

    // Simple YAML parser for the fields we need
    const data: ProfileData = {
      title: '',
      bio: bodyContent.trim(),
      draft: false,
    };

    // Parse each line of front matter
    const lines = frontMatter.split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      switch (key) {
        case 'title': {
          data.title = value;
          break;
        }
        case 'credentials': {
          data.credentials = value;
          break;
        }
        case 'draft': {
          data.draft = value === 'true';
          break;
        }
        case 'tags': {
          // Handle YAML array format
          if (value.startsWith('[') && value.endsWith(']')) {
            data.tags = value
              .slice(1, -1)
              .split(',')
              .map((tag) => tag.trim().replaceAll(/['"]/g, ''));
          } else if (value.startsWith('- ')) {
            // Handle multi-line array format
            data.tags = [value.slice(2).trim().replaceAll(/['"]/g, '')];
          }
          break;
        }
        case 'contact': {
          // For now, we'll parse contact in the next section if needed
          break;
        }
      }
    }

    // Parse contact information if present
    if (frontMatter.includes('contact:')) {
      data.contact = {};

      // Look for phone, email, website under contact
      const phoneMatch = /phone:\s*(.+)/.exec(frontMatter);
      const emailMatch = /email:\s*(.+)/.exec(frontMatter);
      const websiteMatch = /website:\s*(.+)/.exec(frontMatter);
      const businessNameMatch = /business_name:\s*(.+)/.exec(frontMatter);

      if (phoneMatch) {
        data.contact.phone = phoneMatch[1].replaceAll(/['"]/g, '');
      }
      if (emailMatch) {
        data.contact.email = emailMatch[1].replaceAll(/['"]/g, '');
      }
      if (websiteMatch) {
        data.contact.website = websiteMatch[1].replaceAll(/['"]/g, '');
      }
      if (businessNameMatch) {
        data.contact.business_name = businessNameMatch[1].replaceAll(/['"]/g, '');
      }
    }

    return data;
  }

  getTagUrl(tag: string): string {
    return tag.toLowerCase().replaceAll(/\s+/g, '-');
  }
}
