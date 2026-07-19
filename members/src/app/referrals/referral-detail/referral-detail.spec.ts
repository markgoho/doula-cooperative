import { inputBinding } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import { describe, expect, it, vi } from 'vitest';
import {
  ReferralsService,
  type ReferralDetail as ReferralDetailModel,
} from '../../services/referrals.service';
import { ReferralDetail } from './referral-detail';

function makeReferralDetail(overrides: Partial<ReferralDetailModel> = {}): ReferralDetailModel {
  return {
    id: 'req-1',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '555-0100',
    zipcode: '14607',
    estimatedDueDate: { month: '3', day: '15', year: '2025' },
    services: ['birth-doula', 'postpartum-doula'],
    birthLocation: 'Hospital',
    otherInfo: 'Looking for experienced doula',
    insurance: ['medicaid'],
    submitted: '2025-01-15T10:00:00.000Z',
    ...overrides,
  };
}

async function setup({
  loading = false,
  error = false,
  id = 'req-1',
  referral = makeReferralDetail(),
}: {
  loading?: boolean;
  error?: boolean;
  id?: string;
  referral?: ReferralDetailModel;
} = {}) {
  let getReferralMock: ReturnType<typeof vi.fn>;
  if (loading) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    getReferralMock = vi.fn().mockReturnValue(new Promise(() => {}));
  } else if (error) {
    getReferralMock = vi.fn().mockRejectedValue(new Error('Not found'));
  } else {
    getReferralMock = vi.fn().mockResolvedValue(referral);
  }

  const mockReferralsService = {
    getReferral: getReferralMock,
  };

  await render(ReferralDetail, {
    bindings: [inputBinding('id', () => id)],
    providers: [{ provide: ReferralsService, useValue: mockReferralsService }, provideRouter([])],
  });
}

describe('ReferralDetail', () => {
  describe('loading state', () => {
    it('shows loading message', async () => {
      await setup({ loading: true });
      expect(await screen.findByRole('status')).toHaveTextContent('Loading referral...');
    });
  });

  describe('error state', () => {
    it('shows error message on failure', async () => {
      await setup({ error: true });
      expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
    });
  });

  describe('loaded state', () => {
    it('shows contact name in the contact action heading', async () => {
      await setup();
      expect(await screen.findByRole('heading', { name: 'Contact Jane Smith' })).toBeVisible();
    });

    it('shows contact email as a prominent link', async () => {
      await setup();
      expect(await screen.findByRole('link', { name: /email.*jane@example.com/i })).toBeVisible();
    });

    it('shows phone as a prominent link', async () => {
      await setup();
      expect(await screen.findByRole('link', { name: /call or text.*555-0100/i })).toBeVisible();
    });

    it('shows ZIP code', async () => {
      await setup();
      expect(await screen.findByText('14607')).toBeVisible();
    });

    it('shows service labels', async () => {
      await setup();
      expect(await screen.findByText('Birth doula support')).toBeVisible();
      expect(screen.getByText('Postpartum doula support')).toBeVisible();
    });

    it('shows birth location', async () => {
      await setup();
      expect(await screen.findByText('Hospital')).toBeVisible();
    });

    it('shows additional notes', async () => {
      await setup();
      expect(await screen.findByText('Looking for experienced doula')).toBeVisible();
    });

    it('shows insurance', async () => {
      await setup();
      expect(await screen.findByText('medicaid')).toBeVisible();
    });

    it('shows member notice about contact norms', async () => {
      await setup();
      expect(await screen.findByText(/cooperative norms/i)).toBeVisible();
    });

    it('shows back link to referrals list', async () => {
      await setup();
      expect(await screen.findByRole('link', { name: /Back to referrals/i })).toBeVisible();
    });
  });
});
