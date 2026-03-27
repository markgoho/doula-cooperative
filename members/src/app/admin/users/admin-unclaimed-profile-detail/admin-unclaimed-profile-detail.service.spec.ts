import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { UnclaimedProfile } from '../../admin.types';
import { AdminMembersService } from '../../services/admin-members.service';
import { AdminUnclaimedStateService } from '../../state/admin-unclaimed-state.service';
import { AdminUnclaimedProfileDetailService } from './admin-unclaimed-profile-detail.service';

describe('AdminUnclaimedProfileDetailService', () => {
  it('keeps the resource idle until initialized and loads after init', async () => {
    const profile = createUnclaimedProfile();
    const mockAdminMembersService = {
      getUnclaimedProfile: vi.fn().mockResolvedValue(profile),
      updateEmail: vi.fn(),
      deleteUnclaimedProfile: vi.fn(),
      listUnclaimedProfiles: vi.fn(),
    };
    const mockUnclaimedState = {
      invalidate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminUnclaimedProfileDetailService,
        { provide: AdminMembersService, useValue: mockAdminMembersService },
        { provide: AdminUnclaimedStateService, useValue: mockUnclaimedState },
      ],
    });

    const service = TestBed.inject(AdminUnclaimedProfileDetailService);

    expect(service.unclaimedProfileResource.status()).toBe('idle');
    expect(mockAdminMembersService.getUnclaimedProfile).not.toHaveBeenCalled();

    const email = signal('test@example.com');
    service.init(email);

    expect(service.unclaimedProfileResource.status()).toBe('loading');

    await vi.waitFor(() => {
      expect(service.unclaimedProfileResource.status()).toBe('resolved');
    });

    expect(mockAdminMembersService.getUnclaimedProfile).toHaveBeenCalledWith('test@example.com');
    expect(service.unclaimedProfileResource.value()).toEqual(profile);
  });

  it('invalidates shared unclaimed state after a successful email update', async () => {
    const mockAdminMembersService = {
      getUnclaimedProfile: vi.fn().mockResolvedValue(createUnclaimedProfile()),
      updateEmail: vi.fn().mockResolvedValue(undefined),
      deleteUnclaimedProfile: vi.fn(),
      listUnclaimedProfiles: vi.fn(),
    };
    const mockUnclaimedState = {
      invalidate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminUnclaimedProfileDetailService,
        { provide: AdminMembersService, useValue: mockAdminMembersService },
        { provide: AdminUnclaimedStateService, useValue: mockUnclaimedState },
      ],
    });

    const service = TestBed.inject(AdminUnclaimedProfileDetailService);

    await expect(service.updateEmail('old@example.com', 'new@example.com')).resolves.toBe(
      'new@example.com',
    );

    expect(mockAdminMembersService.updateEmail).toHaveBeenCalledWith(
      'old@example.com',
      'new@example.com',
    );
    expect(mockUnclaimedState.invalidate).toHaveBeenCalledTimes(1);
    expect(service.successMessage()).toBe('Email updated to new@example.com');
    expect(service.actionError()).toBeUndefined();
  });

  it('does not invalidate shared unclaimed state after a failed email update', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Suppress expected error logging in this test.
    });
    const mockAdminMembersService = {
      getUnclaimedProfile: vi.fn().mockResolvedValue(createUnclaimedProfile()),
      updateEmail: vi.fn().mockRejectedValue(new Error('Failed')),
      deleteUnclaimedProfile: vi.fn(),
      listUnclaimedProfiles: vi.fn(),
    };
    const mockUnclaimedState = {
      invalidate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminUnclaimedProfileDetailService,
        { provide: AdminMembersService, useValue: mockAdminMembersService },
        { provide: AdminUnclaimedStateService, useValue: mockUnclaimedState },
      ],
    });

    const service = TestBed.inject(AdminUnclaimedProfileDetailService);

    await expect(service.updateEmail('old@example.com', 'new@example.com')).resolves.toBeUndefined();

    expect(mockUnclaimedState.invalidate).not.toHaveBeenCalled();
    expect(service.actionError()).toBe('Failed to update email.');
    expect(service.successMessage()).toBeUndefined();

    consoleErrorSpy.mockRestore();
  });
});

function createUnclaimedProfile(overrides: Partial<UnclaimedProfile> = {}): UnclaimedProfile {
  return {
    email: 'test@example.com',
    name: 'Test User',
    subscriptionStart: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
