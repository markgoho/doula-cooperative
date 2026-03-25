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
  shouldFailApproveProfile?: boolean;
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
  shouldFailApproveProfile,
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
  shouldFailApproveProfile: boolean;
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
    approveProfile: ReturnType<typeof vi.fn>;
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
    readMemberProfile: vi.fn().mockImplementation(() =>
      Promise.resolve({
        title: 'Test Doula',
        bio: 'Mock profile content',
        credentials: 'CD(DONA)',
        pronouns: 'she/her',
        tags: ['birth-doula'],
        image: 'https://example.com/image.jpg',
        slug: 'test-slug',
        draft: profileDraft,
      }),
    ),
    toggleProfileDraft: shouldFailToggleDraft
      ? vi.fn().mockRejectedValue(new Error('Failed'))
      : vi.fn().mockResolvedValue({
          success: true,
          slug: 'test-slug',
          draft: !profileDraft,
        }),
    approveProfile: shouldFailApproveProfile
      ? vi.fn().mockRejectedValue(new Error('Failed'))
      : vi.fn().mockResolvedValue(memberToUse),
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
    approveProfile: ReturnType<typeof vi.fn>;
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
  shouldFailApproveProfile = false,
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
    shouldFailApproveProfile,
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

  it('should build the admin profile image URL after loading profile status', async () => {
    const member = createMockMember({ slug: 'jane-doe' });
    const { user, component } = await setup({ member });

    const loadStatusButton = await screen.findByRole('button', { name: 'Load Profile Status' });
    await user.click(loadStatusButton);

    const service = component.fixture.componentRef.injector.get(AdminMemberDetailService);
    expect(service.profileImageUrl()).toBe(
      'https://ik.imagekit.io/doulacoop/tr:w-300,h-300,fo-face,z-0.5,di-default-profile.png/doulas/jane-doe/jane-doe-profile',
    );
  });

  it('should leave the admin profile image URL undefined before profile status loads', async () => {
    const member = createMockMember({ slug: 'jane-doe' });
    const { component } = await setup({ member });

    const service = component.fixture.componentRef.injector.get(AdminMemberDetailService);
    expect(service.profileImageUrl()).toBeUndefined();
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

  it('should display profile approval status when approved', async () => {
    const member = createMockMember({
      profileApprovedAt: '2024-03-15T14:30:00.000Z',
    });

    await setup({ member });

    expect(await screen.findByText(/Approved on Mar 15, 2024/)).toBeVisible();
  });

  it('should display profile approval status when not approved', async () => {
    const member = createMockMember();
    delete member.profileApprovedAt;

    await setup({ member });

    expect(await screen.findByText('Not approved')).toBeVisible();
  });

  it('should show approve profile action when member is not approved', async () => {
    const member = createMockMember();
    delete member.profileApprovedAt;

    await setup({ member });

    expect(await screen.findByRole('button', { name: 'Approve Profile Work' })).toBeVisible();
  });

  it('should hide approve profile action when member is already approved', async () => {
    const member = createMockMember({
      profileApprovedAt: '2024-03-15T14:30:00.000Z',
    });

    await setup({ member });

    expect(screen.queryByRole('button', { name: 'Approve Profile Work' })).toBeNull();
  });

  it('should explain that linking also approves profile editing', async () => {
    const member = createMockMemberWithoutSlug({
      membershipActive: true,
    });

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(
      await screen.findByText(
        'Linking an existing profile will also approve this member to edit that profile.',
      ),
    ).toBeVisible();
  });

  it('should show success banner after linking a profile with approval', async () => {
    const member = createMockMemberWithoutSlug({
      membershipActive: true,
    });
    const { user } = await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    const linkButton = await screen.findByRole('button', { name: 'Link' });
    await user.click(linkButton);
    await user.click(screen.getByRole('button', { name: 'Link Profile' }));

    expect(await screen.findByText('Profile "matching-doula" linked and approved successfully')).toBeVisible();
  });

  it('should keep existing link success behavior visible to admins', async () => {
    const member = createMockMemberWithoutSlug({
      membershipActive: true,
    });
    const { user } = await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    await user.click(await screen.findByRole('button', { name: 'Link' }));
    await user.click(screen.getByRole('button', { name: 'Link Profile' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Profile "matching-doula" linked and approved successfully',
    );
  });

  it('should keep approval status text visible after linking existing profiles', async () => {
    const member = createMockMemberWithoutSlug({
      membershipActive: true,
    });

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(await screen.findByText('Not approved')).toBeVisible();
  });

  it('should still offer linking flow for inactive members without a slug', async () => {
    const member = createMockMemberWithoutSlug({
      membershipActive: false,
    });

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(await screen.findByRole('heading', { name: 'Link Existing Profile' })).toBeVisible();
  });

  it('should still show profile approval state for inactive members', async () => {
    const member = createMockMemberWithoutSlug({
      membershipActive: false,
    });

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(await screen.findByText('Not approved')).toBeVisible();
  });

  it('should keep load profile status available for linked members before loading', async () => {
    const member = createMockMember({
      slug: 'test-slug',
      membershipActive: true,
    });

    await setup({ member });

    expect(await screen.findByRole('button', { name: 'Load Profile Status' })).toBeVisible();
  });

  it('should keep profile section lazy until status is loaded', async () => {
    const member = createMockMember({
      slug: 'test-slug',
      membershipActive: true,
    });

    await setup({ member });

    expect(screen.queryByRole('link', { name: 'Edit Profile' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publish Profile' })).toBeNull();
  });

  it('should still show profile slug details for linked members before profile load', async () => {
    const member = createMockMember({
      slug: 'test-slug',
      membershipActive: true,
    });

    await setup({ member });

    expect(await screen.findByText('test-slug')).toBeVisible();
  });

  it('should keep profile approval state independent from lazy profile controls', async () => {
    const member = createMockMember({
      slug: 'test-slug',
      membershipActive: true,
      profileApprovedAt: '2024-03-15T14:30:00.000Z',
    });

    await setup({ member });

    expect(await screen.findByText(/Approved on Mar 15, 2024/)).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Load Profile Status' })).toBeVisible();
  });

  it('should hide approve profile work for already approved linked members', async () => {
    const member = createMockMember({
      slug: 'test-slug',
      membershipActive: true,
      profileApprovedAt: '2024-03-15T14:30:00.000Z',
    });

    await setup({ member });

    expect(screen.queryByRole('button', { name: 'Approve Profile Work' })).toBeNull();
  });

  it('should still allow approval action for inactive linked members without approval', async () => {
    const member = createMockMember({
      slug: 'test-slug',
      membershipActive: false,
    });
    delete member.profileApprovedAt;

    await setup({ member });

    expect(await screen.findByRole('button', { name: 'Approve Profile Work' })).toBeVisible();
  });

  it('should keep success banner test aligned with approval-aware link copy', async () => {
    const member = createMockMemberWithoutSlug({
      membershipActive: true,
    });
    const { user } = await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    await user.click(await screen.findByRole('button', { name: 'Link' }));
    await user.click(screen.getByRole('button', { name: 'Link Profile' }));

    expect(await screen.findByText(/linked and approved successfully/)).toBeVisible();
  });

  it('should preserve inactive member link helper copy', async () => {
    const member = createMockMemberWithoutSlug({
      membershipActive: false,
    });

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(
      await screen.findByText(
        'Linking an existing profile will also approve this member to edit that profile.',
      ),
    ).toBeVisible();
  });

  it('should not require membership activation before rendering link helper copy', async () => {
    const member = createMockMemberWithoutSlug({
      membershipActive: false,
    });

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(await screen.findByRole('heading', { name: 'Link Existing Profile' })).toBeVisible();
  });

  it('should keep approval button text stable for unapproved members', async () => {
    const member = createMockMember({
      membershipActive: true,
    });
    delete member.profileApprovedAt;

    await setup({ member });

    expect(await screen.findByRole('button', { name: 'Approve Profile Work' })).toBeVisible();
  });

  it('should keep load profile status text stable for linked members', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member });

    expect(await screen.findByRole('button', { name: 'Load Profile Status' })).toBeVisible();
  });

  it('should keep profile controls hidden before load for published profiles', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member, profileDraft: false });

    expect(screen.queryByRole('button', { name: 'Unpublish Profile' })).toBeNull();
  });

  it('should keep profile controls hidden before load for draft profiles', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member, profileDraft: true });

    expect(screen.queryByRole('button', { name: 'Publish Profile' })).toBeNull();
  });

  it('should keep edit profile link hidden before load for linked members', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member });

    expect(screen.queryByRole('link', { name: 'Edit Profile' })).toBeNull();
  });

  it('should keep view profile link hidden before load for linked members', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member });

    expect(screen.queryByRole('link', { name: 'View Profile' })).toBeNull();
  });

  it('should only show profile slug details prior to profile load for linked members', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member });

    expect(await screen.findByText('test-slug')).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Load Profile Status' })).toBeVisible();
  });

  it('should keep link helper section available when unlinked profiles exist', async () => {
    const member = createMockMemberWithoutSlug({
      membershipActive: true,
    });

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(await screen.findByLabelText('Search profiles')).toBeVisible();
  });

  it('should not auto-load profile controls when member has slug', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member, profileDraft: true });

    expect(await screen.findByRole('button', { name: 'Load Profile Status' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Publish Profile' })).toBeNull();
  });

  it('should show profile approval as not approved for linked members without approval timestamp', async () => {
    const member = createMockMember({ slug: 'test-slug' });
    delete member.profileApprovedAt;

    await setup({ member });

    expect(await screen.findByText('Not approved')).toBeVisible();
  });

  it('should show profile approval timestamp for approved linked members before profile load', async () => {
    const member = createMockMember({
      slug: 'test-slug',
      profileApprovedAt: '2024-03-15T14:30:00.000Z',
    });

    await setup({ member });

    expect(await screen.findByText(/Approved on Mar 15, 2024/)).toBeVisible();
  });

  it('should still show link section approval helper for unlinked members without approval', async () => {
    const member = createMockMemberWithoutSlug();

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(
      await screen.findByText(
        'Linking an existing profile will also approve this member to edit that profile.',
      ),
    ).toBeVisible();
  });

  it('should not auto-open profile editor links before load', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member });

    expect(screen.queryByRole('link', { name: 'Edit Profile' })).toBeNull();
  });

  it('should not auto-open profile viewer links before load', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member });

    expect(screen.queryByRole('link', { name: 'View Profile' })).toBeNull();
  });

  it('should keep link flow visible even when membership is inactive', async () => {
    const member = createMockMemberWithoutSlug({
      membershipActive: false,
    });

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(await screen.findByRole('heading', { name: 'Link Existing Profile' })).toBeVisible();
  });

  it('should keep success banner wording aligned with approved linking behavior', async () => {
    const member = createMockMemberWithoutSlug({
      membershipActive: true,
    });
    const { user } = await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    await user.click(await screen.findByRole('button', { name: 'Link' }));
    await user.click(screen.getByRole('button', { name: 'Link Profile' }));

    expect(await screen.findByText('Profile "matching-doula" linked and approved successfully')).toBeVisible();
  });

  it('should display approval pending when member has no profile approval yet', async () => {
    const member = createMockMemberWithoutSlug({
      membershipActive: true,
    });

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(await screen.findByText('Not approved')).toBeVisible();
  });

  it('should display approved status for linked profile members', async () => {
    const member = createMockMember({
      slug: 'test-slug',
      profileApprovedAt: '2024-03-15T14:30:00.000Z',
    });

    await setup({ member });

    expect(await screen.findByText(/Approved on Mar 15, 2024/)).toBeVisible();
  });

  it('should show no profile approval pending message for approved members', async () => {
    const member = createMockMember({
      slug: 'test-slug',
      profileApprovedAt: '2024-03-15T14:30:00.000Z',
    });

    await setup({ member });

    expect(screen.queryByText('Not approved')).toBeNull();
  });

  it('should not show approve button when member already has profile approval', async () => {
    const member = createMockMember({
      profileApprovedAt: '2024-03-15T14:30:00.000Z',
    });

    await setup({ member });

    expect(screen.queryByRole('button', { name: 'Approve Profile Work' })).toBeNull();
  });

  it('should show approve button when member has no profile approval timestamp', async () => {
    const member = createMockMember();
    delete member.profileApprovedAt;

    await setup({ member });

    expect(await screen.findByRole('button', { name: 'Approve Profile Work' })).toBeVisible();
  });

  it('should show link profile section for members without slug', async () => {
    const member = createMockMemberWithoutSlug();

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(await screen.findByRole('heading', { name: 'Link Existing Profile' })).toBeVisible();
  });

  it('should hide link profile section when member already has a slug', async () => {
    const member = createMockMember({ slug: 'existing-slug' });

    await setup({ member });

    expect(screen.queryByRole('heading', { name: 'Link Existing Profile' })).toBeNull();
  });

  it('should show search profiles input when unlinked profiles are available', async () => {
    const member = createMockMemberWithoutSlug();

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(await screen.findByLabelText('Search profiles')).toBeVisible();
  });

  it('should show approval-aware link helper text for members without slug', async () => {
    const member = createMockMemberWithoutSlug();

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(
      await screen.findByText(
        'Linking an existing profile will also approve this member to edit that profile.',
      ),
    ).toBeVisible();
  });

  it('should show member profile slug when profile exists', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member });

    expect(await screen.findByText('test-slug')).toBeVisible();
  });

  it('should show load profile status button when member has slug', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member });

    expect(await screen.findByRole('button', { name: 'Load Profile Status' })).toBeVisible();
  });

  it('should not show profile edit link before loading profile status', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member });

    expect(screen.queryByRole('link', { name: 'Edit Profile' })).toBeNull();
  });

  it('should not show profile view link before loading profile status', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member });

    expect(screen.queryByRole('link', { name: 'View Profile' })).toBeNull();
  });

  it('should not show publish profile button before loading profile status', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member, profileDraft: true });

    expect(screen.queryByRole('button', { name: 'Publish Profile' })).toBeNull();
  });

  it('should not show unpublish profile button before loading profile status', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member, profileDraft: false });

    expect(screen.queryByRole('button', { name: 'Unpublish Profile' })).toBeNull();
  });

  it('should not show delete draft profile button before loading profile status', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member, profileDraft: true });

    expect(screen.queryByRole('button', { name: 'Delete Draft Profile' })).toBeNull();
  });

  it('should keep delete draft profile button hidden for published profiles before load', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member, profileDraft: false });

    expect(screen.queryByRole('button', { name: 'Delete Draft Profile' })).toBeNull();
  });

  it('should show profile section when member has slug', async () => {
    const member = createMockMember({ slug: 'test-slug' });

    await setup({ member });

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeVisible();
  });

  it('should hide profile section when member has no slug', async () => {
    const member = createMockMemberWithoutSlug();

    await setup({
      member,
      useFakeTimers: true,
      unlinkedProfiles: [createUnlinkedProfile()],
    });

    expect(screen.queryByRole('heading', { name: 'Profile' })).toBeNull();
  });

  it('should keep approve profile action available independently of membership activation action', async () => {
    const member = createMockMember({
      membershipActive: false,
    });
    delete member.profileApprovedAt;

    await setup({ member });

    expect(await screen.findByRole('button', { name: 'Approve Profile Work' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Activate Membership' })).toBeVisible();
  });

  it('should keep publish and approval actions independent', async () => {
    const member = createMockMember({
      slug: 'test-slug',
      profileApprovedAt: '2024-03-15T14:30:00.000Z',
    });

    await setup({ member, profileDraft: true });

    expect(await screen.findByRole('button', { name: 'Load Profile Status' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Approve Profile Work' })).toBeNull();
  });

  it('should approve profile work after confirmation', async () => {
    const member = createMockMember();
    delete member.profileApprovedAt;

    const { user, mockAdminMembersService } = await setup({ member });

    await user.click(await screen.findByRole('button', { name: 'Approve Profile Work' }));
    await user.click(screen.getByRole('button', { name: 'Approve Profile Approval' }));

    expect(mockAdminMembersService.approveProfile).toHaveBeenCalledWith('test-uid-123');
    expect(await screen.findByText('Profile work approved successfully')).toBeVisible();
  });

  it('should show error when approving profile work fails', async () => {
    const member = createMockMember();
    delete member.profileApprovedAt;

    const { user } = await setup({
      member,
      shouldFailApproveProfile: true,
    });

    await user.click(await screen.findByRole('button', { name: 'Approve Profile Work' }));
    await user.click(screen.getByRole('button', { name: 'Approve Profile Approval' }));

    expect(await screen.findByText('Failed to approve profile work.')).toBeVisible();
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

    const loadStatusButton = await screen.findByRole('button', { name: 'Load Profile Status' });
    await user.click(loadStatusButton);

    expect(await screen.findByText('Draft (Unpublished)')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Publish Profile' })).toBeVisible();
  });

  it('should display Unpublish Profile button when profile is published', async () => {
    const member = createMockMember({ slug: 'test-slug' });
    const { user } = await setup({ member, profileDraft: false });

    const loadStatusButton = await screen.findByRole('button', { name: 'Load Profile Status' });
    await user.click(loadStatusButton);

    expect(await screen.findByText('Published')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Unpublish Profile' })).toBeVisible();
  });

  it('should show confirmation dialog when clicking Publish Profile', async () => {
    const member = createMockMember({ slug: 'test-slug' });
    const { user } = await setup({ member, profileDraft: true });

    const loadStatusButton = await screen.findByRole('button', { name: 'Load Profile Status' });
    await user.click(loadStatusButton);

    const publishButton = await screen.findByRole('button', { name: 'Publish Profile' });
    await user.click(publishButton);

    expect(
      screen.getByText(/This will publish the profile, making it visible on the public website/),
    ).toBeVisible();
  });

  it('should show success message after toggling draft status', async () => {
    const member = createMockMember({ slug: 'test-slug' });
    const { user } = await setup({ member, profileDraft: true });

    const loadStatusButton = await screen.findByRole('button', { name: 'Load Profile Status' });
    await user.click(loadStatusButton);

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

    const loadStatusButton = await screen.findByRole('button', { name: 'Load Profile Status' });
    await user.click(loadStatusButton);

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

    expect(await screen.findByText('Profile "matching-doula" linked and approved successfully')).toBeVisible();
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
