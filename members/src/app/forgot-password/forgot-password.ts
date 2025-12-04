import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPassword {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  forgotPasswordForm: FormGroup = this.fb.group({
    email: ['', [Validators.required.bind(this), Validators.email.bind(this)]],
  });

  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  async onSubmit() {
    if (this.forgotPasswordForm.valid) {
      this.isLoading.set(true);
      this.errorMessage.set('');
      this.successMessage.set('');

      try {
        const { email } = this.forgotPasswordForm.value as { email: string };

        await this.authService.sendPasswordResetEmail(email);

        this.successMessage.set(
          'Password reset email sent! Please check your inbox and follow the instructions to reset your password.',
        );
        this.forgotPasswordForm.reset();
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
    for (const key of Object.keys(this.forgotPasswordForm.controls)) {
      const control = this.forgotPasswordForm.get(key);
      control?.markAsTouched();
    }
  }

  get email() {
    return this.forgotPasswordForm.get('email');
  }
}
