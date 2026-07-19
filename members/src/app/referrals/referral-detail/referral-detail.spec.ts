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
    it('shows the requester name and due date in the heading', async () => {
      await setup();
      expect(await screen.findByRole('heading', { name: 'Jane Smith' })).toBeVisible();
      expect(screen.getByText('Due March 15')).toBeVisible();
    });

    it('shows a missing due-date fallback', async () => {
      await setup({
        referral: makeReferralDetail({ estimatedDueDate: { month: '', day: '', year: '' } }),
      });
      expect(await screen.findByText('Due date not provided')).toBeVisible();
    });

    it('shows notes before contact information', async () => {
      await setup();
      const notes = await screen.findByRole('heading', { name: 'Additional notes' });
      const contact = screen.getByRole('heading', { name: 'Contact information' });
      expect(
        notes.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(screen.getByText('Looking for experienced doula')).toBeVisible();
    });

    it('omits the notes section when no notes were supplied', async () => {
      await setup({ referral: makeReferralDetail({ otherInfo: '' }) });
      expect(screen.queryByRole('heading', { name: 'Additional notes' })).not.toBeInTheDocument();
    });

    it('shows equal full-value email and phone contact links', async () => {
      await setup();
      const email = await screen.findByRole('link', { name: /email.*jane@example.com/i });
      const phone = screen.getByRole('link', { name: /call or text.*555-0100/i });
      expect(email).toHaveAttribute('href', 'mailto:jane@example.com');
      expect(phone).toHaveAttribute('href', 'tel:555-0100');
    });

    it('consolidates secondary fields under request details', async () => {
      await setup();
      expect(await screen.findByRole('heading', { name: 'Request details' })).toBeVisible();
      expect(screen.getByText('Hospital')).toBeVisible();
      expect(screen.getByText('Birth doula support')).toBeVisible();
      expect(screen.getByText('Postpartum doula support')).toBeVisible();
      expect(screen.getByText('medicaid')).toBeVisible();
      expect(screen.getByText('14607')).toBeVisible();
    });

    it('does not show the member contact notice', async () => {
      await setup();
      await screen.findByRole('heading', { name: 'Jane Smith' });
      expect(screen.queryByText(/cooperative norms/i)).not.toBeInTheDocument();
    });

    it('shows a due-soon cue for birth requests due within 30 days', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      const estimatedDueDate = {
        month: String(dueDate.getMonth() + 1),
        day: String(dueDate.getDate()),
        year: String(dueDate.getFullYear()),
      };
      const referral = makeReferralDetail({ estimatedDueDate });
      await setup({ referral });
      expect(await screen.findByText(/Due .+Due soon/)).toBeVisible();
    });

    it('shows back link to referrals list', async () => {
      await setup();
      expect(await screen.findByRole('link', { name: /Back to referrals/i })).toBeVisible();
    });
  });
});
