import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AlertBanner } from '../shared/alert-banner/alert-banner';

@Component({
  imports: [RouterLink, ReactiveFormsModule, AlertBanner],
  templateUrl: './change-email.html',
  styleUrls: ['./change-email.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeEmail {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  changeEmailForm: FormGroup = this.fb.group({
    email: ['', [Validators.required.bind(this), Validators.email.bind(this)]],
  });

  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  async onSubmit() {
    if (this.changeEmailForm.valid) {
      this.isLoading.set(true);
      this.errorMessage.set('');
      this.successMessage.set('');

      try {
        const { email } = this.changeEmailForm.value as { email: string };

        await this.authService.verifyBeforeUpdateEmail(email);

        this.successMessage.set(
          `We've sent a verification link to ${email}. Click it to complete the change. You'll also get a notice at your current email.`,
        );
        this.changeEmailForm.reset();
      } catch (error) {
        if (error instanceof Error) {
          this.errorMessage.set(error.message);
        }
      } finally {
        this.isLoading.set(false);
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched() {
    for (const key of Object.keys(this.changeEmailForm.controls)) {
      const control = this.changeEmailForm.get(key);
      control?.markAsTouched();
    }
  }

  get email() {
    return this.changeEmailForm.get('email');
  }
}
