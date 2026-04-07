import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';
import { TagsStep } from './tags-step';

describe('TagsStep', () => {
  it('should render all available tags', async () => {
    await setup();

    expect(screen.getByRole('checkbox', { name: 'Birth Doula' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Postpartum Doula' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Body Ready Birth Instructor' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Spinning Babies Parent Educator' })).toBeVisible();
  });

  it('should pre-select tags from wizard service', async () => {
    await setup({ selectedTags: ['Birth Doula'] });

    const checkbox = screen.getByRole('checkbox', { name: 'Birth Doula' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('should toggle tags on click', async () => {
    const { user } = await setup();

    const checkbox = screen.getByRole('checkbox', { name: 'Birth Doula' });
    await user.click(checkbox);

    expect((checkbox as HTMLInputElement).checked).toBe(true);
  });

  it('should show error when no tags selected and Next clicked', async () => {
    const { user } = await setup();

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    expect(screen.getByText('Please select at least one service or specialty.')).toBeVisible();
  });

  it('should save tags and navigate to bio step on Next', async () => {
    const { user, mockRouter, mockWizardService } = await setup();

    const checkbox = screen.getByRole('checkbox', { name: 'Birth Doula' });
    await user.click(checkbox);

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    expect(mockWizardService.selectedTags.set).toHaveBeenCalled();
    expect(mockWizardService.completeStep).toHaveBeenCalledWith('tags');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile/create/bio']);
  });

  it('should navigate back to personal step', async () => {
    const { user, mockRouter } = await setup();

    const backButton = screen.getByRole('button', { name: 'Back' });
    await user.click(backButton);

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile/create/personal']);
  });
});

interface SetupOptions {
  selectedTags?: string[];
}

async function setup({ selectedTags = [] }: SetupOptions = {}) {
  const mockWizardService = {
    selectedTags: Object.assign(signal(selectedTags), {
      set: vi.fn(),
    }),
    completeStep: vi.fn(),
  };

  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(true),
  };

  await render(TagsStep, {
    providers: [
      { provide: CreateProfileWizardService, useValue: mockWizardService },
      { provide: Router, useValue: mockRouter },
    ],
  });

  const user = userEvent.setup();

  return { user, mockRouter, mockWizardService };
}
