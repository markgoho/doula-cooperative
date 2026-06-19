import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileService } from '../services/profile.service';
import type { ProfileData } from '../types/profile-data';
import { EditProfileImage } from './edit-profile-image';

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
URL.createObjectURL = mockCreateObjectURL;
URL.revokeObjectURL = mockRevokeObjectURL;

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

      const image = screen.getByRole('img', { name: /profile image of jane doe/i });
      expect(image).toHaveAttribute('src', 'https://example.com/profile.jpg');
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

    it('should NOT show Edit Photo button when image exists', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          image: 'https://example.com/profile.jpg',
        },
      });

      expect(screen.queryByRole('button', { name: /edit photo/i })).not.toBeInTheDocument();
    });
  });

  describe('when profile has no custom image', () => {
    it('should show default placeholder image', async () => {
      await setup({
        profileData: { title: 'Jane Doe', bio: 'Experienced doula' },
      });

      const image = screen.getByRole('img', { name: /default profile placeholder/i });
      expect(image).toBeVisible();
      expect(image.getAttribute('src')).toContain('di-default-profile.png');
    });

    it('should show informational text about default placeholder', async () => {
      await setup({
        profileData: { title: 'Jane Doe', bio: 'Experienced doula' },
      });

      expect(screen.getByText(/no custom profile image set/i)).toBeVisible();
      expect(
        screen.getByText(/default placeholder is shown on your public profile/i),
      ).toBeVisible();
    });

    it('should show Add Photo button', async () => {
      await setup({
        profileData: { title: 'Jane Doe', bio: 'Experienced doula' },
      });

      expect(screen.getByText(/add photo/i)).toBeVisible();
    });

    it('should NOT show Remove Photo button', async () => {
      await setup({
        profileData: { title: 'Jane Doe', bio: 'Experienced doula' },
      });

      expect(screen.queryByRole('button', { name: /remove photo/i })).not.toBeInTheDocument();
    });
  });

  describe('file selection', () => {
    it('should show error for invalid file type', async () => {
      const { user } = await setup({
        profileData: { title: 'Jane', bio: 'Bio' },
      });

      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const input = screen.getByLabelText(/add photo/i);
      input.removeAttribute('accept'); // Allow selecting any file to test validation

      await user.upload(input, file);

      expect(screen.getByText(/please select a valid image/i)).toBeVisible();
    });

    it('should show error for file too large', async () => {
      const { user } = await setup({
        profileData: { title: 'Jane', bio: 'Bio' },
      });

      // Mock size property
      const file = new File([''], 'large.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 });

      const input = screen.getByLabelText(/add photo/i);
      await user.upload(input, file);

      expect(screen.getByText(/image is too large/i)).toBeVisible();
    });

    it('should show preview when valid file selected', async () => {
      mockCreateObjectURL.mockReturnValue('blob:preview');
      const { user } = await setup({
        profileData: { title: 'Jane', bio: 'Bio' },
      });

      const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/add photo/i);
      await user.upload(input, file);

      const preview = screen.getByRole('img', { name: /preview/i });
      expect(preview).toBeVisible();
      expect(preview).toHaveAttribute('src', 'blob:preview');
      expect(mockCreateObjectURL).toHaveBeenCalledWith(file);
    });

    it('should show upload actions when file selected', async () => {
      mockCreateObjectURL.mockReturnValue('blob:preview');
      const { user } = await setup({
        profileData: { title: 'Jane', bio: 'Bio' },
      });

      const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/add photo/i);
      await user.upload(input, file);

      expect(screen.getByRole('button', { name: /upload photo/i })).toBeVisible();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
    });

    it('should upload file when Upload Photo clicked', async () => {
      mockCreateObjectURL.mockReturnValue('blob:preview');
      const { user, mockProfileService } = await setup({
        profileData: { title: 'Jane', bio: 'Bio' },
      });

      const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/add photo/i);
      await user.upload(input, file);

      await user.click(screen.getByRole('button', { name: /upload photo/i }));

      expect(mockProfileService.uploadProfileImage).toHaveBeenCalledWith(file);
    });

    it('should show error message when upload fails', async () => {
      mockCreateObjectURL.mockReturnValue('blob:preview');
      const { user } = await setup({
        profileData: { title: 'Jane', bio: 'Bio' },
        uploadError: new Error('Upload error'),
      });

      const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/add photo/i);
      await user.upload(input, file);

      await user.click(screen.getByRole('button', { name: /upload photo/i }));

      expect(screen.getByText(/upload error/i)).toBeVisible();
      // Should remain in selecting state
      expect(screen.getByRole('button', { name: /upload photo/i })).toBeVisible();
    });

    it('should clear selection when Cancel clicked', async () => {
      mockCreateObjectURL.mockReturnValue('blob:preview');
      const { user } = await setup({
        profileData: { title: 'Jane', bio: 'Bio' },
      });

      const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/add photo/i);
      await user.upload(input, file);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('img', { name: /preview/i })).not.toBeInTheDocument();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:preview');
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
  });
});

interface SetupOptions {
  profileData?: ProfileData;
  uploadError?: Error;
  deleteError?: Error;
}

async function setup({ profileData, uploadError, deleteError }: SetupOptions = {}) {
  const uploadMock = uploadError
    ? vi.fn().mockRejectedValue(uploadError)
    : vi.fn().mockResolvedValue(undefined);

  const deleteMock = deleteError
    ? vi.fn().mockRejectedValue(deleteError)
    : vi.fn().mockResolvedValue(undefined);

  const hasCustomImage = profileData?.image !== undefined;

  const mockProfileService = {
    loadProfile: vi.fn(),
    profileResource: {
      isLoading: signal(false),
      hasValue: signal(profileData !== undefined),
      value: signal(profileData),
      error: signal(undefined),
    },
    profile: signal(profileData),
    profileImageUrl: signal(
      hasCustomImage
        ? profileData!.image
        : 'https://ik.imagekit.io/doulacoop/tr:w-300,h-300,fo-face,z-0.5,di-default-profile.png/doulas/jane-doe/jane-doe-profile',
    ),
    hasCustomImage: signal(hasCustomImage),
    uploadProfileImage: uploadMock,
    deleteProfileImage: deleteMock,
  } as unknown as ProfileService;

  await render(EditProfileImage, {
    providers: [{ provide: ProfileService, useValue: mockProfileService }, provideRouter([])],
  });

  const user = userEvent.setup();

  return { user, mockProfileService };
}
