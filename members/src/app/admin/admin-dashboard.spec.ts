import { render, screen } from '@testing-library/angular';
import { describe, it, expect, vi } from 'vitest';
import { AdminDashboard } from './admin-dashboard';
import { AdminMembersService, AdminMatchRequestsService } from './admin.service';

interface SetupOptions {
  membersTotal?: number;
  unclaimedTotal?: number;
  matchRequestsTotal?: number;
  matchRequestsPending?: number;
}

async function setup({
  membersTotal = 0,
  unclaimedTotal = 0,
  matchRequestsTotal = 0,
  matchRequestsPending = 0,
}: SetupOptions = {}) {
  const mockAdminMembersService = {
    listMembers: vi.fn().mockResolvedValue({ members: [], total: membersTotal }),
    listUnclaimedProfiles: vi.fn().mockResolvedValue({ profiles: [], total: unclaimedTotal }),
  };

  const mockAdminMatchRequestsService = {
    listMatchRequests: vi
      .fn()
      .mockResolvedValue({
        requests: [],
        total: matchRequestsTotal,
        pendingCount: matchRequestsPending,
        processedCount: 0,
      }),
  };

  const view = await render(AdminDashboard, {
    providers: [
      { provide: AdminMembersService, useValue: mockAdminMembersService },
      { provide: AdminMatchRequestsService, useValue: mockAdminMatchRequestsService },
    ],
  });

  return {
    ...view,
    mockAdminMembersService,
    mockAdminMatchRequestsService,
  };
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

  it('has a link to user management page', async () => {
    await setup();

    const userManagementCard = screen.getByRole('link', { name: /User Management/i });
    expect(userManagementCard).toHaveAttribute('href', '/admin/users');
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
    expect(comingSoonBadges).toHaveLength(4);
  });
});
