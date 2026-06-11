import { provideRouter } from '@angular/router';
import type { Routes } from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import { describe, expect, it, vi } from 'vitest';
import { ReferralsService, type ReferralListItem } from '../services/referrals.service';
import { Referrals } from './referrals';

const TEST_ROUTES: Routes = [{ path: 'referrals/:id', component: Referrals }];

function makeReferral(overrides: Partial<ReferralListItem> = {}): ReferralListItem {
  return {
    id: 'req-1',
    submitted: '2025-01-15T10:00:00.000Z',
    estimatedDueDate: { month: '3', day: '15', year: '2025' },
    services: ['birth-doula'],
    zipcode: '14607',
    birthLocation: 'Hospital',
    ...overrides,
  };
}

async function setup({
  loading = false,
  error = false,
  referrals = [] as ReferralListItem[],
} = {}) {
  let listReferralsMock: ReturnType<typeof vi.fn>;
  if (loading) {
    listReferralsMock = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
  } else if (error) {
    listReferralsMock = vi.fn().mockRejectedValue(new Error('Network error'));
  } else {
    listReferralsMock = vi.fn().mockResolvedValue(referrals);
  }

  const mockReferralsService = {
    listReferrals: listReferralsMock,
  };

  await render(Referrals, {
    providers: [
      { provide: ReferralsService, useValue: mockReferralsService },
      provideRouter(TEST_ROUTES),
    ],
  });
}

describe('Referrals list', () => {
  describe('loading state', () => {
    it('shows loading message while fetching', async () => {
      await setup({ loading: true });
      expect(await screen.findByRole('status')).toHaveTextContent('Loading referrals...');
    });
  });

  describe('error state', () => {
    it('shows error message on failure', async () => {
      await setup({ error: true });
      expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
    });
  });

  describe('empty state', () => {
    it('shows empty state when no referrals', async () => {
      await setup({ referrals: [] });
      expect(await screen.findByText('No referrals available right now.')).toBeVisible();
    });
  });

  describe('populated state', () => {
    it('renders referral cards', async () => {
      await setup({ referrals: [makeReferral(), makeReferral({ id: 'req-2', zipcode: '14608' })] });
      expect((await screen.findAllByRole('listitem')).length).toBeGreaterThanOrEqual(2);
    });

    it('shows ZIP code for each referral', async () => {
      await setup({ referrals: [makeReferral({ zipcode: '14607' })] });
      expect(await screen.findByText('14607')).toBeVisible();
    });

    it('shows service label', async () => {
      await setup({ referrals: [makeReferral({ services: ['birth-doula'] })] });
      expect(await screen.findByText('Birth')).toBeVisible();
    });

    it('shows view details link for each referral', async () => {
      await setup({ referrals: [makeReferral({ id: 'req-abc' })] });
      expect(await screen.findByRole('link', { name: /View details/ })).toBeVisible();
    });

    it('does not show contact info (name, email, phone) in list', async () => {
      await setup({ referrals: [makeReferral()] });
      // Wait for loaded state
      await screen.findByText('14607');
      expect(screen.queryByText(/jane@example\.com/)).toBeNull();
      expect(screen.queryByText(/555-/)).toBeNull();
    });
  });
});
