import { computed, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnclaimedProfile } from '../../admin.types';
import { AdminMembersService } from '../../services/admin-members.service';
import { AdminUnclaimedProfileDetail } from './admin-unclaimed-profile-detail';
import { AdminUnclaimedProfileDetailService } from './admin-unclaimed-profile-detail.service';

describe('AdminUnclaimedProfileDetail', () => {
  // Wait for resource() operations to complete before test cleanup
  // resource.reload() needs time to settle in CI environment
  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  it('should display loading state initially', async () => {
    // Arrange & Act
    const { resolveProfilePromise } = await setup({ shouldKeepLoading: true });

    // Assert - loading state should be visible
    expect(await screen.findByText('Loading details...')).toBeVisible();

    // Clean up - resolve the promise to avoid hanging test
    resolveProfilePromise(createMockUnclaimedProfile());
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
    const { component, router, mockService } = await setup();
    mockService.updateEmail.mockResolvedValue('updated@example.com');

    const instance = component.fixture.componentInstance as unknown as {
      updateEmailValue: { set(value: string): void };
      updateEmail(): Promise<void>;
    };
    instance.updateEmailValue.set('updated@example.com');

    // Act
    await instance.updateEmail();

    // Assert
    expect(router.navigate).toHaveBeenCalledWith(['/admin/unclaimed', 'updated@example.com']);
  });

  it('should not navigate when update email fails', async () => {
    // Arrange
    const { component, router } = await setup({ shouldFailUpdateEmail: true });

    const instance = component.fixture.componentInstance as unknown as {
      updateEmailValue: { set(value: string): void };
      updateEmail(): Promise<void>;
    };
    instance.updateEmailValue.set('updated@example.com');

    // Act
    await instance.updateEmail();

    // Assert
    expect(router.navigate).not.toHaveBeenCalled();
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
  shouldKeepLoading?: boolean;
  errorMessage?: string;
}

async function setup(options: SetupOptions = {}) {
  const {
    email = 'test@example.com',
    profile,
    slug,
    lastPayment,
    nextPayment,
    shouldFailLoad = false,
    shouldFailUpdateEmail = false,
    shouldKeepLoading = false,
    errorMessage = 'Failed to load unclaimed profile details. Please try again.',
  } = options;

  // Build the profile with defaults and overrides
  const baseProfile = createMockUnclaimedProfile({ email });
  const finalProfile =
    profile ??
    ({
      ...baseProfile,
      ...('slug' in options ? { slug } : {}),
      ...('lastPayment' in options ? { lastPayment } : {}),
      ...('nextPayment' in options ? { nextPayment } : {}),
    } as UnclaimedProfile);

  let resolveProfilePromise: (value: UnclaimedProfile) => void;
  const pendingProfilePromise = new Promise<UnclaimedProfile>((resolve) => {
    resolveProfilePromise = resolve;
  });

  let getProfileCallCount = 0;
  const getUnclaimedProfile = vi.fn().mockImplementation(() => {
    getProfileCallCount++;

    if (shouldKeepLoading) {
      return pendingProfilePromise;
    }

    if (shouldFailLoad && getProfileCallCount === 1) {
      return Promise.reject(new Error(errorMessage));
    }

    return Promise.resolve(finalProfile);
  });

  const mockAdminMembersService = {
    getUnclaimedProfile,
    updateEmail: vi.fn().mockImplementation(() => {
      if (shouldFailUpdateEmail) {
        return Promise.reject(new Error('Failed'));
      }
      return Promise.resolve({ success: true });
    }),
  };

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
    deleteProfile: vi.fn().mockResolvedValue(undefined),
  };

  const router = { navigate: vi.fn().mockResolvedValue(true) };

  const component = await render(AdminUnclaimedProfileDetail, {
    providers: [
      provideRouter([]),
      { provide: Router, useValue: router },
      { provide: AdminMembersService, useValue: mockAdminMembersService },
      { provide: AdminUnclaimedProfileDetailService, useValue: mockService },
    ],
    inputs: { email },
  });

  // IMPORTANT: Call userEvent.setup() AFTER render() to avoid ApplicationRef destroyed warnings
  const user = userEvent.setup();

  return {
    user,
    component,
    resolveProfilePromise: resolveProfilePromise!,
    mockAdminMembersService,
    mockService,
    router,
  };
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
