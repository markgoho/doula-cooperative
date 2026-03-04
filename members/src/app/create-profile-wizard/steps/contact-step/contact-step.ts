import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProfileService } from '../../../services/profile.service';
import { AlertBanner } from '../../../shared/alert-banner/alert-banner';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';

@Component({
  imports: [ReactiveFormsModule, AlertBanner],
  templateUrl: './contact-step.html',
  styleUrls: ['../../../shared/profile-form/profile-form-styles.scss', './contact-step.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactStep {
  private readonly wizardService = inject(CreateProfileWizardService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.fb.group({
    businessName: [this.wizardService.contactInfo().businessName],
    phone: [this.wizardService.contactInfo().phone],
    email: [this.wizardService.contactInfo().email, [Validators.email]],
    website: [this.wizardService.contactInfo().website],
  });

  protected get emailControl() {
    return this.form.get('email')!;
  }

  protected async onNext(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      // Save contact info to wizard service
      this.wizardService.contactInfo.set({
        businessName: this.form.value.businessName?.trim() ?? '',
        phone: this.form.value.phone?.trim() ?? '',
        email: this.form.value.email?.trim() ?? '',
        website: this.form.value.website?.trim() ?? '',
      });

      // Create the profile via API
      const profileData = this.wizardService.buildProfileData();
      await this.profileService.createProfileContent(profileData);

      this.wizardService.profileCreated.set(true);
      this.wizardService.completeStep('contact');
      void this.router.navigate(['/profile/create/image']);
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to create profile. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected onBack(): void {
    // Save current contact info even when going back
    this.wizardService.contactInfo.set({
      businessName: this.form.value.businessName?.trim() ?? '',
      phone: this.form.value.phone?.trim() ?? '',
      email: this.form.value.email?.trim() ?? '',
      website: this.form.value.website?.trim() ?? '',
    });
    void this.router.navigate(['/profile/create/bio']);
  }
}
