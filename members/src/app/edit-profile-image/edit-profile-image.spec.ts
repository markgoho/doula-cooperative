import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MembershipService } from '../services/membership.service';
import { ProfileService } from '../services/profile.service';
import type { ProfileData } from '../types/profile-data';
import { EditProfileImage } from './edit-profile-image';

describe('EditProfileImage', () => {
  describe('when profile exists with image', () => {
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

    it('should display current image heading', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
      });

      expect(screen.getByText(/current profile image/i)).toBeVisible();
    });

    it('should show Change Photo button when image exists', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
      });

      expect(screen.getByText(/change photo/i)).toBeVisible();
    });

    it('should show Remove Photo button when image exists', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
      });

      expect(screen.getByRole('button', { name: /remove photo/i })).toBeVisible();
    });

    it('should show Edit Photo button when image exists', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
      });

      expect(screen.getByRole('button', { name: /edit photo/i })).toBeVisible();
    });

    it('should have back to profile link', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
      });

      const link = screen.getByRole('link', { name: /back to profile/i });
      expect(link).toBeVisible();
      expect(link).toHaveAttribute('href', '/profile');
    });
  });

  describe('when profile exists without image', () => {
    it('should display "No profile image set yet"', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
        },
      });

      expect(screen.getByText(/no profile image set yet/i)).toBeVisible();
    });

    it('should show Add Photo button when no image', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
        },
      });

      expect(screen.getByText(/add photo/i)).toBeVisible();
    });

    it('should not show Remove Photo button when no image', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
        },
      });

      expect(screen.queryByRole('button', { name: /remove photo/i })).not.toBeInTheDocument();
    });

    it('should not show Edit Photo button when no image', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
        },
      });

      expect(screen.queryByRole('button', { name: /edit photo/i })).not.toBeInTheDocument();
    });
  });

  describe('delete confirmation', () => {
    it('should show delete confirmation when Remove Photo is clicked', async () => {
      const { user } = await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
      });

      await user.click(screen.getByRole('button', { name: /remove photo/i }));

      expect(screen.getByText(/remove profile photo\?/i)).toBeVisible();
      expect(screen.getByText(/are you sure/i)).toBeVisible();
    });

    it('should cancel delete when Cancel is clicked in confirmation', async () => {
      const { user } = await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
      });

      await user.click(screen.getByRole('button', { name: /remove photo/i }));
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Should be back to viewing state - image should be visible again
      expect(screen.getByRole('img')).toBeVisible();
    });
  });

  describe('when no profile exists', () => {
    it('should display profile setup required message', async () => {
      await setup();

      expect(screen.getByText(/profile setup required/i)).toBeVisible();
      expect(
        screen.getByText(/it looks like you don't have a doula profile set up yet/i),
      ).toBeVisible();
    });

    it('should display contact support instructions', async () => {
      await setup();

      expect(screen.getByText(/please contact us to set up your profile/i)).toBeVisible();
    });

    it('should have link to membership page', async () => {
      await setup();

      const membershipLink = screen.getByRole('link', { name: /membership page/i });
      expect(membershipLink).toBeVisible();
      expect(membershipLink).toHaveAttribute('href', '/membership');
    });

    it('should display message about editing after profile creation', async () => {
      await setup();

      expect(
        screen.getByText(/once your profile is created, you'll be able to edit it here/i),
      ).toBeVisible();
    });
  });

  describe('edit existing image', () => {
    it('should show loading state when Edit Photo is clicked', async () => {
      // Mock fetch to delay response
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve({ ok: false }), 100);
            }),
        ),
      );

      const { user } = await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
        slug: 'jane-doe',
      });

      await user.click(screen.getByRole('button', { name: /edit photo/i }));

      expect(screen.getByText(/loading your photo for editing/i)).toBeVisible();

      vi.unstubAllGlobals();
    });

    it('should show error message when existing image cannot be loaded', async () => {
      // Mock fetch to return 404 for all extensions
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

      const { user } = await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
        slug: 'jane-doe',
      });

      await user.click(screen.getByRole('button', { name: /edit photo/i }));

      expect(await screen.findByText(/could not load existing image/i)).toBeVisible();

      vi.unstubAllGlobals();
    });

    it('should show cropper when existing image loads successfully', async () => {
      // Mock fetch to return successful response with blob
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          blob: vi.fn().mockResolvedValue(mockBlob),
        }),
      );

      const { user } = await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
        slug: 'jane-doe',
      });

      await user.click(screen.getByRole('button', { name: /edit photo/i }));

      // Should show the cropper
      expect(await screen.findByText(/crop your photo/i)).toBeVisible();

      vi.unstubAllGlobals();
    });
  });

  describe('delete workflow', () => {
    it('should call deleteProfileImage when delete is confirmed', async () => {
      const { user, mockProfileService } = await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
      });

      await user.click(screen.getByRole('button', { name: /remove photo/i }));
      await user.click(screen.getByRole('button', { name: /^remove photo$/i }));

      expect(mockProfileService.deleteProfileImage).toHaveBeenCalledOnce();
    });

    it('should show success message after delete completes', async () => {
      const { user } = await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
      });

      await user.click(screen.getByRole('button', { name: /remove photo/i }));
      await user.click(screen.getByRole('button', { name: /^remove photo$/i }));

      expect(await screen.findByText(/profile image removed/i)).toBeVisible();
    });

    it('should show error message when delete fails', async () => {
      const { user } = await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
        deleteError: new Error('Network error'),
      });

      await user.click(screen.getByRole('button', { name: /remove photo/i }));
      await user.click(screen.getByRole('button', { name: /^remove photo$/i }));

      expect(await screen.findByText(/network error/i)).toBeVisible();
    });

    it('should show email notification message after successful delete', async () => {
      const { user } = await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
      });

      await user.click(screen.getByRole('button', { name: /remove photo/i }));
      await user.click(screen.getByRole('button', { name: /^remove photo$/i }));

      expect(
        await screen.findByText(/you'll receive an email when your update is published/i),
      ).toBeVisible();
    });
  });
});

interface SetupOptions {
  profileData?: ProfileData;
  uploadError?: Error;
  deleteError?: Error;
  slug?: string;
}

async function setup({ profileData, uploadError, deleteError, slug }: SetupOptions = {}) {
  const uploadMock = uploadError
    ? vi.fn().mockRejectedValue(uploadError)
    : vi.fn().mockResolvedValue(undefined);

  const deleteMock = deleteError
    ? vi.fn().mockRejectedValue(deleteError)
    : vi.fn().mockResolvedValue(undefined);

  const mockProfileService = {
    profileResource: {
      isLoading: signal(false),
      hasValue: signal(profileData !== undefined),
      value: signal(profileData),
      error: signal(undefined),
    },
    // profile() computed that includes optimistic state (returns the same as profileResource.value() in tests)
    profile: signal(profileData),
    uploadProfileImage: uploadMock,
    deleteProfileImage: deleteMock,
  } as unknown as ProfileService;

  const mockMembershipService = {
    userDocument: signal(slug ? { slug } : undefined),
  } as unknown as MembershipService;

  await render(EditProfileImage, {
    providers: [
      { provide: ProfileService, useValue: mockProfileService },
      { provide: MembershipService, useValue: mockMembershipService },
    ],
  });

  const user = userEvent.setup();

  return { user, mockProfileService, mockMembershipService };
}
