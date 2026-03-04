import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
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
});

async function setup() {
  const mockMember: Member = {
    uid: 'test-uid',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(0),
    isAdmin: false,
    membershipActive: true,
    slug: 'test-user',
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
    checkSlugExists: vi.fn().mockResolvedValue(false),
    updateMemberSlug: vi.fn().mockResolvedValue(undefined),
  };

  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(true),
  };

  const result = await render(PersonalInfoStep, {
    providers: [
      { provide: CreateProfileWizardService, useValue: mockWizardService },
      { provide: MembershipService, useValue: mockMembershipService },
      { provide: Router, useValue: mockRouter },
    ],
  });

  const user = userEvent.setup();

  return { ...result, user, mockRouter, mockWizardService, mockMembershipService };
}
