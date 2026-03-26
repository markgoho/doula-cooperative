import { ChangeDetectionStrategy, Component, signal, type WritableSignal } from '@angular/core';
import { provideRouter, RouterOutlet } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import type { ResourceStatus } from '@angular/core';
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
  selector: 'app-mock-edit-profile-image-page',
  template: '<h1>Edit Profile Image Page</h1>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockEditProfileImagePage {}

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
  {
    path: 'profile/image',
    component: MockEditProfileImagePage,
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

  it('should wait for member document loading before allowing guarded routes', async () => {
    const { navigate, resourceStatus } = await setup({
      membershipActive: true,
      allowProfileEditing: true,
      resourceStatus: 'loading',
    });

    const navigation = navigate('/profile');

    expect(screen.queryByText('Edit Profile Page')).toBeNull();
    expect(screen.queryByText('Membership Page')).toBeNull();

    resourceStatus.set('resolved');
    await navigation;

    await waitFor(() => {
      expect(screen.getByText('Edit Profile Page')).toBeVisible();
    });
  });

  it('should redirect when member document finishes loading without editing permission', async () => {
    const { navigate, resourceStatus, memberDocument } = await setup({
      membershipActive: true,
      allowProfileEditing: true,
      resourceStatus: 'loading',
    });

    const navigation = navigate('/profile');
    memberDocument.set({
      uid: 'user123',
      email: 'jane@example.com',
      createdAt: new Date(),
      isAdmin: false,
      membershipActive: true,
      allowProfileEditing: false,
    });
    resourceStatus.set('resolved');
    await navigation;

    await waitFor(() => {
      expect(screen.getByText('Membership Page')).toBeVisible();
    });
  });

  it('should redirect guarded routes when member document load errors', async () => {
    const { navigate } = await setup({ resourceStatus: 'error' });

    await navigate('/profile');

    expect(screen.getByText('Membership Page')).toBeVisible();
  });

  it('should guard the profile image route', async () => {
    const { navigate } = await setup({ membershipActive: true, allowProfileEditing: true });

    await navigate('/profile/image');

    expect(screen.getByText('Edit Profile Image Page')).toBeVisible();
  });
});

interface SetupOptions {
  membershipActive?: boolean;
  allowProfileEditing?: boolean;
  resourceStatus?: ResourceStatus;
}

async function setup({
  membershipActive = false,
  allowProfileEditing = false,
  resourceStatus = 'resolved',
}: SetupOptions = {}) {
  const memberDocument = signal({
    uid: 'user123',
    email: 'jane@example.com',
    createdAt: new Date(),
    isAdmin: false,
    membershipActive,
    allowProfileEditing,
  });
  const statusSignal: WritableSignal<ResourceStatus> = signal(resourceStatus);

  const mockMembershipService = {
    userDocument: memberDocument,
    userDocumentResource: {
      status: statusSignal,
    },
  };

  const { navigate } = await render(MockApp, {
    providers: [
      provideRouter(routes),
      { provide: MembershipService, useValue: mockMembershipService },
    ],
  });

  return { navigate, resourceStatus: statusSignal, memberDocument };
}
