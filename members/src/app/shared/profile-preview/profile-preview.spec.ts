import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfilePreview } from './profile-preview';

describe('ProfilePreview', () => {
  it('should render the profile title', async () => {
    await setup();

    expect(screen.getByText('Jane Doe')).toBeVisible();
  });

  it('should render credentials when provided', async () => {
    await setup({ credentials: 'CD(DONA)' });

    expect(screen.getByText('CD(DONA)')).toBeVisible();
  });

  it('should render pronouns when provided', async () => {
    await setup({ pronouns: 'she/her' });

    expect(screen.getByText('she/her')).toBeVisible();
  });

  it('should render tags as pills', async () => {
    await setup({ tags: ['Birth Doula', 'Postpartum Doula'] });

    expect(screen.getByText('Birth Doula')).toBeVisible();
    expect(screen.getByText('Postpartum Doula')).toBeVisible();
  });

  it('should render bio text', async () => {
    await setup();

    expect(screen.getByText('I am a professional doula.')).toBeVisible();
  });

  it('should render contact information', async () => {
    await setup({
      contact: {
        phone: '555-1234',
        email: 'jane@example.com',
        website: 'janedoula.com',
      },
    });

    expect(screen.getByText('555-1234')).toBeVisible();
    expect(screen.getByText('jane@example.com')).toBeVisible();
    expect(screen.getByText('janedoula.com')).toBeVisible();
  });

  it('should render business name as contact header', async () => {
    await setup({
      contact: { business_name: 'Jane Doula Services' },
    });

    expect(screen.getByText('Jane Doula Services')).toBeVisible();
  });

  it('should show edit links when showEditLinks is true', async () => {
    await setup({ showEditLinks: true });

    expect(screen.getAllByText('Edit').length).toBeGreaterThan(0);
  });

  it('should emit editSection event when edit link is clicked', async () => {
    const onEditSection = vi.fn();
    await setup({ showEditLinks: true, onEditSection });

    const user = userEvent.setup();
    const editButton = screen.getByLabelText('Edit personal info');
    await user.click(editButton);

    expect(onEditSection).toHaveBeenCalledWith('personal');
  });

  it('should show placeholder when no image URL', async () => {
    await setup();

    expect(screen.getByLabelText('No photo uploaded')).toBeVisible();
  });

  it('should show image when imageUrl is provided', async () => {
    await setup({ imageUrl: 'https://example.com/photo.jpg' });

    const img = screen.getByAltText('Headshot of Jane Doe');
    expect(img).toBeVisible();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });
});

interface SetupOptions {
  credentials?: string;
  pronouns?: string;
  tags?: string[];
  contact?: {
    business_name?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  imageUrl?: string;
  showEditLinks?: boolean;
  onEditSection?: (section: string) => void;
}

async function setup({
  credentials,
  pronouns,
  tags,
  contact,
  imageUrl,
  showEditLinks = false,
  onEditSection,
}: SetupOptions = {}) {
  return render(ProfilePreview, {
    inputs: {
      title: 'Jane Doe',
      bio: 'I am a professional doula.',
      ...(credentials !== undefined && { credentials }),
      ...(pronouns !== undefined && { pronouns }),
      ...(tags !== undefined && { tags }),
      ...(contact !== undefined && { contact }),
      ...(imageUrl !== undefined && { imageUrl }),
      showEditLinks,
    },
    on: {
      ...(onEditSection && { editSection: onEditSection }),
    },
  });
}
