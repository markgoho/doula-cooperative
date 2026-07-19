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
    // eslint-disable-next-line @typescript-eslint/no-empty-function
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

  describe('14-day framing', () => {
    it('frames the feed as showing requests from the last 14 days', async () => {
      await setup({ referrals: [] });
      expect(await screen.findByText(/last 14 days/i)).toBeVisible();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no referrals in the last 14 days', async () => {
      await setup({ referrals: [] });
      expect(
        await screen.findByText('No referral requests in the last 14 days. Check back soon.'),
      ).toBeVisible();
    });
  });

  describe('populated state', () => {
    it('renders referral cards', async () => {
      await setup({ referrals: [makeReferral(), makeReferral({ id: 'req-2', zipcode: '14608' })] });
      const items = await screen.findAllByRole('listitem');
      expect(items.length).toBeGreaterThanOrEqual(2);
    });

    it('shows service tags with the reusable tag component', async () => {
      await setup({ referrals: [makeReferral({ services: ['birth-doula', 'postpartum-doula'] })] });
      expect(await screen.findByText('Birth')).toBeVisible();
      expect(screen.getByText('Postpartum')).toBeVisible();
    });

    it('shows due date as the primary card content', async () => {
      await setup({ referrals: [makeReferral()] });
      expect(await screen.findByText('Mar 15, 2025')).toBeVisible();
    });

    it('shows the birth location without showing ZIP code', async () => {
      await setup({ referrals: [makeReferral({ zipcode: '14607', birthLocation: 'Hospital' })] });
      expect(await screen.findByText('Hospital')).toBeVisible();
      expect(screen.queryByText('14607')).toBeNull();
    });

    it('shows services as the primary content without a due date', async () => {
      await setup({
        referrals: [makeReferral({ estimatedDueDate: { month: '', day: '', year: '' } })],
      });
      expect(await screen.findByText('Birth')).toBeVisible();
      expect(screen.queryByText('—')).toBeNull();
    });

    it('marks an upcoming birth-doula request as due soon', async () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 14);
      const estimatedDueDate = {
        month: String(soon.getMonth() + 1),
        day: String(soon.getDate()),
        year: String(soon.getFullYear()),
      };
      const referral = makeReferral({ estimatedDueDate });
      await setup({ referrals: [referral] });
      expect(await screen.findByText('Due soon')).toBeVisible();
    });

    it('shows view request link for each referral', async () => {
      await setup({ referrals: [makeReferral({ id: 'req-abc' })] });
      expect(await screen.findByRole('link', { name: /View request details/ })).toBeVisible();
    });

    it('does not show contact info (name, email, phone) in list', async () => {
      await setup({ referrals: [makeReferral()] });
      // Wait for loaded state
      await screen.findByText('Hospital');
      expect(screen.queryByText(/jane@example\.com/)).toBeNull();
      expect(screen.queryByText(/555-/)).toBeNull();
    });

    it('marks decorative icons as hidden from assistive technology', async () => {
      await setup({ referrals: [makeReferral()] });
      await screen.findByText('Hospital');
      const hiddenIcons = document.querySelectorAll('svg[aria-hidden="true"]');
      expect(hiddenIcons.length).toBeGreaterThan(0);
    });
  });
});
