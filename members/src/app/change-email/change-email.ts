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
    email: ['', [Validators.required, Validators.email]],
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
        const message =
          error instanceof Error
            ? error.message
            : 'Something went wrong while sending the verification email. Please try again.';
        this.errorMessage.set(message);
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
}
