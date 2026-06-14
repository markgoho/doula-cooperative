import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import { describe, expect, it, vi } from 'vitest';
import { AdminDashboard } from './admin-dashboard';
import { AdminMatchRequestsService } from './services/admin-match-requests.service';
import { AdminMembersService } from './services/admin-members.service';
import { AdminMessagesService } from './services/admin-messages.service';

interface SetupOptions {
  membersTotal?: number;
  unclaimedTotal?: number;
  matchRequestsTotal?: number;
  matchRequestsPending?: number;
  messagesTotal?: number;
  messagesPending?: number;
}

async function setup({
  membersTotal = 0,
  unclaimedTotal = 0,
  matchRequestsTotal = 0,
  matchRequestsPending = 0,
  messagesTotal = 0,
  messagesPending = 0,
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

  await render(AdminDashboard, {
    providers: [
      { provide: AdminMembersService, useValue: mockAdminMembersService },
      { provide: AdminMatchRequestsService, useValue: mockAdminMatchRequestsService },
      { provide: AdminMessagesService, useValue: mockAdminMessagesService },
      provideRouter([]),
    ],
  });
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
    expect(membersCard).toHaveAttribute('href', '/admin/members');

    const unclaimedCard = screen.getByRole('link', {
      name: /Members with profiles who haven't created accounts/i,
    });
    expect(unclaimedCard).toHaveAttribute('href', '/admin/unclaimed');
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
});
