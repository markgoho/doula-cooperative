import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  templateUrl: './email-verified.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./email-verified.scss'],
  imports: [RouterLink],
})
export class EmailVerified implements OnInit {
  private authService = inject(AuthService);

  verificationState = signal<'verifying' | 'verified' | 'error'>('verifying');
  errorMessage = signal('');

  ngOnInit(): void {
    void this.verifyUserEmail();
  }

  private async verifyUserEmail(): Promise<void> {
    try {
      await this.authService.setUserEmailVerified();
      this.verificationState.set('verified');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      this.errorMessage.set(errorMessage);
      this.verificationState.set('error');
    }
  }
}
