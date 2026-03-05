import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';

@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './contact-step.html',
  styleUrls: ['../../../shared/profile-form/profile-form-styles.scss', './contact-step.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactStep {
  private readonly wizardService = inject(CreateProfileWizardService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.group({
    businessName: [this.wizardService.contactInfo().businessName],
    phone: [this.wizardService.contactInfo().phone],
    email: [this.wizardService.contactInfo().email, [Validators.email]],
    website: [this.wizardService.contactInfo().website],
  });

  protected get emailControl() {
    return this.form.get('email')!;
  }

  private saveContactInfo(): void {
    this.wizardService.contactInfo.set({
      businessName: this.form.value.businessName?.trim() ?? '',
      phone: this.form.value.phone?.trim() ?? '',
      email: this.form.value.email?.trim() ?? '',
      website: this.form.value.website?.trim() ?? '',
    });
  }

  protected onNext(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saveContactInfo();
    this.wizardService.completeStep('contact');
    void this.router.navigate(['/profile/create/image']);
  }

  protected onBack(): void {
    this.saveContactInfo();
    void this.router.navigate(['/profile/create/bio']);
  }
}
