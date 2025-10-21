import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileService } from '../services/profile.service';
import { type ProfileData } from '../types/profile-data';
import { EditProfile } from './edit-profile';

describe('EditProfile', () => {
  describe('no profile state', () => {
    it('should show profile setup message when no profile exists', async () => {
      await setup({ hasProfile: false });

      expect(screen.getByText('Profile Setup Required')).toBeVisible();
    });

    it('should show membership page link when no profile exists', async () => {
      await setup({ hasProfile: false });

      const membershipLink = screen.getByRole('link', { name: 'Membership page' });
      expect(membershipLink).toHaveAttribute('href', '/membership');
    });
  });

  describe('profile display', () => {
    it('should display profile title', async () => {
      await setup();

      expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeVisible();
    });

    it('should display credentials when present', async () => {
      await setup();

      expect(screen.getByText('CD(DONA), CPD')).toBeVisible();
    });

    it('should not display credentials when not present', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
        },
      });

      expect(screen.queryByText(/CD\(DONA\)/)).not.toBeInTheDocument();
    });

    it('should display bio', async () => {
      await setup();

      expect(screen.getByText('Experienced doula serving families with compassion.')).toBeVisible();
    });

    it('should display profile image when present', async () => {
      await setup();

      const image = screen.getByRole('img', { name: 'Headshot of Jane Doe' });
      expect(image).toHaveAttribute('src', 'https://example.com/jane.jpg');
    });

    it('should display placeholder when no image present', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
        },
      });

      expect(screen.getByText('Profile image will be displayed here')).toBeVisible();
    });
  });

  describe('tags', () => {
    it('should display tags when present', async () => {
      await setup();

      expect(screen.getByText('Birth Doula')).toBeVisible();
    });

    it('should create correct tag URL', async () => {
      await setup();

      const birthDoulaLink = screen.getByRole('link', { name: 'Birth Doula' });
      expect(birthDoulaLink).toHaveAttribute('href', '/doulas/tag/birth-doula');
    });

    it('should not display tags when none present', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
        },
      });

      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });

  describe('contact information', () => {
    it('should display business name when present', async () => {
      await setup();

      expect(screen.getByText('Gentle Birth Support')).toBeVisible();
    });

    it('should display default heading when no business name', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
          contact: {
            email: 'jane@example.com',
          },
        },
      });

      expect(screen.getByText('Contact Information')).toBeVisible();
    });

    it('should display website link with correct href', async () => {
      await setup();

      const websiteLink = screen.getByRole('link', { name: 'example.com' });
      expect(websiteLink).toHaveAttribute('href', 'https://example.com');
    });

    it('should display phone link with correct href', async () => {
      await setup();

      const phoneLink = screen.getByRole('link', { name: '555-123-4567' });
      expect(phoneLink).toHaveAttribute('href', 'tel:555-123-4567');
    });

    it('should display email link with correct href', async () => {
      await setup();

      const emailLink = screen.getByRole('link', { name: 'jane@example.com' });
      expect(emailLink).toHaveAttribute('href', 'mailto:jane@example.com');
    });

    it('should not display contact section when no contact info present', async () => {
      await setup({
        profileData: {
          title: 'Jane Doe',
          bio: 'Experienced doula',
        },
      });

      expect(screen.queryByText('Contact Information')).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should show validation error when title is empty', async () => {
      const { user } = await setup();

      const titleInput = screen.getByLabelText(/title/i);
      await user.clear(titleInput);
      await user.tab();

      expect(titleInput).toHaveClass('ng-invalid');
    });

    it('should show validation error when bio is empty', async () => {
      const { user } = await setup();

      const bioInput = screen.getByLabelText(/bio/i);
      await user.clear(bioInput);
      await user.tab();

      expect(bioInput).toHaveClass('ng-invalid');
    });

    it('should disable submit button when form is invalid', async () => {
      const { user } = await setup();

      const titleInput = screen.getByLabelText(/title/i);
      await user.clear(titleInput);

      const submitButton = screen.getByRole('button', { name: /save/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when form is valid', async () => {
      await setup();

      const submitButton = screen.getByRole('button', { name: /save/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('should display error message when update fails', async () => {
      const { user } = await setup({ updateShouldFail: true, errorMessage: 'Update failed' });

      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      expect(await screen.findByText(/update failed/i)).toBeVisible();
    });

    it('should display generic error message for unknown errors', async () => {
      const { user } = await setup({ updateShouldFail: true });

      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      expect(await screen.findByText(/failed to update profile/i)).toBeVisible();
    });

    it('should display success message after successful update', async () => {
      const { user } = await setup();

      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      expect(await screen.findByText(/profile updated successfully/i)).toBeVisible();
    });

    it('should show loading state during submission', async () => {
      const { user } = await setup();

      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      expect(screen.getByText(/saving/i)).toBeVisible();
    });

    it('should disable submit button during submission', async () => {
      const { user } = await setup();

      const submitButton = screen.getByRole('button', { name: /save/i });
      const clickPromise = user.click(submitButton);

      expect(submitButton).toBeDisabled();

      await clickPromise;
    });
  });
});

interface SetupOptions {
  profileData?: ProfileData;
  hasProfile?: boolean;
  updateShouldFail?: boolean;
  errorMessage?: string;
}

async function setup({
  profileData,
  hasProfile = true,
  updateShouldFail = false,
  errorMessage,
}: SetupOptions = {}) {
  const user = userEvent.setup();

  const defaultProfile: ProfileData = {
    title: 'Jane Doe',
    credentials: 'CD(DONA), CPD',
    bio: 'Experienced doula serving families with compassion.',
    image: 'https://example.com/jane.jpg',
    tags: ['Birth Doula', 'Postpartum Doula'],
    contact: {
      business_name: 'Gentle Birth Support',
      website: 'example.com',
      phone: '555-123-4567',
      email: 'jane@example.com',
    },
  };

  const mockProfileService = {
    profile: signal(hasProfile ? (profileData ?? defaultProfile) : undefined),
    getTagUrl: vi.fn((tag: string) => tag.toLowerCase().replaceAll(/\s+/g, '-')),
    updateProfile: vi.fn().mockImplementation(() => {
      if (updateShouldFail) {
        return Promise.reject(errorMessage ? new Error(errorMessage) : 'Unknown error');
      }
      return Promise.resolve();
    }),
  };

  const result = await render(EditProfile, {
    providers: [
      {
        provide: ProfileService,
        useValue: mockProfileService,
      },
    ],
  });

  return { ...result, user };
}
