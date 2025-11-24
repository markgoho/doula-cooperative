import { computed, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '../../admin.types';
import { AdminMessageDetail } from './admin-message-detail';
import { AdminMessageDetailService } from './admin-message-detail.service';

// Mock the service
class MockAdminMessageDetailService {
  idSignal = signal<string>('');
  messageResource = {
    value: signal<Message | undefined>(undefined),
    isLoading: signal(false),
    error: signal<unknown>(undefined),
    reload: vi.fn(),
  };
  errorMessage = computed(() => {
    const error = this.messageResource.error();
    return error ? 'Failed to load message details. Please try again.' : undefined;
  });
  actionInProgress = signal(false);
  successMessage = signal<string | undefined>(undefined);
  actionError = signal<string | undefined>(undefined);
  updateStatus = vi.fn().mockResolvedValue(undefined);
}

interface SetupOptions {
  id?: string;
  message?: Message;
  isLoading?: boolean;
  error?: unknown;
}

async function setup({ id = '123', message, isLoading = false, error }: SetupOptions = {}) {
  const mockService = new MockAdminMessageDetailService();
  mockService.messageResource.value.set(message);
  mockService.messageResource.isLoading.set(isLoading);
  mockService.messageResource.error.set(error);

  const user = userEvent.setup();

  const view = await render(AdminMessageDetail, {
    componentInputs: { id },
    componentProviders: [{ provide: AdminMessageDetailService, useValue: mockService }],
  });

  // Mock dialog showModal/close since jsdom doesn't fully support it
  // Use spread operator to convert NodeList to Array
  const dialogs = [...(document.querySelectorAll('dialog') as unknown as HTMLDialogElement[])];
  for (const dialog of dialogs) {
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
  }

  return {
    ...view,
    user,
    mockService,
  };
}

const mockMessage: Message = {
  id: '123',
  contactName: 'John Doe',
  email: 'john@example.com',
  message: 'I need a doula.',
  submitted: '2023-05-01T10:00:00.000Z',
  sent: false,
};

describe('AdminMessageDetail', () => {
  it('displays message details', async () => {
    await setup({ message: mockMessage });

    expect(screen.getByRole('heading', { name: 'Message Details', level: 1 })).toBeVisible();
    expect(screen.getByText('John Doe')).toBeVisible();
    expect(screen.getByText('john@example.com')).toBeVisible();
    expect(screen.getByText('I need a doula.')).toBeVisible();
  });

  it('shows loading state', async () => {
    await setup({ isLoading: true });
    expect(screen.getByText('Loading message details...')).toBeVisible();
  });

  it('shows error state', async () => {
    await setup({ error: 'Failed' });
    // The service transforms error to message
    expect(screen.getByText('Failed to load message details. Please try again.')).toBeVisible();
  });

  it('shows "Mark as Processed" button when message is pending', async () => {
    await setup({ message: { ...mockMessage, sent: false } });
    expect(screen.getByRole('button', { name: 'Mark as Processed' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mark as Pending' })).not.toBeInTheDocument();
  });

  it('shows "Mark as Pending" button when message is processed', async () => {
    await setup({ message: { ...mockMessage, sent: true } });
    expect(screen.getByRole('button', { name: 'Mark as Pending' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mark as Processed' })).not.toBeInTheDocument();
  });

  it('opens confirmation dialog and calls updateStatus on confirm', async () => {
    const { user, mockService } = await setup({ message: mockMessage });

    // Click mark as processed
    await user.click(screen.getByRole('button', { name: 'Mark as Processed' }));

    // Dialog should appear
    const dialog = screen.getByRole('dialog'); // Note: might need accessible name if dialog has aria-label/labelledby
    expect(dialog).toBeVisible();
    expect(
      screen.getByText(/Are you sure you want to mark this message as processed/),
    ).toBeVisible();

    // Click confirm
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(mockService.updateStatus).toHaveBeenCalledWith('123', true);
  });
});
