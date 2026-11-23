import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminDashboard } from './admin-dashboard';
import { AdminMatchRequestsService } from './services/admin-match-requests.service';
import { AdminMembersService } from './services/admin-members.service';
import { AdminMessagesService } from './services/admin-messages.service';
import { AdminSettingsService } from './services/admin-settings.service';
import type { ReferralPortalSettings } from './api-types/admin-settings-api.types';

interface SetupOptions {
  membersTotal?: number;
  unclaimedTotal?: number;
  matchRequestsTotal?: number;
  matchRequestsPending?: number;
  messagesTotal?: number;
  messagesPending?: number;
  referralPortalSettings?: ReferralPortalSettings;
  referralPortalUpdateFails?: boolean;
}

async function setup({
  membersTotal = 0,
  unclaimedTotal = 0,
  matchRequestsTotal = 0,
  matchRequestsPending = 0,
  messagesTotal = 0,
  messagesPending = 0,
  referralPortalSettings = { v2Enabled: false },
  referralPortalUpdateFails = false,
}: SetupOptions = {}) {
  const mockAdminMembersService = {
    listMembers: vi.fn().mockResolvedValue({ members: [], total: membersTotal }),
    listUnclaimedProfiles: vi.fn().mockResolvedValue({ profiles: [], total: unclaimedTotal }),
  };

  const mockAdminMatchRequestsService = {
    listMatchRequests: vi.fn().mockResolvedValue({
      requests: [],
      total: matchRequestsTotal,
      pendingCount: matchRequestsPending,
      processedCount: 0,
    }),
  };

  const mockAdminMessagesService = {
    listMessages: vi.fn().mockResolvedValue({
      messages: [],
      total: messagesTotal,
      pendingCount: messagesPending,
      processedCount: 0,
    }),
  };

  const mockAdminSettingsService = {
    getReferralPortalSettings: vi.fn().mockResolvedValue(referralPortalSettings),
    updateReferralPortalSettings: referralPortalUpdateFails
      ? vi.fn().mockRejectedValue(new Error('Server error'))
      : vi.fn().mockImplementation((isEnabled: boolean) =>
          Promise.resolve({
            v2Enabled: isEnabled,
            updatedAt: '2026-11-22T17:00:00.000Z',
            updatedBy: 'admin-uid',
          }),
        ),
  };

  await render(AdminDashboard, {
    providers: [
      { provide: AdminMembersService, useValue: mockAdminMembersService },
      { provide: AdminMatchRequestsService, useValue: mockAdminMatchRequestsService },
      { provide: AdminMessagesService, useValue: mockAdminMessagesService },
      { provide: AdminSettingsService, useValue: mockAdminSettingsService },
      provideRouter([]),
    ],
  });

  const user = userEvent.setup();

  return { user, mockAdminSettingsService };
}

describe('AdminDashboard', () => {
  it('displays the dashboard title', async () => {
    await setup();

    expect(screen.getByRole('heading', { name: 'Admin Dashboard', level: 1 })).toBeVisible();
  });

  it('displays total members count', async () => {
    await setup({ membersTotal: 5 });

    expect(await screen.findByText('5')).toBeVisible();
    expect(screen.getByText('Active Members')).toBeVisible();
  });

  it('displays total unclaimed profiles count', async () => {
    await setup({ unclaimedTotal: 77 });

    expect(await screen.findByText('77')).toBeVisible();
    expect(screen.getByText('Unclaimed Profiles')).toBeVisible();
  });

  it('displays both member counts', async () => {
    await setup({ membersTotal: 2, unclaimedTotal: 77 });

    expect(await screen.findByText('2')).toBeVisible();
    expect(await screen.findByText('77')).toBeVisible();
  });

  it('has links to members and unclaimed profiles pages', async () => {
    await setup();

    // Use more specific matcher - the card contains both "Members" heading and description
    const membersCard = screen.getByRole('link', { name: /Manage member accounts/i });
    expect(membersCard).toHaveAttribute('href', '/members');

    const unclaimedCard = screen.getByRole('link', {
      name: /Members with profiles who haven't created accounts/i,
    });
    expect(unclaimedCard).toHaveAttribute('href', '/unclaimed');
  });

  it('displays placeholder cards for future features', async () => {
    await setup();

    expect(screen.getByRole('heading', { name: 'Match Requests', level: 2 })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Messages', level: 2 })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Analytics', level: 2 })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Settings', level: 2 })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Content', level: 2 })).toBeVisible();
  });

  it('shows coming soon badges on placeholder cards', async () => {
    await setup();

    const comingSoonBadges = screen.getAllByText('Coming Soon');
    expect(comingSoonBadges).toHaveLength(2);
  });

  describe('Referral Portal v2 switch', () => {
    it('shows the switch off with no history when it was never flipped', async () => {
      await setup();

      const toggle = await screen.findByRole('switch', { name: 'Referral Portal v2' });
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveTextContent('Off');
      expect(screen.getByText('Never changed (off by default)')).toBeVisible();
    });

    it('shows the switch on with when it was last updated', async () => {
      await setup({
        referralPortalSettings: {
          v2Enabled: true,
          updatedAt: '2026-11-20T15:30:00.000Z',
          updatedBy: 'admin-uid',
        },
      });

      const toggle = await screen.findByRole('switch', { name: 'Referral Portal v2' });
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      expect(toggle).toHaveTextContent('On');
      expect(screen.getByText(/Last updated Nov 20, 2026/)).toBeVisible();
    });

    it('turns the switch on and shows the new state', async () => {
      const { user, mockAdminSettingsService } = await setup();

      await user.click(await screen.findByRole('switch', { name: 'Referral Portal v2' }));

      expect(mockAdminSettingsService.updateReferralPortalSettings).toHaveBeenCalledWith(true);
      const toggle = screen.getByRole('switch', { name: 'Referral Portal v2' });
      await expect.poll(() => toggle.getAttribute('aria-checked')).toBe('true');
      expect(screen.getByText(/Last updated Nov 22, 2026/)).toBeVisible();
    });

    it('keeps the switch off and explains when saving fails', async () => {
      const { user } = await setup({ referralPortalUpdateFails: true });

      await user.click(await screen.findByRole('switch', { name: 'Referral Portal v2' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not save the switch. Please try again.',
      );
      expect(screen.getByRole('switch', { name: 'Referral Portal v2' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });
  });
});
