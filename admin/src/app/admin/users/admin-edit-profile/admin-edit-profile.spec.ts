import { inputBinding } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiMemberResponse } from '../../../api-types/api-member-response';
import { AdminMembersService } from '../../services/admin-members.service';
import { AdminEditProfile } from './admin-edit-profile';

interface SetupOptions {
  uid?: string;
  slug?: string;
  uploadRejects?: boolean;
}

async function setup({
  uid = 'test-uid',
  slug = 'jane-doe',
  uploadRejects = false,
}: SetupOptions = {}) {
  const member: ApiMemberResponse = {
    uid,
    email: 'jane@example.com',
    name: 'Jane Doe',
    createdAt: '2024-01-01T00:00:00.000Z',
    isAdmin: false,
    membershipActive: true,
    subscriptionStart: '2024-01-01T00:00:00.000Z',
    membershipExpiresAt: '2025-01-01T00:00:00.000Z',
    slug,
    profileCreatedAt: '2024-01-01T00:00:00.000Z',
  };

  const uploadMemberProfileImage = uploadRejects
    ? vi.fn().mockRejectedValue(new Error('upload failed'))
    : vi.fn().mockResolvedValue(undefined);

  const mockAdminMembersService = {
    getMember: vi.fn().mockResolvedValue(member),
    readMemberProfile: vi.fn().mockResolvedValue({
      title: 'Jane Doe',
      bio: 'A passionate doula serving the community.',
      slug,
    }),
    uploadMemberProfileImage,
    deleteMemberProfileImage: vi.fn().mockResolvedValue(undefined),
  };

  await render(AdminEditProfile, {
    bindings: [inputBinding('uid', () => uid)],
    providers: [
      { provide: AdminMembersService, useValue: mockAdminMembersService },
      provideRouter([]),
    ],
  });

  const user = userEvent.setup();

  // jsdom does not implement dialog.showModal/close
  for (const dialog of document.querySelectorAll('dialog') as unknown as HTMLDialogElement[]) {
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
  }

  return { user, mockAdminMembersService };
}

describe('AdminEditProfile profile image', () => {
  it('uploads the selected photo for the member being edited', async () => {
    const { user, mockAdminMembersService } = await setup();

    const file = new File(['photo'], 'photo.png', { type: 'image/png' });
    await user.upload(await screen.findByLabelText(/change photo/i), file);

    // The file is read asynchronously, so wait for the outcome before asserting
    expect(await screen.findByText('Profile image updated.')).toBeVisible();
    expect(mockAdminMembersService.uploadMemberProfileImage).toHaveBeenCalledWith(
      'jane-doe',
      expect.any(String),
      'image/png',
    );
  });

  it('rejects a file that is not a supported image', async () => {
    const { user, mockAdminMembersService } = await setup();

    const input = await screen.findByLabelText(/change photo/i);
    input.removeAttribute('accept'); // Allow selecting any file to test validation

    await user.upload(input, new File(['notes'], 'notes.txt', { type: 'text/plain' }));

    expect(mockAdminMembersService.uploadMemberProfileImage).not.toHaveBeenCalled();
    expect(screen.getByText(/please select a valid image/i)).toBeVisible();
  });

  it('reports a failed upload', async () => {
    const { user } = await setup({ uploadRejects: true });

    const file = new File(['photo'], 'photo.png', { type: 'image/png' });
    await user.upload(await screen.findByLabelText(/change photo/i), file);

    expect(await screen.findByText(/failed to upload profile image/i)).toBeVisible();
  });

  it('removes the photo only after the admin confirms', async () => {
    const { user, mockAdminMembersService } = await setup();

    await user.click(await screen.findByRole('button', { name: /remove photo/i }));
    expect(mockAdminMembersService.deleteMemberProfileImage).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /remove photo/i }));

    expect(mockAdminMembersService.deleteMemberProfileImage).toHaveBeenCalledWith('jane-doe');
  });
});
