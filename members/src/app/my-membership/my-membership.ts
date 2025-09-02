import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AUTH_ERROR_MESSAGES, AuthService } from '../services/auth.service';

@Component({
  selector: 'app-my-membership',
  imports: [AsyncPipe, ReactiveFormsModule],
  templateUrl: './my-membership.html',
  styleUrl: './my-membership.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyMembership {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  protected readonly currentYear = new Date().getFullYear();

  // Expose the observable for use with async pipe in template
  protected user$ = this.authService.user$;
  protected isLoading = signal(false);
  protected errorMessage = signal<string>('');

  protected signInForm: FormGroup = this.fb.group({
    email: ['', [Validators.required.bind(this), Validators.email.bind(this)]],
    password: ['', [Validators.required.bind(this), Validators.minLength.bind(this, 6)]],
  });

  protected async onSignIn() {
    if (this.signInForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const formValue = this.signInForm.value as { email: string; password: string };
      const { email, password } = formValue;
      await this.authService.signInWithEmail(email, password);
      this.signInForm.reset();
    } catch (error: unknown) {
      console.error('Sign in failed:', error);
      const errorMessage =
        error instanceof Error && 'code' in error
          ? (error as { code: string }).code
          : 'auth/unknown-error';
      this.errorMessage.set(
        AUTH_ERROR_MESSAGES[errorMessage] ?? AUTH_ERROR_MESSAGES['auth/unknown-error'],
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async onSignOut() {
    try {
      await this.authService.signOut();
    } catch (error: unknown) {
      console.error('Sign out failed:', error);
    }
  }

  private markFormGroupTouched() {
    for (const key of Object.keys(this.signInForm.controls)) {
      const control = this.signInForm.get(key);
      control?.markAsTouched();
    }
  }
}
