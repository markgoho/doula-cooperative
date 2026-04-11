import { computed, inputBinding, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { UnclaimedProfile } from '../../admin.types';
import { AdminUnclaimedProfileDetail } from './admin-unclaimed-profile-detail';
import { AdminUnclaimedProfileDetailService } from './admin-unclaimed-profile-detail.service';

describe('AdminUnclaimedProfileDetail', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  it('should display loading state initially', async () => {
    await setup({ shouldKeepLoading: true });

    expect(await screen.findByText('Loading details...')).toBeVisible();
  });

  it('should display unclaimed profile information', async () => {
    // Arrange
    const profile = createMockUnclaimedProfile({
      name: 'Jane Doula',
      email: 'jane@example.com',
    });

    // Act
    await setup({ profile });

    // Assert
    expect(await screen.findByText('Jane Doula')).toBeVisible();
    expect(screen.getByText('jane@example.com')).toBeVisible();
  });

  it('should display Legacy Membership Details heading', async () => {
    await setup();

    expect(await screen.findByRole('heading', { name: 'Legacy Membership Details' })).toBeVisible();
  });

  it('should show Set Profile to Draft button when slug exists', async () => {
    await setup({ slug: 'jane-doula' });

    expect(await screen.findByRole('button', { name: 'Set Profile to Draft' })).toBeVisible();
  });

  it('should not show Set Profile to Draft button when no slug exists', async () => {
    await setup({ slug: undefined });

    expect(screen.queryByRole('button', { name: 'Set Profile to Draft' })).not.toBeInTheDocument();
  });

  it('should show success message when draft is confirmed', async () => {
    const { user } = await setup({ slug: 'jane-doula' });

    await user.click(await screen.findByRole('button', { name: 'Set Profile to Draft' }));
    await user.click(screen.getByRole('button', { name: 'Set to Draft' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Profile jane-doula was set to draft.',
    );
  });

  it('should show error message when draft fails', async () => {
    const { user } = await setup({ slug: 'jane-doula', shouldFailDraft: true });

    await user.click(await screen.findByRole('button', { name: 'Set Profile to Draft' }));
    await user.click(screen.getByRole('button', { name: 'Set to Draft' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to set profile to draft.');
  });

  it('should show warning message when draft succeeds with warning', async () => {
    const { user } = await setup({
      slug: 'jane-doula',
      draftWarning:
        'Profile was set to draft, but the site rebuild did not trigger. The change may not appear immediately.',
    });

    await user.click(await screen.findByRole('button', { name: 'Set Profile to Draft' }));
    await user.click(screen.getByRole('button', { name: 'Set to Draft' }));

    expect(
      await screen.findByText(
        'Profile was set to draft, but the site rebuild did not trigger. The change may not appear immediately.',
      ),
    ).toBeVisible();
  });

  it('should close draft dialog without drafting when Cancel is clicked', async () => {
    const { user } = await setup({ slug: 'jane-doula' });

    await user.click(await screen.findByRole('button', { name: 'Set Profile to Draft' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('button', { name: 'Set to Draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set Profile to Draft' })).toBeVisible();
  });

  it('should show loading state while draft is in progress', async () => {
    await setup({ slug: 'jane-doula', draftInProgress: true });
    TestBed.flushEffects();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled();
    });
  });

  it('should display profile link when slug exists', async () => {
    // Arrange
    const profile = createMockUnclaimedProfile({ slug: 'jane-doula' });

    // Act
    await setup({ profile });

    // Assert
    const link = await screen.findByRole('link', { name: 'View Profile' });
    expect(link).toBeVisible();
    expect(link).toHaveAttribute('href', 'https://doulacooperative.com/doulas/jane-doula');
  });

  it('should display "No" badge when no slug exists', async () => {
    // Arrange & Act
    await setup({ slug: undefined });

    // Assert
    expect(await screen.findByText('No')).toBeVisible();
  });

  it('should display subscription dates', async () => {
    // Arrange
    const profile = createMockUnclaimedProfile({
      subscriptionStart: new Date('2024-01-15T12:00:00'),
      lastPayment: new Date('2024-02-15T12:00:00'),
      nextPayment: new Date('2024-03-15T12:00:00'),
    });

    // Act
    await setup({ profile });

    // Assert
    expect(await screen.findByText(/Jan 15, 2024/)).toBeVisible();
    expect(screen.getByText(/Feb 15, 2024/)).toBeVisible();
    expect(screen.getByText(/Mar 15, 2024/)).toBeVisible();
  });

  it('should display dash when payment dates are missing', async () => {
    // Arrange & Act
    await setup({ lastPayment: undefined, nextPayment: undefined });

    // Assert
    const lastPaymentLabel = await screen.findByText('Last Payment:');
    const lastPaymentValue = lastPaymentLabel.nextElementSibling;
    expect(lastPaymentValue).toHaveTextContent('—');

    const nextPaymentLabel = screen.getByText('Next Payment:');
    const nextPaymentValue = nextPaymentLabel.nextElementSibling;
    expect(nextPaymentValue).toHaveTextContent('—');
  });

  it('should display error message when loading fails', async () => {
    // Suppress console.error during this test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty - we're just suppressing console output in tests
    });

    // Arrange & Act
    await setup({ shouldFailLoad: true });

    // Assert
    expect(
      await screen.findByText('Failed to load unclaimed profile details. Please try again.'),
    ).toBeVisible();

    consoleErrorSpy.mockRestore();
  });

  it('should show Update Email button', async () => {
    // Arrange & Act
    await setup();

    // Assert
    const button = await screen.findByRole('button', { name: 'Update Email' });
    expect(button).toBeVisible();
  });

  it('should show update email form when Update Email button clicked', async () => {
    // Arrange
    const { user } = await setup();

    const updateButton = await screen.findByRole('button', { name: 'Update Email' });

    // Act
    await user.click(updateButton);

    // Assert
    expect(screen.getByLabelText('New Email Address')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirm Update' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  it('should hide update email form when Cancel clicked', async () => {
    // Arrange
    const { user } = await setup();

    const updateButton = await screen.findByRole('button', { name: 'Update Email' });
    await user.click(updateButton);
    expect(screen.getByLabelText('New Email Address')).toBeVisible();

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.queryByLabelText('New Email Address')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Email' })).toBeVisible();
  });

  it('should disable Confirm Update button when email input is empty', async () => {
    // Arrange
    const { user } = await setup();

    const updateButton = await screen.findByRole('button', { name: 'Update Email' });

    // Act
    await user.click(updateButton);

    // Assert
    expect(screen.getByRole('button', { name: 'Confirm Update' })).toBeDisabled();
  });

  it('should navigate to new email route after successful update email', async () => {
    // Arrange
    const { user, router } = await setup();

    // Act
    await user.click(await screen.findByRole('button', { name: 'Update Email' }));
    await user.type(screen.getByLabelText('New Email Address'), 'updated@example.com');
    await user.click(screen.getByRole('button', { name: 'Confirm Update' }));

    // Assert
    expect(router.navigate).toHaveBeenCalledWith(['/admin/unclaimed', 'updated@example.com']);
  });

  it('should not navigate when update email fails', async () => {
    // Arrange
    const { user, router } = await setup({ shouldFailUpdateEmail: true });

    // Act
    await user.click(await screen.findByRole('button', { name: 'Update Email' }));
    await user.type(screen.getByLabelText('New Email Address'), 'updated@example.com');
    await user.click(screen.getByRole('button', { name: 'Confirm Update' }));

    // Assert
    expect(router.navigate).not.toHaveBeenCalled();
    expect(screen.getByText('Failed to update email.')).toBeVisible();
  });
});

interface SetupOptions {
  email?: string;
  profile?: UnclaimedProfile;
  slug?: string | undefined;
  lastPayment?: Date | undefined;
  nextPayment?: Date | undefined;
  shouldFailLoad?: boolean;
  shouldFailUpdateEmail?: boolean;
  shouldFailDraft?: boolean;
  shouldKeepLoading?: boolean;
  draftWarning?: string;
  draftInProgress?: boolean;
  errorMessage?: string;
}

async function setup(rawOptions: SetupOptions = {}) {
  const {
    email = 'test@example.com',
    profile,
    slug,
    lastPayment,
    nextPayment,
    shouldFailLoad = false,
    shouldFailUpdateEmail = false,
    shouldFailDraft = false,
    shouldKeepLoading = false,
    draftWarning,
    draftInProgress = false,
    errorMessage = 'Failed to load unclaimed profile details. Please try again.',
  } = rawOptions;

  const hasSlugOverride = 'slug' in rawOptions;
  const hasLastPaymentOverride = 'lastPayment' in rawOptions;
  const hasNextPaymentOverride = 'nextPayment' in rawOptions;

  // Build the profile with defaults and overrides
  const baseProfile = createMockUnclaimedProfile({ email });
  const finalProfile =
    profile ??
    ({
      ...baseProfile,
      ...(hasSlugOverride ? { slug } : {}),
      ...(hasLastPaymentOverride ? { lastPayment } : {}),
      ...(hasNextPaymentOverride ? { nextPayment } : {}),
    } as UnclaimedProfile);

  // Mock the service to avoid resource() lifecycle issues in CI
  const mockService = {
    unclaimedProfileResource: {
      isLoading: vi.fn(() => shouldKeepLoading),
      hasValue: vi.fn(() => !shouldKeepLoading && !shouldFailLoad),
      value: vi.fn(() => finalProfile),
      error: vi.fn(() => (shouldFailLoad ? new Error(errorMessage) : undefined)),
      reload: vi.fn(),
    },
    errorMessage: computed(() => (shouldFailLoad ? errorMessage : undefined)),
    actionInProgress: signal(false),
    successMessage: signal<string | undefined>(undefined),
    warningMessage: signal<string | undefined>(undefined),
    actionError: signal<string | undefined>(undefined),
    init: vi.fn(),
    updateEmail: vi.fn().mockImplementation(async (_oldEmail: string, newEmail: string) => {
      if (shouldFailUpdateEmail) {
        mockService.actionError.set('Failed to update email.');
        return;
      }
      mockService.successMessage.set(`Email updated to ${newEmail}`);
      return newEmail;
    }),
    deleteInProgress: signal(false),
    draftInProgress: signal(draftInProgress),
    deleteProfile: vi.fn().mockResolvedValue(undefined),
    draftProfile: vi.fn().mockImplementation(async () => {
      if (shouldFailDraft) {
        mockService.actionError.set('Failed to set profile to draft.');
        throw new Error('Draft failed');
      }
      mockService.successMessage.set(
        `Profile ${finalProfile.slug ?? 'test-user'} was set to draft.`,
      );
      if (draftWarning !== undefined) {
        mockService.warningMessage.set(draftWarning);
      }
    }),
  };

  const router = { navigate: vi.fn().mockResolvedValue(true) };

  await render(AdminUnclaimedProfileDetail, {
    bindings: [inputBinding('email', () => email)],
    providers: [provideRouter([]), { provide: Router, useValue: router }],
    configureTestBed: (testBed) => {
      testBed.overrideComponent(AdminUnclaimedProfileDetail, {
        set: {
          providers: [{ provide: AdminUnclaimedProfileDetailService, useValue: mockService }],
        },
      });
    },
  });

  // IMPORTANT: Call userEvent.setup() AFTER render() to avoid ApplicationRef destroyed warnings
  const user = userEvent.setup();

  return { user, router };
}

function createMockUnclaimedProfile(overrides: Partial<UnclaimedProfile> = {}): UnclaimedProfile {
  return {
    email: 'test@example.com',
    name: 'Test User',
    slug: 'test-user',
    subscriptionStart: new Date('2024-01-01'),
    ...overrides,
  };
}
