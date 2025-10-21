import { render, screen } from '@testing-library/angular';
import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { EditProfileImage } from './edit-profile-image';
import { ProfileService } from '../services/profile.service';
import type { ProfileData } from '../types/profile-data';

describe('EditProfileImage', () => {
  describe('when profile exists', () => {
    it('should display current image when imageUrl is provided', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
      });

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', 'https://example.com/profile.jpg');
      expect(image).toHaveAttribute('alt', 'Profile image of Jane Doe');
    });

    it('should display "No profile image set yet" when no image is provided', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
        },
      });

      expect(screen.getByText(/no profile image set yet/i)).toBeVisible();
    });

    it('should display coming soon message', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
        },
      });

      expect(screen.getByText(/image editing coming soon/i)).toBeVisible();
      expect(
        screen.getByText(/the ability to upload and edit your profile image will be available soon/i)
      ).toBeVisible();
    });

    it('should have back to profile link', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
        },
      });

      const link = screen.getByRole('link', { name: /back to profile/i });
      expect(link).toBeVisible();
      expect(link).toHaveAttribute('href', '/profile');
    });

    it('should display current image heading when image exists', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
      });

      expect(screen.getByText(/current profile image/i)).toBeVisible();
    });
  });

  describe('when no profile exists', () => {
    it('should display profile setup required message', async () => {
      await setup({ profileData: undefined });

      expect(screen.getByText(/profile setup required/i)).toBeVisible();
      expect(screen.getByText(/it looks like you don't have a doula profile set up yet/i)).toBeVisible();
    });

    it('should display contact support instructions', async () => {
      await setup({ profileData: undefined });

      expect(
        screen.getByText(/please contact us to set up your profile/i)
      ).toBeVisible();
    });

    it('should have link to membership page', async () => {
      await setup({ profileData: undefined });

      const membershipLink = screen.getByRole('link', { name: /membership page/i });
      expect(membershipLink).toBeVisible();
      expect(membershipLink).toHaveAttribute('href', '/membership');
    });

    it('should display message about editing after profile creation', async () => {
      await setup({ profileData: undefined });

      expect(
        screen.getByText(/once your profile is created, you'll be able to edit it here/i)
      ).toBeVisible();
    });
  });
});

interface SetupOptions {
  profileData?: ProfileData;
}

async function setup({ profileData }: SetupOptions = {}) {
  const mockProfileService = {
    profile: signal(profileData),
  } as unknown as ProfileService;

  return await render(EditProfileImage, {
    providers: [{ provide: ProfileService, useValue: mockProfileService }],
  });
}
