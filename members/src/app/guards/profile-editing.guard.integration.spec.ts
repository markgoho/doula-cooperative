import { ChangeDetectionStrategy, Component } from '@angular/core';
import { signal } from '@angular/core';
import { provideRouter, RouterOutlet } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { MembershipService } from '../services/membership.service';
import { profileEditingGuard } from './profile-editing.guard';

@Component({
  selector: 'app-mock-membership-page',
  template: '<h1>Membership Page</h1>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockMembershipPage {}

@Component({
  selector: 'app-mock-edit-profile-page',
  template: '<h1>Edit Profile Page</h1>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockEditProfilePage {}

@Component({
  selector: 'app-mock-create-profile-page',
  template: '<h1>Create Profile Page</h1>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockCreateProfilePage {}

@Component({
  selector: 'app-mock-root',
  template: '<router-outlet></router-outlet>',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockApp {}

const routes = [
  { path: 'membership', component: MockMembershipPage },
  {
    path: 'profile',
    component: MockEditProfilePage,
    canActivate: [profileEditingGuard],
  },
  {
    path: 'profile/create',
    component: MockCreateProfilePage,
    canActivate: [profileEditingGuard],
  },
];

describe('profileEditingGuard - Integration Tests', () => {
  it('should allow profile route when membership is active and editing is enabled', async () => {
    const { navigate } = await setup({ membershipActive: true, allowProfileEditing: true });

    await navigate('/profile');

    expect(screen.getByText('Edit Profile Page')).toBeVisible();
  });

  it('should redirect profile route to membership when editing is disabled', async () => {
    const { navigate } = await setup({ membershipActive: true, allowProfileEditing: false });

    await navigate('/profile');

    expect(screen.getByText('Membership Page')).toBeVisible();
  });

  it('should redirect create route to membership when membership is inactive', async () => {
    const { navigate } = await setup({ membershipActive: false, allowProfileEditing: true });

    await navigate('/profile/create');

    expect(screen.getByText('Membership Page')).toBeVisible();
  });

  it('should allow create route when membership is active and editing is enabled', async () => {
    const { navigate } = await setup({ membershipActive: true, allowProfileEditing: true });

    await navigate('/profile/create');

    expect(screen.getByText('Create Profile Page')).toBeVisible();
  });
});

interface SetupOptions {
  membershipActive?: boolean;
  allowProfileEditing?: boolean;
}

async function setup({
  membershipActive = false,
  allowProfileEditing = false,
}: SetupOptions = {}) {
  const mockMembershipService = {
    userDocument: signal({
      uid: 'user123',
      email: 'jane@example.com',
      createdAt: new Date(),
      isAdmin: false,
      membershipActive,
      allowProfileEditing,
    }),
  };

  const { navigate } = await render(MockApp, {
    providers: [
      provideRouter(routes),
      { provide: MembershipService, useValue: mockMembershipService },
    ],
  });

  return { navigate };
}
