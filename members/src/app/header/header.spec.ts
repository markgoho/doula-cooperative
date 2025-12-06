import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';
import { Header } from './header';

describe('Header', () => {
  it('should render brand title', async () => {
    await setup();

    expect(screen.getByRole('heading', { name: 'Doula Cooperative' })).toBeVisible();
  });

  it('should not show authenticated navigation when user is not authenticated', async () => {
    await setup({ isAuthenticated: false });

    expect(screen.queryByText('Membership')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Profile' })).not.toBeInTheDocument();
  });

  it('should show membership link when user is authenticated', async () => {
    await setup({ isAuthenticated: true });

    expect(screen.getByRole('link', { name: 'Membership' })).toBeVisible();
  });

  it('should not show edit profile button when email is not verified', async () => {
    await setup({
      isAuthenticated: true,
      isEmailVerified: false,
      isMembershipActive: true,
    });

    expect(screen.queryByRole('link', { name: 'Edit Profile' })).not.toBeInTheDocument();
  });

  it('should not show edit profile button when membership is not active', async () => {
    await setup({
      isAuthenticated: true,
      isEmailVerified: true,
      isMembershipActive: false,
    });

    expect(screen.queryByRole('link', { name: 'Edit Profile' })).not.toBeInTheDocument();
  });

  it('should show edit profile button when user has a profile', async () => {
    await setup({
      isAuthenticated: true,
      isEmailVerified: true,
      isMembershipActive: true,
      hasProfile: true,
    });

    const editLink = screen.getByRole('link', { name: 'Edit Profile' });
    expect(editLink).toBeVisible();
    expect(editLink).toHaveAttribute('href', '/profile');
  });

  it('should show create profile button when user has no profile', async () => {
    await setup({
      isAuthenticated: true,
      isEmailVerified: true,
      isMembershipActive: true,
      hasProfile: false,
    });

    const createLink = screen.getByRole('link', { name: 'Create Profile' });
    expect(createLink).toBeVisible();
    expect(createLink).toHaveAttribute('href', '/profile/create');
  });
});

interface SetupOptions {
  isAuthenticated?: boolean;
  isEmailVerified?: boolean;
  isMembershipActive?: boolean;
  hasProfile?: boolean;
}

async function setup({
  isAuthenticated = false,
  isEmailVerified = false,
  isMembershipActive = false,
  hasProfile = false,
}: SetupOptions = {}) {
  // eslint-disable-next-line unicorn/no-null
  const mockUser = isAuthenticated ? { emailVerified: isEmailVerified } : null;

  const mockAuthService = {
    user: signal(mockUser),
    isAdmin: signal(false),
  };

  const mockUserDocument = hasProfile
    ? { profileCreatedAt: new Date(), slug: 'test-slug' }
    : undefined;

  const mockMembershipService = {
    membershipActive: signal(isMembershipActive),
    userDocument: signal(mockUserDocument),
  };

  await render(Header, {
    providers: [
      {
        provide: AuthService,
        useValue: mockAuthService,
      },
      {
        provide: MembershipService,
        useValue: mockMembershipService,
      },
    ],
  });
}
