import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import { describe, expect, it } from 'vitest';
import { CreateProfileWizardService, type WizardStep } from '../create-profile-wizard.service';
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
    const { navigate } = await setup();

    await navigate('/profile/create/personal');

    expect(screen.getByText('Personal Step')).toBeVisible();
  });

  it('should redirect to personal when navigating to tags without completing step 1', async () => {
    const { navigate } = await setup();

    await navigate('/profile/create/tags');

    expect(screen.getByText('Personal Step')).toBeVisible();
  });

  it('should allow tags navigation after completing personal', async () => {
    const { navigate } = await setup({ completedSteps: ['personal'] });

    await navigate('/profile/create/tags');

    expect(screen.getByText('Tags Step')).toBeVisible();
  });

  it('should redirect to first incomplete step when skipping ahead', async () => {
    const { navigate } = await setup({ completedSteps: ['personal', 'tags'] });

    // Skip bio, try to go to contact
    await navigate('/profile/create/contact');

    expect(screen.getByText('Bio Step')).toBeVisible();
  });

  it('should allow image step when all prior steps are completed', async () => {
    const { navigate } = await setup({
      completedSteps: ['personal', 'tags', 'bio', 'contact'],
    });

    await navigate('/profile/create/image');

    expect(screen.getByText('Image Step')).toBeVisible();
  });

  it('should allow preview when all steps completed', async () => {
    const { navigate } = await setup({
      completedSteps: ['personal', 'tags', 'bio', 'contact', 'image'],
    });

    await navigate('/profile/create/preview');

    expect(screen.getByText('Preview Step')).toBeVisible();
  });

  it('should redirect preview to first incomplete step when image not completed', async () => {
    const { navigate } = await setup({
      completedSteps: ['personal', 'tags', 'bio', 'contact'],
    });

    await navigate('/profile/create/preview');

    expect(screen.getByText('Image Step')).toBeVisible();
  });
});

interface SetupOptions {
  completedSteps?: WizardStep[];
}

async function setup({ completedSteps = [] }: SetupOptions = {}) {
  const wizardService = new CreateProfileWizardService();

  for (const step of completedSteps) {
    wizardService.completeStep(step);
  }

  await render(MockApp, {
    providers: [
      provideRouter(routes),
      { provide: CreateProfileWizardService, useValue: wizardService },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = async (path: string) => {
    await router.navigateByUrl(path);
  };

  return { navigate };
}
