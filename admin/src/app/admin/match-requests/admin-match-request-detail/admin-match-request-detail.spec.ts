import { computed, inputBinding, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular/zoneless';
import { describe, expect, it, vi } from 'vitest';
import type { MatchRequestDetail } from '../../admin.types';
import { AdminMatchRequestDetail } from './admin-match-request-detail';
import { AdminMatchRequestDetailService } from './admin-match-request-detail.service';

class MockAdminMatchRequestDetailService {
  init = vi.fn();
  matchRequestResource = {
    value: signal<MatchRequestDetail | undefined>(undefined),
    isLoading: signal(false),
    error: signal<unknown>(undefined),
    reload: vi.fn(),
  };
  errorMessage = computed(() =>
    this.matchRequestResource.error() ? 'Failed to load match request details.' : undefined,
  );
  actionInProgress = signal(false);
  successMessage = signal<string | undefined>(undefined);
  actionError = signal<string | undefined>(undefined);
  updateStatus = vi.fn().mockResolvedValue(undefined);
}

const baseMatchRequest: MatchRequestDetail = {
  id: 'request-123',
  name: 'Jane Requester',
  phone: '555-1234',
  email: 'jane@example.com',
  zipcode: '12345',
  estimatedDueDate: { month: '03', day: '15', year: '2026' },
  services: ['postpartum-doula'],
  birthLocation: '',
  otherInfo: '',
  insurance: [],
  submitted: '2026-03-01T09:00:00.000Z',
  sent: true,
  responses: { members: [], legacy: [] },
};

const mixedResponses: MatchRequestDetail['responses'] = {
  members: [
    {
      memberUid: 'member-outreach',
      memberName: 'Oscar Outreach',
      outreachSentAt: '2026-03-01T10:00:00.000Z',
      outcome: 'hired',
      outcomeUpdatedAt: '2026-03-04T10:00:00.000Z',
    },
    {
      memberUid: 'member-offline',
      memberName: 'Olive Offline',
      outcome: 'not_a_fit',
      outcomeUpdatedAt: '2026-03-05T10:00:00.000Z',
      offlineResponse: {
        recordedByName: 'Cora Coordinator',
        recordedAt: '2026-03-03T10:00:00.000Z',
      },
    },
    {
      memberUid: 'member-quiet',
      memberName: '',
      outreachSentAt: '2026-03-02T10:00:00.000Z',
    },
  ],
  legacy: [
    {
      displayName: 'Lena Legacy',
      recordedByName: 'Cora Coordinator',
      recordedAt: '2026-03-06T10:00:00.000Z',
    },
  ],
};

async function setup({
  matchRequest = baseMatchRequest,
}: { matchRequest?: MatchRequestDetail } = {}) {
  const mockService = new MockAdminMatchRequestDetailService();
  mockService.matchRequestResource.value.set(matchRequest);

  await render(AdminMatchRequestDetail, {
    bindings: [inputBinding('id', () => matchRequest.id)],
    providers: [provideRouter([])],
    configureTestBed: (testBed) => {
      testBed.overrideComponent(AdminMatchRequestDetail, {
        set: {
          providers: [{ provide: AdminMatchRequestDetailService, useValue: mockService }],
        },
      });
    },
  });

  return { mockService };
}

function rowFor(name: string): HTMLElement {
  const row = screen.getByRole('rowheader', { name: new RegExp(name) }).closest('tr');
  if (!row) throw new Error(`No row for ${name}`);
  return row;
}

describe('AdminMatchRequestDetail responses', () => {
  it('shows an empty state when there are no responses', async () => {
    await setup();

    expect(screen.getByRole('heading', { name: 'Responses', level: 2 })).toBeVisible();
    expect(screen.getByText('No responses yet')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows Outreach, Offline Responses, and Referral Outcomes for mixed responses', async () => {
    await setup({ matchRequest: { ...baseMatchRequest, responses: mixedResponses } });

    const outreachRow = rowFor('Oscar Outreach');
    expect(within(outreachRow).getByRole('link', { name: 'Oscar Outreach' })).toHaveAttribute(
      'href',
      '/members/member-outreach',
    );
    expect(within(outreachRow).getByText(/Outreach/, { selector: 'td span' })).toBeVisible();
    expect(within(outreachRow).getByText('Hired')).toBeVisible();
    expect(within(outreachRow).getByText(/Updated/)).toBeVisible();

    const offlineRow = rowFor('Olive Offline');
    expect(
      within(offlineRow).getByText(/Offline Response recorded by Cora Coordinator/),
    ).toBeVisible();
    expect(within(offlineRow).getByText('Not a fit')).toBeVisible();

    const quietRow = rowFor('Unknown member');
    expect(within(quietRow).getByText('No outcome yet')).toBeVisible();
    expect(within(quietRow).queryByText(/Updated/)).not.toBeInTheDocument();

    const legacyRow = rowFor('Lena Legacy');
    expect(within(legacyRow).getByText('Not yet migrated')).toBeVisible();
    expect(within(legacyRow).queryByRole('link')).not.toBeInTheDocument();
    expect(
      within(legacyRow).getByText(/Offline Response recorded by Cora Coordinator/),
    ).toBeVisible();
  });

  it('marks each response time with a machine-readable datetime', async () => {
    await setup({ matchRequest: { ...baseMatchRequest, responses: mixedResponses } });

    const outreachTime = rowFor('Oscar Outreach').querySelector(
      'time[datetime="2026-03-01T10:00:00.000Z"]',
    );
    expect(outreachTime).not.toBeNull();
  });
});
