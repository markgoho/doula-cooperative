import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MembershipService, type Member } from '../services/membership.service';
import { CreateProfileService } from '../services/create-profile.service';
import { CreateProfile } from './create-profile';

describe('CreateProfile', () => {
  describe('loading states', () => {
    it('should show loading message while user document is loading', async () => {
      await setup({ userDocumentLoading: true });

      expect(screen.getByText('Loading...')).toBeVisible();
    });
  });

  describe('form initialization', () => {
    it('should pre-fill name from member document', async () => {
      await setup();

      const titleInput = screen.getByLabelText('Name *') as HTMLInputElement;
      expect(titleInput.value).toBe('Test User');
    });

    it('should pre-fill email from member document', async () => {
      await setup();

      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      expect(emailInput.value).toBe('test@example.com');
    });

    it('should initialize other fields as empty', async () => {
      await setup();

      const pronounsInput = screen.getByLabelText('Pronouns (optional)') as HTMLInputElement;
      const credentialsInput = screen.getByLabelText('Credentials') as HTMLInputElement;
      const bioInput = screen.getByLabelText('Bio *') as HTMLTextAreaElement;

      expect(pronounsInput.value).toBe('');
      expect(credentialsInput.value).toBe('');
      expect(bioInput.value).toBe('');
    });

    it('should initialize all tags as unchecked', async () => {
      await setup();

      const birthDoulaCheckbox = screen.getByRole('checkbox', {
        name: 'Birth Doula',
      }) as HTMLInputElement;
      const postpartumDoulaCheckbox = screen.getByRole('checkbox', {
        name: 'Postpartum Doula',
      }) as HTMLInputElement;

      expect(birthDoulaCheckbox.checked).toBe(false);
      expect(postpartumDoulaCheckbox.checked).toBe(false);
    });
  });

  describe('form validation', () => {
    it('should show validation error when title is empty', async () => {
      const { user } = await setup();

      const titleInput = screen.getByLabelText('Name *');
      await user.clear(titleInput);
      await user.tab();

      expect(await screen.findByText('Name is required')).toBeVisible();
    });

    it('should show validation error when bio is empty', async () => {
      const { user } = await setup();

      const bioInput = screen.getByLabelText('Bio *');
      await user.type(bioInput, 'Some text');
      await user.clear(bioInput);
      await user.tab();

      expect(await screen.findByText('Bio is required')).toBeVisible();
    });

    it('should show validation error for invalid email', async () => {
      const { user } = await setup();

      const emailInput = screen.getByLabelText('Email');
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');
      await user.tab();

      expect(await screen.findByText('Please enter a valid email address')).toBeVisible();
    });

    it('should disable submit button when form is invalid', async () => {
      const { user } = await setup();

      const titleInput = screen.getByLabelText('Name *');
      await user.clear(titleInput);

      const submitButton = screen.getByRole('button', { name: 'Create Profile' });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when form is valid', async () => {
      const { user } = await setup();

      // Fill in required fields
      const bioInput = screen.getByLabelText('Bio *');
      await user.type(bioInput, 'My bio');

      const birthDoulaCheckbox = screen.getByRole('checkbox', { name: 'Birth Doula' });
      await user.click(birthDoulaCheckbox);

      const submitButton = screen.getByRole('button', { name: 'Create Profile' });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('form submission', () => {
    it('should call createProfileContent with correct data', async () => {
      const { user, mockCreateProfileService } = await setup();

      const bioInput = screen.getByLabelText('Bio *');
      await user.type(bioInput, 'My bio');

      const birthDoulaCheckbox = screen.getByRole('checkbox', { name: 'Birth Doula' });
      await user.click(birthDoulaCheckbox);

      const submitButton = screen.getByRole('button', { name: 'Create Profile' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateProfileService.createProfileContent).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test User',
            bio: 'My bio',
            tags: expect.arrayContaining(['Birth Doula']),
          }),
        );
      });
    });

    it('should show success message after successful creation', async () => {
      const { user } = await setup();

      const bioInput = screen.getByLabelText('Bio *');
      await user.type(bioInput, 'My bio');

      const birthDoulaCheckbox = screen.getByRole('checkbox', { name: 'Birth Doula' });
      await user.click(birthDoulaCheckbox);

      const submitButton = screen.getByRole('button', { name: 'Create Profile' });
      await user.click(submitButton);

      expect(await screen.findByText('Profile created successfully!')).toBeVisible();
    });

    it('should navigate to /profile after successful creation', async () => {
      const { user, mockRouter } = await setup();

      const bioInput = screen.getByLabelText('Bio *');
      await user.type(bioInput, 'My bio');

      const birthDoulaCheckbox = screen.getByRole('checkbox', { name: 'Birth Doula' });
      await user.click(birthDoulaCheckbox);

      const submitButton = screen.getByRole('button', { name: 'Create Profile' });
      await user.click(submitButton);

      // Wait for navigation (1.5 second delay)
      await waitFor(
        () => {
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile']);
        },
        { timeout: 2000 },
      );
    });

    it('should display error message when creation fails', async () => {
      const { user } = await setup({
        createShouldFail: true,
        errorMessage: 'Creation failed',
      });

      const bioInput = screen.getByLabelText('Bio *');
      await user.type(bioInput, 'My bio');

      const birthDoulaCheckbox = screen.getByRole('checkbox', { name: 'Birth Doula' });
      await user.click(birthDoulaCheckbox);

      const submitButton = screen.getByRole('button', { name: 'Create Profile' });
      await user.click(submitButton);

      expect(await screen.findByText(/Creation failed/i)).toBeVisible();
    });

    it('should display generic error message for unknown errors', async () => {
      const { user } = await setup({ createShouldFail: true });

      const bioInput = screen.getByLabelText('Bio *');
      await user.type(bioInput, 'My bio');

      const birthDoulaCheckbox = screen.getByRole('checkbox', { name: 'Birth Doula' });
      await user.click(birthDoulaCheckbox);

      const submitButton = screen.getByRole('button', { name: 'Create Profile' });
      await user.click(submitButton);

      expect(await screen.findByText(/Failed to create profile/i)).toBeVisible();
    });

    it('should show loading state during submission', async () => {
      const { user } = await setup({ delayCreate: true });

      const bioInput = screen.getByLabelText('Bio *');
      await user.type(bioInput, 'My bio');

      const birthDoulaCheckbox = screen.getByRole('checkbox', { name: 'Birth Doula' });
      await user.click(birthDoulaCheckbox);

      const submitButton = screen.getByRole('button', { name: 'Create Profile' });
      const clickPromise = user.click(submitButton);

      // Wait for loading state to appear
      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeVisible();
      });

      await clickPromise;
    });

    it('should disable submit button during submission', async () => {
      const { user } = await setup({ delayCreate: true });

      const bioInput = screen.getByLabelText('Bio *');
      await user.type(bioInput, 'My bio');

      const birthDoulaCheckbox = screen.getByRole('checkbox', { name: 'Birth Doula' });
      await user.click(birthDoulaCheckbox);

      const submitButton = screen.getByRole('button', { name: 'Create Profile' });
      const clickPromise = user.click(submitButton);

      // Wait for button to be disabled
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });

      await clickPromise;
    });
  });

  describe('cancel functionality', () => {
    it('should navigate to /membership when cancel is clicked', async () => {
      const { user, mockRouter } = await setup();

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/membership']);
    });
  });
});

interface SetupOptions {
  userDocumentLoading?: boolean;
  createShouldFail?: boolean;
  errorMessage?: string;
  delayCreate?: boolean;
}

async function setup({
  userDocumentLoading = false,
  createShouldFail = false,
  errorMessage,
  delayCreate = false,
}: SetupOptions = {}) {
  const mockMember: Member | undefined = userDocumentLoading
    ? undefined
    : {
        uid: 'test-uid',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(0),
        isAdmin: false,
        membershipActive: true,
        slug: 'test-user',
      };

  const mockMembershipService = {
    userDocument: signal(mockMember),
  };

  const mockCreateProfileService = {
    createProfileContent: vi.fn().mockImplementation(async () => {
      if (delayCreate) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (createShouldFail) {
        throw errorMessage ? new Error(errorMessage) : 'Unknown error';
      }
    }),
  };

  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(true),
  };

  const result = await render(CreateProfile, {
    providers: [
      {
        provide: CreateProfileService,
        useValue: mockCreateProfileService,
      },
      {
        provide: MembershipService,
        useValue: mockMembershipService,
      },
      {
        provide: Router,
        useValue: mockRouter,
      },
    ],
  });

  // IMPORTANT: Call userEvent.setup() AFTER render() to avoid ApplicationRef destroyed warnings
  const user = userEvent.setup();

  return { ...result, user, mockCreateProfileService, mockMembershipService, mockRouter };
}
