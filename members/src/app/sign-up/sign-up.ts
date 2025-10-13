import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

interface SignUpFormValue {
  email: string;
  password: string;
  confirmPassword: string;
}

@Component({
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './sign-up.html',
  styleUrls: ['./sign-up.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUp {
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  signUpForm = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: (form: AbstractControl): ValidationErrors | null => {
        const password = form.get('password');
        const confirmPassword = form.get('confirmPassword');

        if (password && confirmPassword && password.value !== confirmPassword.value) {
          confirmPassword.setErrors({ mismatch: true });
          return { mismatch: true };
        }
        // eslint-disable-next-line unicorn/no-null
        return null as ValidationErrors | null;
      },
    },
  );

  loading = signal(false);
  errorMessage = signal('');

  async onSubmit() {
    if (this.signUpForm.valid) {
      this.loading.set(true);
      this.errorMessage.set('');

      try {
        const formValue = this.signUpForm.value as SignUpFormValue;
        const { password } = formValue;
        await this.authService.signUpWithEmail(formValue.email, password);

        // Redirect to membership page - email verification status will be handled there
        await this.router.navigate(['/membership']);
      } catch (error) {
        if (error instanceof Error) {
          this.errorMessage.set(error.message);
        }
      } finally {
        this.loading.set(false);
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched() {
    for (const key of Object.keys(this.signUpForm.controls)) {
      const control = this.signUpForm.get(key);
      control?.markAsTouched();
    }
  }

  get email() {
    return this.signUpForm.get('email');
  }
  get password() {
    return this.signUpForm.get('password');
  }
  get confirmPassword() {
    return this.signUpForm.get('confirmPassword');
  }
}
