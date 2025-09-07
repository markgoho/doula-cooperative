import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './sign-in.html',
  styleUrls: ['./sign-in.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignIn {
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private firestore = inject(Firestore);

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

        // Sign in user and get the user credential
        const userCredential = await this.authService.signInWithEmail(email, password);
        const signedInUser = userCredential.user;

        // Check email verification status from Firestore document (authoritative source)
        const userDocumentReference = doc(this.firestore, 'members', signedInUser.uid);
        const userDocumentSnapshot = await getDoc(userDocumentReference);

        let isEmailVerified = false;
        if (userDocumentSnapshot.exists()) {
          const userData = userDocumentSnapshot.data() as { emailVerified?: boolean };
          isEmailVerified = userData.emailVerified ?? false;
        }

        // Navigate based on email verification status
        await this.router.navigate(
          isEmailVerified ? ['/membership'] : ['/check-email'],
          isEmailVerified ? undefined : { queryParams: { email } },
        );
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
