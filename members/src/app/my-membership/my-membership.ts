import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AUTH_ERROR_MESSAGES, AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';

@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './my-membership.html',
  styleUrl: './my-membership.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyMembership {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private membershipService = inject(MembershipService);

  protected readonly currentYear = new Date().getFullYear();

  // Expose the observable for use with async pipe in template
  protected user = toSignal(this.authService.user$);
  protected isLoading = signal(false);
  protected errorMessage = signal<string>('');
  protected claimableProfileExists = signal(false);
  protected claimInProgress = signal(false);

  protected signInForm: FormGroup = this.fb.group({
    email: ['', [Validators.required.bind(this), Validators.email.bind(this)]],
    password: ['', [Validators.required.bind(this), Validators.minLength.bind(this, 6)]],
  });

  constructor() {
    effect(() => {
      // When the user signal changes, trigger the check for a claimable profile.
      // We wrap the async logic in a void call to satisfy the effect's synchronous nature.
      void this.checkForClaimableProfile();
    });
  }

  private async checkForClaimableProfile(): Promise<void> {
    const currentUser = this.user();
    this.claimableProfileExists.set(
      await this.membershipService.checkForClaimableProfile(currentUser),
    );
  }

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

  protected async onClaimProfile() {
    this.claimInProgress.set(true);
    try {
      await this.authService.claimProfile();
      this.claimableProfileExists.set(false); // Hide the button after claiming
    } catch (error) {
      console.error('Failed to claim profile:', error);
      this.errorMessage.set('An error occurred while claiming your profile. Please try again.');
    } finally {
      this.claimInProgress.set(false);
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
