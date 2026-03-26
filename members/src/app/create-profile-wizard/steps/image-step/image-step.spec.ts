import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileService } from '../../../services/profile.service';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';
import { ImageStep } from './image-step';

describe('ImageStep', () => {
  it('should show upload prompt initially', async () => {
    await setup();

    expect(screen.getByText('Choose a professional headshot photo')).toBeVisible();
    expect(screen.getByText('Choose File')).toBeVisible();
  });

  it('should show skip button', async () => {
    await setup();

    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeVisible();
  });

  it('should navigate to preview on skip', async () => {
    const { user, mockRouter, mockWizardService } = await setup();

    const skipButton = screen.getByRole('button', { name: 'Skip for now' });
    await user.click(skipButton);

    expect(mockWizardService.completeStep).toHaveBeenCalledWith('image');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile/create/preview']);
  });

  it('should navigate back to contact step', async () => {
    const { user, mockRouter } = await setup();

    const backButton = screen.getByRole('button', { name: 'Back' });
    await user.click(backButton);

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile/create/contact']);
  });

  it('should show error for invalid file type', async () => {
    const { container } = await setup();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = new File(['test'], 'test.gif', { type: 'image/gif' });

    Object.defineProperty(fileInput, 'files', {
      value: [invalidFile],
      writable: false,
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => {
      expect(screen.getByText('Please select a valid image (JPEG, PNG, or WebP).')).toBeVisible();
    });
  });
});

async function setup() {
  const mockWizardService = {
    completeStep: vi.fn(),
  };

  const mockProfileService = {
    uploadProfileImage: vi.fn().mockResolvedValue(undefined),
    profileImageUrl: signal(undefined),
    hasCustomImage: signal(false),
  };

  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(true),
  };

  const { container } = await render(ImageStep, {
    providers: [
      { provide: CreateProfileWizardService, useValue: mockWizardService },
      { provide: ProfileService, useValue: mockProfileService },
      { provide: Router, useValue: mockRouter },
    ],
  });

  const user = userEvent.setup();

  return { container, user, mockRouter, mockWizardService };
}
