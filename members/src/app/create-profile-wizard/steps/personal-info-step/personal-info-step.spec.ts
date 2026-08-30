import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MembershipService, type Member } from '../../../services/membership.service';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';
import { PersonalInfoStep } from './personal-info-step';

describe('PersonalInfoStep', () => {
  it('should pre-fill name from wizard service', async () => {
    await setup();

    const titleInput = screen.getByLabelText('Name *') as HTMLInputElement;
    expect(titleInput.value).toBe('Test User');
  });

  it('should show validation error when name is cleared', async () => {
    const { user } = await setup();

    const titleInput = screen.getByLabelText('Name *');
    await user.clear(titleInput);
    await user.tab();

    expect(await screen.findByText('Name is required')).toBeVisible();
  });

  it('should disable Next button when form is invalid', async () => {
    const { user } = await setup();

    const titleInput = screen.getByLabelText('Name *');
    await user.clear(titleInput);

    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeDisabled();
  });

  it('should navigate to /membership on cancel', async () => {
    const { user, mockRouter } = await setup();

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/membership']);
  });

  it('should save data and navigate to tags step on Next', async () => {
    const { user, mockRouter, mockWizardService } = await setup();

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockWizardService.completeStep).toHaveBeenCalledWith('personal');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile/create/tags']);
    });
  });

  it('should not update the member slug when the generated slug matches the current slug', async () => {
    const { user, mockMembershipService } = await setup();

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockMembershipService.updateMemberSlug).not.toHaveBeenCalled();
    });
  });

  describe('when the member has no slug yet and the name matches an existing unowned profile', () => {
    it('should show an "is this you?" prompt instead of resolving a slug', async () => {
      const { user } = await setup({
        memberSlug: undefined,
        checkSlugAvailability: vi.fn().mockResolvedValue({
          taken: true,
          unownedMatch: { slug: 'megan-stavalone', title: 'Megan Stavalone' },
        }),
      });

      const titleInput = screen.getByLabelText('Name *');
      await user.clear(titleInput);
      await user.type(titleInput, 'Megan Stavalone');
      await user.tab();

      expect(await screen.findByText(/Is this you\?/, {}, { timeout: 3000 })).toBeVisible();
      expect(screen.getByRole('button', { name: "Yes, that's me" })).toBeVisible();
      expect(screen.queryByText(/Your profile URL/)).not.toBeInTheDocument();
    });

    it('should disable Next until the member answers the prompt', async () => {
      const { user } = await setup({
        memberSlug: undefined,
        checkSlugAvailability: vi.fn().mockResolvedValue({
          taken: true,
          unownedMatch: { slug: 'megan-stavalone', title: 'Megan Stavalone' },
        }),
      });

      const titleInput = screen.getByLabelText('Name *');
      await user.clear(titleInput);
      await user.type(titleInput, 'Megan Stavalone');
      await user.tab();

      await screen.findByText(/Is this you\?/, {}, { timeout: 3000 });
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    });

    it('should request a profile link and show a confirmation when the member confirms', async () => {
      const mockRequestProfileLink = vi.fn().mockResolvedValue(undefined);
      const { user } = await setup({
        memberSlug: undefined,
        checkSlugAvailability: vi.fn().mockResolvedValue({
          taken: true,
          unownedMatch: { slug: 'megan-stavalone', title: 'Megan Stavalone' },
        }),
        requestProfileLink: mockRequestProfileLink,
      });

      const titleInput = screen.getByLabelText('Name *');
      await user.clear(titleInput);
      await user.type(titleInput, 'Megan Stavalone');
      await user.tab();

      const confirmButton = await screen.findByRole(
        'button',
        { name: "Yes, that's me" },
        { timeout: 3000 },
      );
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockRequestProfileLink).toHaveBeenCalledWith('megan-stavalone');
      });
      expect(await screen.findByText(/asked an admin to link your existing profile/)).toBeVisible();
    });

    it('should fall back to slug deduplication when the member declines', async () => {
      // Consistent with checkSlugAvailability: the base slug is taken (by the
      // unowned match itself), so dedup must walk to the "-2" suffix.
      const mockCheckSlugExists = vi
        .fn()
        .mockImplementation((slug: string) => Promise.resolve(slug === 'megan-stavalone'));
      const mockRequestProfileLink = vi.fn().mockResolvedValue(undefined);
      const { user } = await setup({
        memberSlug: undefined,
        checkSlugAvailability: vi.fn().mockResolvedValue({
          taken: true,
          unownedMatch: { slug: 'megan-stavalone', title: 'Megan Stavalone' },
        }),
        checkSlugExists: mockCheckSlugExists,
        requestProfileLink: mockRequestProfileLink,
      });

      const titleInput = screen.getByLabelText('Name *');
      await user.clear(titleInput);
      await user.type(titleInput, 'Megan Stavalone');
      await user.tab();

      const declineButton = await screen.findByRole(
        'button',
        { name: "No, that's not me" },
        { timeout: 3000 },
      );
      await user.click(declineButton);

      expect(
        await screen.findByText('doulacooperative.com/doulas/megan-stavalone-2', {
          exact: false,
        }),
      ).toBeVisible();
      expect(mockRequestProfileLink).not.toHaveBeenCalled();
    });
  });

  describe('when the member already has a slug', () => {
    it('should not show the "is this you?" prompt, even if the new name collides with an unowned profile', async () => {
      const { user } = await setup({
        checkSlugAvailability: vi.fn().mockResolvedValue({
          taken: true,
          unownedMatch: { slug: 'megan-stavalone', title: 'Megan Stavalone' },
        }),
        checkSlugExists: vi
          .fn()
          .mockImplementation((slug: string) => Promise.resolve(slug === 'megan-stavalone')),
      });

      const titleInput = screen.getByLabelText('Name *');
      await user.clear(titleInput);
      await user.type(titleInput, 'Megan Stavalone');
      await user.tab();

      expect(
        await screen.findByText('doulacooperative.com/doulas/megan-stavalone-2', {
          exact: false,
        }),
      ).toBeVisible();
      expect(screen.queryByText(/Is this you\?/)).not.toBeInTheDocument();
    });
  });
});

interface SetupOptions {
  // Omit entirely to default to 'test-user'; pass `memberSlug: undefined`
  // explicitly to simulate a member with no slug yet.
  memberSlug?: string | undefined;
  checkSlugExists?: ReturnType<typeof vi.fn>;
  checkSlugAvailability?: ReturnType<typeof vi.fn>;
  requestProfileLink?: ReturnType<typeof vi.fn>;
}

async function setup(options: SetupOptions = {}) {
  const {
    checkSlugExists = vi.fn().mockResolvedValue(false),
    checkSlugAvailability = vi.fn().mockResolvedValue({ taken: false }),
    requestProfileLink = vi.fn().mockResolvedValue(undefined),
  } = options;
  // A destructured default kicks in whenever the value is `undefined`,
  // whether or not the key was passed — so `memberSlug` can't use a
  // plain default and still let callers pass `memberSlug: undefined`
  // explicitly to mean "no slug".
  const memberSlug = 'memberSlug' in options ? options.memberSlug : 'test-user';

  const mockMember: Member = {
    uid: 'test-uid',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(0),
    isAdmin: false,
    membershipActive: true,
    ...(memberSlug !== undefined && { slug: memberSlug }),
  };

  const mockWizardService = {
    personalInfo: signal({
      title: 'Test User',
      pronouns: '',
      credentials: '',
    }),
    resolvedSlug: signal('test-user'),
    completeStep: vi.fn(),
  };

  const mockMembershipService = {
    userDocument: signal(mockMember),
    checkSlugExists,
    checkSlugAvailability,
    requestProfileLink,
    updateMemberSlug: vi.fn().mockResolvedValue(undefined),
  };

  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(true),
  };

  await render(PersonalInfoStep, {
    providers: [
      { provide: CreateProfileWizardService, useValue: mockWizardService },
      { provide: MembershipService, useValue: mockMembershipService },
      { provide: Router, useValue: mockRouter },
    ],
  });

  const user = userEvent.setup();

  return { user, mockRouter, mockWizardService, mockMembershipService };
}
