import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';

@Component({
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './sign-in.html',
  styleUrls: ['./sign-in.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignIn {
  private authService = inject(AuthService);
  private membershipService = inject(MembershipService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  message = input<string>();

  signInForm: FormGroup = this.fb.group({
    email: ['', [Validators.required.bind(this), Validators.email.bind(this)]],
    password: ['', [Validators.required.bind(this)]],
  });

  isLoading = signal(false);
  errorMessage = signal('');

  async onSubmit() {
    if (this.signInForm.valid) {
      this.isLoading.set(true);
      this.errorMessage.set('');

      try {
        const { email, password } = this.signInForm.value as { email: string; password: string };

        await this.authService.signInWithEmail(email, password);

        if (this.message() === 'email-changed') {
          await this.membershipService.syncAuthEmailToMember();
        }

        await this.router.navigate(['/membership']);
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
    for (const key of Object.keys(this.signInForm.controls)) {
      const control = this.signInForm.get(key);
      control?.markAsTouched();
    }
  }

  get email() {
    return this.signInForm.get('email');
  }
  get password() {
    return this.signInForm.get('password');
  }
}
