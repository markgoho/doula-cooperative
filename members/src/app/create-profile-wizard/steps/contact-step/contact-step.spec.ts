import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';
import { type ContactInfo } from '../../wizard-types';
import { ContactStep } from './contact-step';

describe('ContactStep', () => {
  it('should pre-fill contact info from wizard service', async () => {
    await setup({
      contactInfo: {
        businessName: 'My Biz',
        phone: '555-1234',
        email: 'me@example.com',
        website: 'mybiz.com',
      },
    });

    expect((screen.getByLabelText('Business Name') as HTMLInputElement).value).toBe('My Biz');
    expect((screen.getByLabelText('Phone') as HTMLInputElement).value).toBe('555-1234');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('me@example.com');
    expect((screen.getByLabelText('Website') as HTMLInputElement).value).toBe('mybiz.com');
  });

  it('should show validation error for invalid email', async () => {
    const { user } = await setup();

    const emailInput = screen.getByLabelText('Email');
    await user.type(emailInput, 'invalid-email');
    await user.tab();

    expect(await screen.findByText('Please enter a valid email address')).toBeVisible();
  });

  it('should save contact info and navigate to image step on Next', async () => {
    const { user, mockRouter, wizardService } = await setup();

    const businessNameInput = screen.getByLabelText('Business Name');
    await user.type(businessNameInput, 'My Business');

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    expect(wizardService.contactInfo().businessName).toBe('My Business');
    expect(wizardService.completedSteps().has('contact')).toBe(true);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile/create/image']);
  });

  it('should navigate back to bio step', async () => {
    const { user, mockRouter } = await setup();

    const backButton = screen.getByRole('button', { name: 'Back' });
    await user.click(backButton);

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile/create/bio']);
  });

  it('should save contact info when going back', async () => {
    const { user, wizardService } = await setup();

    const phoneInput = screen.getByLabelText('Phone');
    await user.type(phoneInput, '555-9999');

    const backButton = screen.getByRole('button', { name: 'Back' });
    await user.click(backButton);

    expect(wizardService.contactInfo().phone).toBe('555-9999');
  });

  it('should mark contact step as completed on Next', async () => {
    const { user, wizardService } = await setup();

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    expect(wizardService.completedSteps().has('contact')).toBe(true);
  });
});

interface SetupOptions {
  contactInfo?: ContactInfo;
}

async function setup({
  contactInfo = { businessName: '', phone: '', email: '', website: '' },
}: SetupOptions = {}) {
  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(true),
  };

  await render(ContactStep, {
    providers: [{ provide: Router, useValue: mockRouter }],
    configureTestBed: (testBed) => {
      const wizardService = testBed.inject(CreateProfileWizardService);
      wizardService.reset();
      wizardService.contactInfo.set(contactInfo);
    },
  });

  const wizardService = TestBed.inject(CreateProfileWizardService);
  const user = userEvent.setup();

  return { user, mockRouter, wizardService };
}
