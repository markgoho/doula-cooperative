import { inputBinding } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular/zoneless';
import { describe, expect, it, vi } from 'vitest';
import type { ApiMemberResponse } from '../../../api-types/api-member-response';
import { AdminMembersService } from '../../services/admin-members.service';
import { AdminProfilePreview } from './admin-profile-preview';

interface SetupOptions {
  uid?: string;
  member?: ApiMemberResponse;
  profileTitle?: string;
}

async function setup({
  uid = 'test-uid',
  member = {
    uid: 'test-uid',
    email: 'jane@example.com',
    name: 'Jane Doe',
    createdAt: '2024-01-01T00:00:00.000Z',
    isAdmin: false,
    membershipActive: true,
    subscriptionStart: '2024-01-01T00:00:00.000Z',
    membershipExpiresAt: '2025-01-01T00:00:00.000Z',
    slug: 'jane-doe',
    profileCreatedAt: '2024-01-01T00:00:00.000Z',
  },
  profileTitle = 'Jane Doe',
}: SetupOptions = {}): Promise<void> {
  const mockAdminMembersService = {
    getMember: vi.fn().mockResolvedValue(member),
    readMemberProfile: vi.fn().mockResolvedValue({
      title: profileTitle,
      bio: 'A passionate doula serving the community.',
      slug: member.slug ?? 'jane-doe',
    }),
  };

  await render(AdminProfilePreview, {
    bindings: [inputBinding('uid', () => uid)],
    providers: [
      { provide: AdminMembersService, useValue: mockAdminMembersService },
      provideRouter([]),
    ],
  });
}

describe('AdminProfilePreview', () => {
  it('renders the profile image with the computed ImageKit URL', async () => {
    await setup();

    await waitFor(() => {
      const image = screen.getByRole('img', { name: 'Headshot of Jane Doe' });
      // The URL carries a cache-busting query so a new upload is not masked by
      // the previously cached image.
      expect(image.getAttribute('src')).toMatch(
        /^https:\/\/ik\.imagekit\.io\/doulacoop\/tr:w-300,h-300,fo-face,z-0\.5,di-default-profile\.png\/doulas\/jane-doe\/jane-doe-profile\?v=\d+$/,
      );
    });
  });

  it('shows a warning when the member has no linked profile', async () => {
    const memberWithoutSlug: ApiMemberResponse = {
      uid: 'test-uid',
      email: 'jane@example.com',
      name: 'Jane Doe',
      createdAt: '2024-01-01T00:00:00.000Z',
      isAdmin: false,
      membershipActive: true,
      subscriptionStart: '2024-01-01T00:00:00.000Z',
      membershipExpiresAt: '2025-01-01T00:00:00.000Z',
    };

    await setup({ member: memberWithoutSlug });

    await waitFor(() => {
      expect(screen.getByText('This member does not have a linked profile.')).toBeVisible();
    });
  });
});
