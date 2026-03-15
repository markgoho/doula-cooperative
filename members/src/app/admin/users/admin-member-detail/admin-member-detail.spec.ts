import { Router } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiMemberResponse } from '../../../api-types/api-member-response';
import { AdminMembersService } from '../../services/admin-members.service';
import { AdminMemberDetail } from './admin-member-detail';
import { AdminMemberDetailService } from './admin-member-detail.service';

const SEARCH_DEBOUNCE_DELAY = 300;

interface UnlinkedProfileFixture {
  slug: string;
  title: string;
  email: string;
  createdAt: string;
}

interface SetupOptions {
  uid?: string;
  member?: ApiMemberResponse;
  shouldFailLoad?: boolean;
  shouldFailActivate?: boolean;
  shouldFailCancel?: boolean;
  shouldFailCleanSlate?: boolean;
  shouldFailToggleDraft?: boolean;
  shouldFailLinkProfile?: boolean;
  shouldFailUnlinkedProfilesLoad?: boolean;
  shouldKeepLoading?: boolean;
  useFakeTimers?: boolean;
  errorMessage?: string;
  profileDraft?: boolean;
  unlinkedProfiles?: UnlinkedProfileFixture[];
  overrideListUnlinkedProfiles?: ReturnType<typeof vi.fn<() => Promise<UnlinkedProfileFixture[]>>>;
}

afterEach(() => {
  vi.useRealTimers();
});

async function advanceSearchDebounce(): Promise<void> {
  await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_DELAY);
}

function createUnlinkedProfile(
  overrides: Partial<UnlinkedProfileFixture> = {},
): UnlinkedProfileFixture {
  return {
    slug: 'matching-doula',
    title: 'Test User Doula',
    email: 'test@example.com',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createMockAdminMembersService({
  shouldKeepLoading,
  shouldFailLoad,
  errorMessage,
  memberToUse,
  shouldFailActivate,
  shouldFailCancel,
  shouldFailCleanSlate,
  uid,
  profileDraft,
  shouldFailToggleDraft,
  shouldFailUnlinkedProfilesLoad,
  unlinkedProfiles,
  shouldFailLinkProfile,
  overrideListUnlinkedProfiles,
}: {
  shouldKeepLoading: boolean;
  shouldFailLoad: boolean;
  errorMessage: string;
  memberToUse: ApiMemberResponse;
  shouldFailActivate: boolean;
  shouldFailCancel: boolean;
  shouldFailCleanSlate: boolean;
  uid: string;
  profileDraft: boolean;
  shouldFailToggleDraft: boolean;
  shouldFailUnlinkedProfilesLoad: boolean;
  unlinkedProfiles: UnlinkedProfileFixture[];
  shouldFailLinkProfile: boolean;
  overrideListUnlinkedProfiles?: ReturnType<typeof vi.fn<() => Promise<UnlinkedProfileFixture[]>>>;
}): {
  mockAdminMembersService: {
    getMember: ReturnType<typeof vi.fn>;
    activateMembership: ReturnType<typeof vi.fn>;
    cancelMembership: ReturnType<typeof vi.fn>;
    cleanSlateDelete: ReturnType<typeof vi.fn>;
    readMemberProfile: ReturnType<typeof vi.fn>;
    toggleProfileDraft: ReturnType<typeof vi.fn>;
    listUnlinkedProfiles: ReturnType<typeof vi.fn>;
    linkProfile: ReturnType<typeof vi.fn>;
  };
  resolveMemberPromise: (value: ApiMemberResponse) => void;
} {
  let resolveMemberPromise!: (value: ApiMemberResponse) => void;
  const pendingMemberPromise = new Promise<ApiMemberResponse>((resolve) => {
    resolveMemberPromise = resolve;
  });

  const mockAdminMembersService = {
    getMember: vi.fn().mockImplementation(() => {
      if (shouldKeepLoading) {
        return pendingMemberPromise;
      }

      if (shouldFailLoad) {
        return Promise.reject(new Error(errorMessage));
      }

      return Promise.resolve(memberToUse);
    }),
    activateMembership: shouldFailActivate
      ? vi.fn().mockRejectedValue(new Error('Failed'))
      : vi.fn().mockResolvedValue({ success: true }),
    cancelMembership: shouldFailCancel
      ? vi.fn().mockRejectedValue(new Error('Failed'))
      : vi.fn().mockResolvedValue({ success: true }),
    cleanSlateDelete: shouldFailCleanSlate
      ? vi.fn().mockRejectedValue(new Error('Failed'))
      : vi.fn().mockResolvedValue({
          success: true,
          deletedUid: uid,
          memberDocumentDeleted: true,
          authUserDeleted: true,
        }),
    readMemberProfile: vi.fn().mockResolvedValue({
      title: 'Test Doula',
      bio: 'Mock profile content',
      credentials: 'CD(DONA)',
      pronouns: 'she/her',
      tags: ['birth-doula'],
      image: 'https://example.com/image.jpg',
      slug: 'test-slug',
      draft: profileDraft,
    }),
    toggleProfileDraft: shouldFailToggleDraft
      ? vi.fn().mockRejectedValue(new Error('Failed'))
      : vi.fn().mockResolvedValue({
          success: true,
          slug: 'test-slug',
          draft: !profileDraft,
        }),
    listUnlinkedProfiles:
      overrideListUnlinkedProfiles ??
      (shouldFailUnlinkedProfilesLoad
        ? vi.fn().mockRejectedValue(new Error('Failed'))
        : vi.fn().mockResolvedValue(unlinkedProfiles)),
    linkProfile: shouldFailLinkProfile
      ? vi.fn().mockRejectedValue(new Error('Failed'))
      : vi.fn().mockResolvedValue(memberToUse),
  };

  return { mockAdminMembersService, resolveMemberPromise };
}

async function renderAdminMemberDetail({
  uid,
  mockAdminMembersService,
  mockRouter,
}: {
  uid: string;
  mockAdminMembersService: {
    getMember: ReturnType<typeof vi.fn>;
    activateMembership: ReturnType<typeof vi.fn>;
    cancelMembership: ReturnType<typeof vi.fn>;
    cleanSlateDelete: ReturnType<typeof vi.fn>;
    readMemberProfile: ReturnType<typeof vi.fn>;
    toggleProfileDraft: ReturnType<typeof vi.fn>;
    listUnlinkedProfiles: ReturnType<typeof vi.fn>;
    linkProfile: ReturnType<typeof vi.fn>;
  };
  mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };
}) {
  return render(AdminMemberDetail, {
    providers: [
      { provide: AdminMembersService, useValue: mockAdminMembersService },
      { provide: Router, useValue: mockRouter },
      AdminMemberDetailService,
    ],
    inputs: { uid },
  });
}

async function flushInitialSearchDebounce({
  member,
}: {
  member: ApiMemberResponse;
}): Promise<void> {
  if (member.slug !== undefined) {
    return;
  }

  await advanceSearchDebounce();
  await Promise.resolve();
}

async function setup({
  uid = 'test-uid-123',
  member,
  shouldFailLoad = false,
  shouldFailActivate = false,
  shouldFailCancel = false,
  shouldFailCleanSlate = false,
  shouldFailToggleDraft = false,
  shouldFailLinkProfile = false,
  shouldFailUnlinkedProfilesLoad = false,
  shouldKeepLoading = false,
  useFakeTimers = false,
  errorMessage = 'Failed to load member details. Please try again.',
  profileDraft = true,
  unlinkedProfiles = [],
  overrideListUnlinkedProfiles,
}: SetupOptions = {}) {
  if (useFakeTimers) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  }

  const defaultMember = createMockMember({ uid });
  const memberToUse = member ?? defaultMember;

  const { mockAdminMembersService, resolveMemberPromise } = createMockAdminMembersService({
    shouldKeepLoading,
    shouldFailLoad,
    errorMessage,
    memberToUse,
    shouldFailActivate,
    shouldFailCancel,
    shouldFailCleanSlate,
    uid,
    profileDraft,
    shouldFailToggleDraft,
    shouldFailUnlinkedProfilesLoad,
    unlinkedProfiles,
    shouldFailLinkProfile,
    ...(overrideListUnlinkedProfiles !== undefined && { overrideListUnlinkedProfiles }),
  });

  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(true),
  };

  const component = await renderAdminMemberDetail({
    uid,
    mockAdminMembersService,
    mockRouter,
  });

  const user = useFakeTimers
    ? userEvent.setup({
        advanceTimers: async (delay) => {
          await vi.advanceTimersByTimeAsync(delay);
        },
      })
    : userEvent.setup();

  await flushInitialSearchDebounce({ member: memberToUse });

  return {
    user,
    component,
    resolveMemberPromise,
    mockAdminMembersService,
    mockRouter,
  };
}

function createMockMember(overrides: Partial<ApiMemberResponse> = {}): ApiMemberResponse {
  const member: ApiMemberResponse = {
    uid: 'test-uid-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: '2024-01-15T10:30:00.000Z',
    isAdmin: false,
    membershipActive: false,
    subscriptionStart: '2024-01-01T00:00:00.000Z',
    membershipExpiresAt: '2025-01-01T00:00:00.000Z',
    slug: 'test-slug',
    ...overrides,
  };

  return member;
}

function createMockMemberWithoutSlug(
  overrides: Partial<ApiMemberResponse> = {},
): ApiMemberResponse {
  const member = createMockMember(overrides);
  delete member.slug;
  return member;
}

describe('AdminUserDetail', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  it('should display loading state initially', async () => {
    const { resolveMemberPromise } = await setup({ shouldKeepLoading: true });

    expect(await screen.findByText('Loading details...')).toBeVisible();

    resolveMemberPromise(createMockMember());
  });

  it('should display user account information', async () => {
    const member = createMockMember({
      name: 'Alice Smith',
      email: 'alice@example.com',
      uid: 'user-123',
    });

    await setup({ member });

    expect(await screen.findByText('Alice Smith')).toBeVisible();
    expect(screen.getByText('alice@example.com')).toBeVisible();
    expect(screen.getByText('user-123')).toBeVisible();
  });

  it('should display dash when user has no name', async () => {
    const member = createMockMember();
    delete (member as Partial<ApiMemberResponse>).name;

    await setup({ member });

    const nameLabel = await screen.findByText('Name:');
    const nameValue = nameLabel.parentElement?.querySelector('dd');
    expect(nameValue).toHaveTextContent('—');
  });

  it('should display formatted account creation date', async () => {
    const member = createMockMember({
      createdAt: '2024-03-15T14:30:00.000Z',
    });

    await setup({ member });

    expect(await screen.findByText(/Mar 15, 2024/)).toBeVisible();
  });

  it('should display active status badge for active members', async () => {
    const member = createMockMember({ membershipActive: true });

    await setup({ member });

    expect(await screen.findByText('Active')).toBeVisible();
  });

  it('should display inactive status badge for inactive members', async () => {
    const member = createMockMember({ membershipActive: false });

    await setup({ member });

    expect(await screen.findByText('Inactive')).toBeVisible();
  });

  it('should display subscription dates', async () => {
    const member = createMockMember({
      createdAt: '2024-01-01T10:30:00.000Z',
      subscriptionStart: '2024-01-15T12:00:00.000Z',
      membershipExpiresAt: '2025-01-15T12:00:00.000Z',
    });

    await setup({ member });

    const subscriptionLabel = await screen.findByText('Subscription Start:');
    const subscriptionValue = subscriptionLabel.nextElementSibling;
    expect(subscriptionValue).toHaveTextContent(/Jan 15, 2024/);

    const expiresLabel = screen.getByText('Membership Expires:');
    const expiresValue = expiresLabel.nextElementSibling;
    expect(expiresValue).toHaveTextContent(/Jan 15, 2025/);
  });

  it('should display dash when subscription dates are missing', async () => {
    const member = createMockMember();
    delete (member as Partial<ApiMemberResponse>).subscriptionStart;
    delete (member as Partial<ApiMemberResponse>).membershipExpiresAt;

    await setup({ member });

    const subscriptionLabel = await screen.findByText('Subscription Start:');
    const subscriptionValue = subscriptionLabel.parentElement?.querySelector('dd');
    expect(subscriptionValue).toHaveTextContent('—');
  });

  it('should display Stripe information when present', async () => {
    const member = createMockMember({
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_456',
      subscriptionStatus: 'active',
    });

    await setup({ member });

    expect(await screen.findByText('cus_123')).toBeVisible();
    expect(screen.getByText('sub_456')).toBeVisible();
  });

  it('should not display Stripe section when not a Stripe customer', async () => {
    const member = createMockMember();
    delete (member as Partial<ApiMemberResponse>).stripeCustomerId;

    await setup({ member });

    expect(screen.queryByText('Stripe Customer ID:')).toBeNull();
  });

  it('should display Activate button for inactive members', async () => {
    const member = createMockMember({ membershipActive: false });

    await setup({ member });

    expect(await screen.findByRole('button', { name: 'Activate Membership' })).toBeVisible();
  });

  it('should display Cancel Membership button for active members', async () => {
    const member = createMockMember({ membershipActive: true });

    await setup({ member });

    expect(await screen.findByRole('button', { name: 'Cancel Membership' })).toBeVisible();
  });

  it('should show warning for Stripe-managed subscriptions', async () => {
    const member = createMockMember({
      stripeCustomerId: 'cus_123',
    });

    await setup({ member });

    expect(await screen.findByText(/This membership is managed by Stripe/)).toBeVisible();
  });

  it('should show success message after activating membership', async () => {
    const member = createMockMember({ membershipActive: false });
    const { user } = await setup({ member });

    expect(await screen.findByRole('button', { name: 'Activate Membership' })).toBeVisible();

    const activateButton = screen.getByRole('button', { name: 'Activate Membership' });
    await user.click(activateButton);

    const confirmButton = screen.getByRole('button', { name: 'Activate' });
    await user.click(confirmButton);

    expect(await screen.findByText('Membership activated successfully')).toBeVisible();
  });

  it('should show error message when activation fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty - we're just suppressing console output in tests
    });

    const member = createMockMember({ membershipActive: false });
    const { user } = await setup({ member, shouldFailActivate: true });

    expect(await screen.findByRole('button', { name: 'Activate Membership' })).toBeVisible();

    const activateButton = screen.getByRole('button', { name: 'Activate Membership' });
    await user.click(activateButton);

    const confirmButton = screen.getByRole('button', { name: 'Activate' });
    await user.click(confirmButton);

    expect(await screen.findByText('Failed to activate membership.')).toBeVisible();

    consoleErrorSpy.mockRestore();
  });

  it('should not activate when user cancels confirmation', async () => {
    const member = createMockMember({ membershipActive: false });
    const { user } = await setup({ member });

    expect(await screen.findByRole('button', { name: 'Activate Membership' })).toBeVisible();

    const activateButton = screen.getByRole('button', { name: 'Activate Membership' });
    await user.click(activateButton);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(screen.queryByText('Membership activated successfully')).toBeNull();
  });

  it('should display error message when loading fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty - we're just suppressing console output in tests
    });

    await setup({ shouldFailLoad: true });

    expect(
      await screen.findByText('Failed to load member details. Please try again.'),
    ).toBeVisible();

    consoleErrorSpy.mockRestore();
  });

  it('should display clean slate delete button for non-admin users', async () => {
    const member = createMockMember({ isAdmin: false });

    await setup({ member });

    expect(await screen.findByRole('button', { name: 'Clean Slate Delete' })).toBeVisible();
    expect(screen.getByText('Clean Slate Delete', { selector: 'h3' })).toBeVisible();
  });

  it('should hide clean slate delete button for admin users', async () => {
    const member = createMockMember({ isAdmin: true });

    await setup({ member });

    expect(await screen.findByText('Admin Account')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Clean Slate Delete' })).toBeNull();
  });

  it('should show confirmation dialog when clicking clean slate delete', async () => {
    const member = createMockMember({ isAdmin: false });
    const { user } = await setup({ member });

    expect(await screen.findByRole('button', { name: 'Clean Slate Delete' })).toBeVisible();

    const cleanSlateButton = screen.getByRole('button', { name: 'Clean Slate Delete' });
    await user.click(cleanSlateButton);

    expect(screen.getByText(/This will completely remove the user from ALL systems/)).toBeVisible();
  });

  it('should show error message when clean slate delete fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty - we're just suppressing console output in tests
    });

    const member = createMockMember({ isAdmin: false });
    const { user } = await setup({ member, shouldFailCleanSlate: true });

    expect(await screen.findByRole('button', { name: 'Clean Slate Delete' })).toBeVisible();

    const cleanSlateButton = screen.getByRole('button', { name: 'Clean Slate Delete' });
    await user.click(cleanSlateButton);

    const cleanSlateButtons = screen.getAllByRole('button', { name: 'Clean Slate Delete' });
    const dialogConfirmButton = cleanSlateButtons.at(-1)!;
    await user.click(dialogConfirmButton);

    expect(await screen.findByText('Failed to perform clean slate delete.')).toBeVisible();

    consoleErrorSpy.mockRestore();
  });

  it('should navigate to members list after successful clean slate delete', async () => {
    const member = createMockMember({ isAdmin: false });
    const { user, mockRouter } = await setup({ member });

    expect(await screen.findByText('Clean Slate Delete', { selector: 'h3' })).toBeVisible();

    const cleanSlateButton = screen.getByRole('button', { name: 'Clean Slate Delete' });
    await user.click(cleanSlateButton);

    const cleanSlateButtons = screen.getAllByRole('button', { name: 'Clean Slate Delete' });
    const dialogConfirmButton = cleanSlateButtons.at(-1)!;
    await user.click(dialogConfirmButton);

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/members']);
  });

  it('should display Publish Profile button when profile is draft', async () => {
    const member = createMockMember({ slug: 'test-slug' });
    const { user } = await setup({ member, profileDraft: true });

    const viewProfileButton = await screen.findByRole('button', { name: 'View Profile Content' });
    await user.click(viewProfileButton);

    expect(await screen.findByText('Draft (Unpublished)')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Publish Profile' })).toBeVisible();
  });

  it('should display Unpublish Profile button when profile is published', async () => {
    const member = createMockMember({ slug: 'test-slug' });
    const { user } = await setup({ member, profileDraft: false });

    const viewProfileButton = await screen.findByRole('button', { name: 'View Profile Content' });
    await user.click(viewProfileButton);

    expect(await screen.findByText('Published')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Unpublish Profile' })).toBeVisible();
  });

  it('should show confirmation dialog when clicking Publish Profile', async () => {
    const member = createMockMember({ slug: 'test-slug' });
    const { user } = await setup({ member, profileDraft: true });

    const viewProfileButton = await screen.findByRole('button', { name: 'View Profile Content' });
    await user.click(viewProfileButton);

    const publishButton = await screen.findByRole('button', { name: 'Publish Profile' });
    await user.click(publishButton);

    expect(
      screen.getByText(/This will publish the profile, making it visible on the public website/),
    ).toBeVisible();
  });

  it('should show success message after toggling draft status', async () => {
    const member = createMockMember({ slug: 'test-slug' });
    const { user } = await setup({ member, profileDraft: true });

    const viewProfileButton = await screen.findByRole('button', { name: 'View Profile Content' });
    await user.click(viewProfileButton);

    const publishButton = await screen.findByRole('button', { name: 'Publish Profile' });
    await user.click(publishButton);

    const confirmButton = screen.getByRole('button', { name: 'Publish' });
    await user.click(confirmButton);

    expect(await screen.findByText('Profile published successfully')).toBeVisible();
  });

  it('should show error message when toggle draft fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty - we're just suppressing console output in tests
    });

    const member = createMockMember({ slug: 'test-slug' });
    const { user } = await setup({ member, profileDraft: true, shouldFailToggleDraft: true });

    const viewProfileButton = await screen.findByRole('button', { name: 'View Profile Content' });
    await user.click(viewProfileButton);

    const publishButton = await screen.findByRole('button', { name: 'Publish Profile' });
    await user.click(publishButton);

    const confirmButton = screen.getByRole('button', { name: 'Publish' });
    await user.click(confirmButton);

    expect(await screen.findByText('Failed to toggle profile draft status.')).toBeVisible();

    consoleErrorSpy.mockRestore();
  });

  it('should prefill the profile search with the member email and show matching results', async () => {
    const member = createMockMemberWithoutSlug();

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [
        createUnlinkedProfile(),
        createUnlinkedProfile({
          slug: 'other-doula',
          title: 'Other Doula',
          email: 'other@example.com',
        }),
      ],
    });

    const searchInput = (await screen.findByLabelText('Search profiles')) as HTMLInputElement;
    expect(await screen.findByRole('heading', { name: 'Link Existing Profile' })).toBeVisible();
    expect(searchInput.value).toBe('test@example.com');
    expect(await screen.findByText('1 of 2 profiles')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Full Name' })).toBeVisible();
    expect(screen.getByText('Test User Doula')).toBeVisible();
    expect(screen.queryByText('Other Doula')).toBeNull();
  });

  it('should filter profiles based on the search term', async () => {
    const member = createMockMemberWithoutSlug();
    const { user } = await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [
        createUnlinkedProfile(),
        createUnlinkedProfile({
          slug: 'sunrise-doula',
          title: 'Sunrise Doula',
          email: 'sunrise@example.com',
        }),
      ],
    });

    const searchInput = await screen.findByLabelText('Search profiles');
    await user.clear(searchInput);
    await advanceSearchDebounce();
    await user.type(searchInput, 'sunrise');
    await advanceSearchDebounce();

    await waitFor(() => {
      expect(screen.getByText('Sunrise Doula')).toBeVisible();
    });
    expect(screen.queryByText('Test User Doula')).toBeNull();
    expect(screen.getByText('1 of 2 profiles')).toBeVisible();
  });

  it('should hide results when the search is cleared', async () => {
    const member = createMockMemberWithoutSlug();
    const { user } = await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    const searchInput = await screen.findByLabelText('Search profiles');
    await user.clear(searchInput);
    await advanceSearchDebounce();

    await waitFor(() => {
      expect(screen.queryByRole('table')).toBeNull();
    });
    expect(screen.getByText('0 of 1 profiles')).toBeVisible();
    expect(screen.queryByText('No profiles match your search.')).toBeNull();
  });

  it('should show no match message when the search has no results', async () => {
    const member = createMockMemberWithoutSlug();
    const { user } = await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    const searchInput = await screen.findByLabelText('Search profiles');
    await user.clear(searchInput);
    await advanceSearchDebounce();
    await user.type(searchInput, 'zzz');
    await advanceSearchDebounce();

    expect(await screen.findByText('No profiles match your search.')).toBeVisible();
    expect(screen.getByText('0 of 1 profiles')).toBeVisible();
  });

  it('should debounce search updates before showing filtered results', async () => {
    const member = createMockMemberWithoutSlug();
    const { user } = await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [
        createUnlinkedProfile(),
        createUnlinkedProfile({
          slug: 'sunrise-doula',
          title: 'Sunrise Doula',
          email: 'sunrise@example.com',
        }),
      ],
    });

    const searchInput = await screen.findByLabelText('Search profiles');
    await user.clear(searchInput);
    await advanceSearchDebounce();
    await user.type(searchInput, 'sun');

    expect(screen.getByText('0 of 2 profiles')).toBeVisible();
    expect(screen.queryByText('Sunrise Doula')).toBeNull();

    await advanceSearchDebounce();
    await waitFor(() => {
      expect(screen.getByText('Sunrise Doula')).toBeVisible();
    });
  });

  it('should open the link confirmation dialog', async () => {
    const member = createMockMemberWithoutSlug();
    const { user } = await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    const linkButton = await screen.findByRole('button', { name: 'Link' });
    await user.click(linkButton);

    expect(screen.getByText(/Link profile "Test User Doula" \(matching-doula\) to this member/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Link Profile' })).toBeVisible();
  });

  it('should show success banner after linking a profile', async () => {
    const member = createMockMemberWithoutSlug();
    const { user } = await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    const linkButton = await screen.findByRole('button', { name: 'Link' });
    await user.click(linkButton);

    const confirmButton = screen.getByRole('button', { name: 'Link Profile' });
    await user.click(confirmButton);

    expect(await screen.findByText('Profile "matching-doula" linked successfully')).toBeVisible();
  });

  it('should show error banner when linking a profile fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty - we're just suppressing console output in tests
    });

    const member = createMockMemberWithoutSlug();
    const { user } = await setup({
      member,
      useFakeTimers: true,
      shouldFailLinkProfile: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    const linkButton = await screen.findByRole('button', { name: 'Link' });
    await user.click(linkButton);

    const confirmButton = screen.getByRole('button', { name: 'Link Profile' });
    await user.click(confirmButton);

    expect(await screen.findByText('Failed to link profile.')).toBeVisible();

    consoleErrorSpy.mockRestore();
  });

  it('should show inline error state when unlinked profiles fail to load', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty - we're just suppressing console output in tests
    });

    const listUnlinkedProfiles = vi
      .fn<() => Promise<UnlinkedProfileFixture[]>>()
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce([createUnlinkedProfile()]);

    const member = createMockMemberWithoutSlug();
    const { user, mockAdminMembersService } = await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
      overrideListUnlinkedProfiles: listUnlinkedProfiles,
    });

    expect(await screen.findByText('Failed to load unlinked profiles. Please try again.')).toBeVisible();

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    await user.click(retryButton);
    await waitFor(() => {
      expect(mockAdminMembersService.listUnlinkedProfiles).toHaveBeenCalledTimes(2);
    });

    consoleErrorSpy.mockRestore();
  });


  it('should cancel link dialog without linking', async () => {
    const member = createMockMemberWithoutSlug();
    const { user } = await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    const linkButton = await screen.findByRole('button', { name: 'Link' });
    await user.click(linkButton);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(screen.queryByText('Profile "matching-doula" linked successfully')).toBeNull();
  });
});
