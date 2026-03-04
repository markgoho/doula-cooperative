import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertBanner } from '../../../shared/alert-banner/alert-banner';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';

@Component({
  imports: [ReactiveFormsModule, AlertBanner],
  templateUrl: './bio-step.html',
  styleUrls: ['../../../shared/profile-form/profile-form-styles.scss', './bio-step.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BioStep {
  private readonly wizardService = inject(CreateProfileWizardService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly errorMessage = signal('');

  protected readonly form = this.fb.group({
    bio: [this.wizardService.bio(), [Validators.required]],
  });

  protected get bioControl() {
    return this.form.get('bio')!;
  }

  protected onNext(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please fill in your bio.');
      return;
    }

    this.wizardService.bio.set(this.form.value.bio?.trim() ?? '');
    this.wizardService.completeStep('bio');
    void this.router.navigate(['/profile/create/contact']);
  }

  protected onBack(): void {
    // Save current bio even when going back
    this.wizardService.bio.set(this.form.value.bio?.trim() ?? '');
    void this.router.navigate(['/profile/create/tags']);
  }
}
