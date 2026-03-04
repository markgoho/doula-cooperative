import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type WizardStep, WIZARD_STEPS } from '../create-profile-wizard.service';

interface StepDisplay {
  key: WizardStep;
  label: string;
  route: string;
}

const STEP_DISPLAYS: StepDisplay[] = [
  { key: 'personal', label: 'Personal Info', route: 'personal' },
  { key: 'tags', label: 'Services', route: 'tags' },
  { key: 'bio', label: 'Bio', route: 'bio' },
  { key: 'contact', label: 'Contact', route: 'contact' },
  { key: 'image', label: 'Photo', route: 'image' },
  { key: 'preview', label: 'Preview', route: 'preview' },
];

@Component({
  selector: 'app-step-indicator',
  imports: [RouterLink],
  templateUrl: './step-indicator.html',
  styleUrl: './step-indicator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepIndicator {
  readonly currentStep = input.required<WizardStep>();
  readonly completedSteps = input.required<ReadonlySet<WizardStep>>();

  protected readonly steps = STEP_DISPLAYS;

  protected readonly currentStepIndex = computed(() => {
    return WIZARD_STEPS.indexOf(this.currentStep());
  });

  protected isCompleted(step: WizardStep): boolean {
    return this.completedSteps().has(step);
  }

  protected isCurrent(step: WizardStep): boolean {
    return this.currentStep() === step;
  }

  protected isAccessible(step: WizardStep): boolean {
    return this.isCompleted(step) || this.isCurrent(step);
  }
}
