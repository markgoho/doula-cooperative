import { render, screen } from '@testing-library/angular';
import { describe, it, expect, vi } from 'vitest';
import { AdminMessages } from './admin-messages';
import { AdminMessagesService } from '../services/admin-messages.service';
import type { Message } from '../admin.types';

// Mock child component to isolate test
vi.mock('./messages-table/messages-table', () => ({
  MessagesTable: class MockMessagesTable {},
}));

interface SetupOptions {
  messages?: Message[];
  total?: number;
  pendingCount?: number;
  processedCount?: number;
}

async function setup({
  messages = [],
  total = 0,
  pendingCount = 0,
  processedCount = 0,
}: SetupOptions = {}) {
  const mockAdminMessagesService = {
    listMessages: vi.fn().mockResolvedValue({
      messages,
      total,
      pendingCount,
      processedCount,
    }),
  };

  const view = await render(AdminMessages, {
    providers: [{ provide: AdminMessagesService, useValue: mockAdminMessagesService }],
  });

  return {
    ...view,
    mockAdminMessagesService,
  };
}

describe('AdminMessages', () => {
  it('displays the page title', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible();
  });

  it('displays message statistics', async () => {
    await setup({
      total: 10,
      pendingCount: 4,
      processedCount: 6,
    });

    // Wait for resource to load - wait for the actual values to appear
    expect(await screen.findByText('10')).toBeVisible();
    expect(screen.getByText('Total Messages')).toBeVisible();
    expect(screen.getByText('Pending')).toBeVisible();
    expect(screen.getByText('4')).toBeVisible();
    expect(screen.getByText('Processed')).toBeVisible();
    expect(screen.getByText('6')).toBeVisible();
  });
});
