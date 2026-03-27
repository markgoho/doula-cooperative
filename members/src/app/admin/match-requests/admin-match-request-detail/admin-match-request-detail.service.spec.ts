import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { MatchRequest } from '../../admin.types';
import { AdminMatchRequestsService } from '../../services/admin-match-requests.service';
import { AdminMatchRequestsStateService } from '../../state/admin-match-requests-state.service';
import { AdminMatchRequestDetailService } from './admin-match-request-detail.service';

describe('AdminMatchRequestDetailService', () => {
  it('keeps the resource idle until initialized and loads after init', async () => {
    const matchRequest = createMatchRequest();
    const mockAdminMatchRequestsService = {
      getMatchRequest: vi.fn().mockResolvedValue(matchRequest),
      updateMatchRequestStatus: vi.fn(),
      listMatchRequests: vi.fn(),
    };
    const mockMatchRequestsState = {
      invalidate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminMatchRequestDetailService,
        { provide: AdminMatchRequestsService, useValue: mockAdminMatchRequestsService },
        { provide: AdminMatchRequestsStateService, useValue: mockMatchRequestsState },
      ],
    });

    const service = TestBed.inject(AdminMatchRequestDetailService);

    expect(service.matchRequestResource.status()).toBe('idle');
    expect(mockAdminMatchRequestsService.getMatchRequest).not.toHaveBeenCalled();

    const id = signal('match-request-123');
    service.init(id);

    expect(service.matchRequestResource.status()).toBe('loading');

    await vi.waitFor(() => {
      expect(service.matchRequestResource.status()).toBe('resolved');
    });

    expect(mockAdminMatchRequestsService.getMatchRequest).toHaveBeenCalledWith('match-request-123');
    expect(service.matchRequestResource.value()).toEqual(matchRequest);
  });

  it('invalidates shared match request state after a successful status update', async () => {
    const mockAdminMatchRequestsService = {
      getMatchRequest: vi.fn().mockResolvedValue(createMatchRequest()),
      updateMatchRequestStatus: vi.fn().mockResolvedValue(undefined),
      listMatchRequests: vi.fn(),
    };
    const mockMatchRequestsState = {
      invalidate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminMatchRequestDetailService,
        { provide: AdminMatchRequestsService, useValue: mockAdminMatchRequestsService },
        { provide: AdminMatchRequestsStateService, useValue: mockMatchRequestsState },
      ],
    });

    const service = TestBed.inject(AdminMatchRequestDetailService);
    const reloadSpy = vi.spyOn(service.matchRequestResource, 'reload');

    await service.updateStatus('match-request-123', true);

    expect(mockAdminMatchRequestsService.updateMatchRequestStatus).toHaveBeenCalledWith(
      'match-request-123',
      true,
    );
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(mockMatchRequestsState.invalidate).toHaveBeenCalledTimes(1);
    expect(service.successMessage()).toBe('Match request marked as processed');
    expect(service.actionError()).toBeUndefined();
  });

  it('does not invalidate shared match request state after a failed status update', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Suppress expected error logging in this test.
    });
    const mockAdminMatchRequestsService = {
      getMatchRequest: vi.fn().mockResolvedValue(createMatchRequest()),
      updateMatchRequestStatus: vi.fn().mockRejectedValue(new Error('Failed')),
      listMatchRequests: vi.fn(),
    };
    const mockMatchRequestsState = {
      invalidate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminMatchRequestDetailService,
        { provide: AdminMatchRequestsService, useValue: mockAdminMatchRequestsService },
        { provide: AdminMatchRequestsStateService, useValue: mockMatchRequestsState },
      ],
    });

    const service = TestBed.inject(AdminMatchRequestDetailService);
    const reloadSpy = vi.spyOn(service.matchRequestResource, 'reload');

    await service.updateStatus('match-request-123', false);

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(mockMatchRequestsState.invalidate).not.toHaveBeenCalled();
    expect(service.actionError()).toBe('Failed to update match request status.');
    expect(service.successMessage()).toBeUndefined();

    consoleErrorSpy.mockRestore();
  });
});

function createMatchRequest(overrides: Partial<MatchRequest> = {}): MatchRequest {
  return {
    id: 'match-request-123',
    name: 'Test Parent',
    phone: '555-555-5555',
    email: 'parent@example.com',
    zipcode: '98101',
    estimatedDueDate: {
      month: '1',
      day: '1',
      year: '2024',
    },
    services: ['birth-doula'],
    birthLocation: 'Hospital',
    otherInfo: 'Needs overnight support',
    insurance: [],
    submitted: '2024-01-01T00:00:00.000Z',
    sent: false,
    ...overrides,
  };
}
