import { inputBinding, outputBinding } from '@angular/core';
import { render, screen } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type ProfileData } from '../../types/profile-data';
import { ProfilePreview } from './profile-preview';

describe('ProfilePreview', () => {
  it('should render the profile title', async () => {
    await setup();

    expect(screen.getByText('Jane Doe')).toBeVisible();
  });

  it('should render credentials when provided', async () => {
    await setup({ profile: { title: 'Jane Doe', bio: 'Bio text.', credentials: 'CD(DONA)' } });

    expect(screen.getByText('CD(DONA)')).toBeVisible();
  });

  it('should render pronouns when provided', async () => {
    await setup({ profile: { title: 'Jane Doe', bio: 'Bio text.', pronouns: 'she/her' } });

    expect(screen.getByText('she/her')).toBeVisible();
  });

  it('should render tags as pills', async () => {
    await setup({
      profile: { title: 'Jane Doe', bio: 'Bio text.', tags: ['Birth Doula', 'Postpartum Doula'] },
    });

    expect(screen.getByText('Birth Doula')).toBeVisible();
    expect(screen.getByText('Postpartum Doula')).toBeVisible();
  });

  it('should render bio text', async () => {
    await setup();

    expect(screen.getByText('I am a professional doula.')).toBeVisible();
  });

  it('should render contact information', async () => {
    await setup({
      profile: {
        title: 'Jane Doe',
        bio: 'Bio text.',
        contact: {
          phone: '555-1234',
          email: 'jane@example.com',
          website: 'janedoula.com',
        },
      },
    });

    expect(screen.getByText('555-1234')).toBeVisible();
    expect(screen.getByText('jane@example.com')).toBeVisible();
    expect(screen.getByText('janedoula.com')).toBeVisible();
  });

  it('should render business name as contact header', async () => {
    await setup({
      profile: {
        title: 'Jane Doe',
        bio: 'Bio text.',
        contact: { business_name: 'Jane Doula Services' },
      },
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
  profile?: ProfileData;
  imageUrl?: string;
  showEditLinks?: boolean;
  onEditSection?: (section: string) => void;
}

async function setup({
  profile = { title: 'Jane Doe', bio: 'I am a professional doula.' },
  imageUrl,
  showEditLinks = false,
  onEditSection,
}: SetupOptions = {}) {
  return render(ProfilePreview, {
    bindings: [
      inputBinding('profile', () => profile),
      inputBinding('showEditLinks', () => showEditLinks),
      ...(imageUrl !== undefined ? [inputBinding('imageUrl', () => imageUrl)] : []),
      ...(onEditSection ? [outputBinding('editSection', onEditSection)] : []),
    ],
  });
}
