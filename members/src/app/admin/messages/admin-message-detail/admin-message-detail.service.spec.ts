import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '../../admin.types';
import { AdminMessagesStateService } from '../../state/admin-messages-state.service';
import { AdminMessagesService } from '../../services/admin-messages.service';
import { AdminMessageDetailService } from './admin-message-detail.service';

describe('AdminMessageDetailService', () => {
  it('keeps the resource idle until initialized and loads after init', async () => {
    const message = createMessage();
    const mockAdminMessagesService = {
      getMessage: vi.fn().mockResolvedValue(message),
      updateMessageStatus: vi.fn(),
      listMessages: vi.fn(),
    };
    const mockMessagesState = {
      invalidate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminMessageDetailService,
        { provide: AdminMessagesService, useValue: mockAdminMessagesService },
        { provide: AdminMessagesStateService, useValue: mockMessagesState },
      ],
    });

    const service = TestBed.inject(AdminMessageDetailService);

    expect(service.messageResource.status()).toBe('idle');
    expect(mockAdminMessagesService.getMessage).not.toHaveBeenCalled();

    const id = signal('message-123');
    service.init(id);

    expect(service.messageResource.status()).toBe('loading');

    await vi.waitFor(() => {
      expect(service.messageResource.status()).toBe('resolved');
    });

    expect(mockAdminMessagesService.getMessage).toHaveBeenCalledWith('message-123');
    expect(service.messageResource.value()).toEqual(message);
  });

  it('invalidates shared message state after a successful status update', async () => {
    const mockAdminMessagesService = {
      getMessage: vi.fn().mockResolvedValue(createMessage()),
      updateMessageStatus: vi.fn().mockResolvedValue(undefined),
      listMessages: vi.fn(),
    };
    const mockMessagesState = {
      invalidate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminMessageDetailService,
        { provide: AdminMessagesService, useValue: mockAdminMessagesService },
        { provide: AdminMessagesStateService, useValue: mockMessagesState },
      ],
    });

    const service = TestBed.inject(AdminMessageDetailService);
    const reloadSpy = vi.spyOn(service.messageResource, 'reload');

    await service.updateStatus('message-123', true);

    expect(mockAdminMessagesService.updateMessageStatus).toHaveBeenCalledWith('message-123', true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(mockMessagesState.invalidate).toHaveBeenCalledTimes(1);
    expect(service.successMessage()).toBe('Message marked as processed');
    expect(service.actionError()).toBeUndefined();
  });

  it('does not invalidate shared message state after a failed status update', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Suppress expected error logging in this test.
    });
    const mockAdminMessagesService = {
      getMessage: vi.fn().mockResolvedValue(createMessage()),
      updateMessageStatus: vi.fn().mockRejectedValue(new Error('Failed')),
      listMessages: vi.fn(),
    };
    const mockMessagesState = {
      invalidate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminMessageDetailService,
        { provide: AdminMessagesService, useValue: mockAdminMessagesService },
        { provide: AdminMessagesStateService, useValue: mockMessagesState },
      ],
    });

    const service = TestBed.inject(AdminMessageDetailService);
    const reloadSpy = vi.spyOn(service.messageResource, 'reload');

    await service.updateStatus('message-123', false);

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(mockMessagesState.invalidate).not.toHaveBeenCalled();
    expect(service.actionError()).toBe('Failed to update message status.');
    expect(service.successMessage()).toBeUndefined();

    consoleErrorSpy.mockRestore();
  });
});

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-123',
    contactName: 'Test Contact',
    email: 'test@example.com',
    message: 'Hello',
    submitted: '2024-01-01T00:00:00.000Z',
    sent: false,
    ...overrides,
  };
}
