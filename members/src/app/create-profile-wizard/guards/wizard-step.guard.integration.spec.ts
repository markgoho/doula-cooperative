import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { CreateProfileWizardService } from '../create-profile-wizard.service';
import { wizardStepGuard } from './wizard-step.guard';

@Component({
  selector: 'app-mock-personal',
  template: '<h1>Personal Step</h1>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPersonalStep {}

@Component({
  selector: 'app-mock-tags',
  template: '<h1>Tags Step</h1>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockTagsStep {}

@Component({
  selector: 'app-mock-bio',
  template: '<h1>Bio Step</h1>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockBioStep {}

@Component({
  selector: 'app-mock-contact',
  template: '<h1>Contact Step</h1>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockContactStep {}

@Component({
  selector: 'app-mock-image',
  template: '<h1>Image Step</h1>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockImageStep {}

@Component({
  selector: 'app-mock-preview',
  template: '<h1>Preview Step</h1>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPreviewStep {}

@Component({
  selector: 'app-mock-root',
  template: '<router-outlet></router-outlet>',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockApp {}

const routes = [
  { path: 'profile/create/personal', component: MockPersonalStep },
  {
    path: 'profile/create/tags',
    component: MockTagsStep,
    canActivate: [wizardStepGuard('tags')],
  },
  {
    path: 'profile/create/bio',
    component: MockBioStep,
    canActivate: [wizardStepGuard('bio')],
  },
  {
    path: 'profile/create/contact',
    component: MockContactStep,
    canActivate: [wizardStepGuard('contact')],
  },
  {
    path: 'profile/create/image',
    component: MockImageStep,
    canActivate: [wizardStepGuard('image')],
  },
  {
    path: 'profile/create/preview',
    component: MockPreviewStep,
    canActivate: [wizardStepGuard('preview')],
  },
];

describe('wizardStepGuard - Integration Tests', () => {
  it('should navigate to personal step (no guard)', async () => {
    const { navigateTo } = await setup();

    await navigateTo('/profile/create/personal');

    expect(screen.getByText('Personal Step')).toBeVisible();
  });

  it('should redirect to personal when navigating to tags without completing step 1', async () => {
    const { router, navigateTo } = await setup();

    await navigateTo('/profile/create/tags');

    expect(router.url).toBe('/profile/create/personal');
    expect(screen.getByText('Personal Step')).toBeVisible();
  });

  it('should allow tags navigation after completing personal', async () => {
    const { router, navigateTo, wizardService } = await setup();

    wizardService.completeStep('personal');
    await navigateTo('/profile/create/tags');

    expect(router.url).toBe('/profile/create/tags');
    expect(screen.getByText('Tags Step')).toBeVisible();
  });

  it('should redirect to first incomplete step when skipping ahead', async () => {
    const { router, navigateTo, wizardService } = await setup();

    wizardService.completeStep('personal');
    wizardService.completeStep('tags');
    // Skip bio, try to go to contact
    await navigateTo('/profile/create/contact');

    expect(router.url).toBe('/profile/create/bio');
    expect(screen.getByText('Bio Step')).toBeVisible();
  });

  it('should block image step without profileCreated via canNavigateToStep', async () => {
    const { wizardService } = await setup();

    wizardService.completeStep('personal');
    wizardService.completeStep('tags');
    wizardService.completeStep('bio');
    wizardService.completeStep('contact');

    // Verify the guard logic blocks image without profileCreated
    expect(wizardService.canNavigateToStep('image')).toBe(false);
  });

  it('should allow image step when profileCreated is true', async () => {
    const { router, navigateTo, wizardService } = await setup();

    wizardService.completeStep('personal');
    wizardService.completeStep('tags');
    wizardService.completeStep('bio');
    wizardService.completeStep('contact');
    wizardService.profileCreated.set(true);

    await navigateTo('/profile/create/image');

    expect(router.url).toBe('/profile/create/image');
    expect(screen.getByText('Image Step')).toBeVisible();
  });

  it('should block preview step without profileCreated via canNavigateToStep', async () => {
    const { wizardService } = await setup();

    wizardService.completeStep('personal');
    wizardService.completeStep('tags');
    wizardService.completeStep('bio');
    wizardService.completeStep('contact');
    wizardService.completeStep('image');

    // Verify the guard logic blocks preview without profileCreated
    expect(wizardService.canNavigateToStep('preview')).toBe(false);
  });

  it('should allow preview when all steps completed and profileCreated', async () => {
    const { router, navigateTo, wizardService } = await setup();

    wizardService.completeStep('personal');
    wizardService.completeStep('tags');
    wizardService.completeStep('bio');
    wizardService.completeStep('contact');
    wizardService.completeStep('image');
    wizardService.profileCreated.set(true);

    await navigateTo('/profile/create/preview');

    expect(router.url).toBe('/profile/create/preview');
    expect(screen.getByText('Preview Step')).toBeVisible();
  });

  it('should preserve previously completed steps when completing new ones', async () => {
    const { router, navigateTo, wizardService } = await setup();

    wizardService.completeStep('personal');
    wizardService.completeStep('tags');

    await navigateTo('/profile/create/bio');

    expect(router.url).toBe('/profile/create/bio');
    expect(screen.getByText('Bio Step')).toBeVisible();
    expect(wizardService.completedSteps().has('personal')).toBe(true);
    expect(wizardService.completedSteps().has('tags')).toBe(true);
  });
});

async function setup() {
  const view = await render(MockApp, {
    providers: [provideRouter(routes)],
  });

  const router = TestBed.inject(Router);
  const wizardService = TestBed.inject(CreateProfileWizardService);

  // Reset wizard state for clean test isolation
  wizardService.reset();

  async function navigateTo(url: string): Promise<void> {
    await router.navigateByUrl(url);
    view.fixture.detectChanges();
  }

  return { wizardService, router, navigateTo };
}
