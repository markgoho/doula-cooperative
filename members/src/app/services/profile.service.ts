import { Injectable, inject, resource } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
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

  // Resource automatically loads profile based on membership status
  private profileResource = resource({
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

  // Public readonly signal for components to access profile
  readonly profile = this.profileResource.value;

  // Expose resource status signals for components that need loading/error states
  readonly isLoadingProfile = this.profileResource.isLoading;
  readonly profileError = this.profileResource.error;

  // Method to manually reload profile if needed
  reload(): void {
    this.profileResource.reload();
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
      console.warn('No front matter found in profile content');
      return undefined;
    }

    const [, frontMatter, bodyContent] = frontMatterMatch;

    if (!frontMatter || !bodyContent) {
      console.warn('Invalid front matter format');
      return undefined;
    }

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

      if (phoneMatch && phoneMatch[1]) {
        data.contact.phone = phoneMatch[1].replaceAll(/['"]/g, '');
      }
      if (emailMatch && emailMatch[1]) {
        data.contact.email = emailMatch[1].replaceAll(/['"]/g, '');
      }
      if (websiteMatch && websiteMatch[1]) {
        data.contact.website = websiteMatch[1].replaceAll(/['"]/g, '');
      }
      if (businessNameMatch && businessNameMatch[1]) {
        data.contact.business_name = businessNameMatch[1].replaceAll(/['"]/g, '');
      }
    }

    return data;
  }

  getTagUrl(tag: string): string {
    return tag.toLowerCase().replaceAll(/\s+/g, '-');
  }
}
