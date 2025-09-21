import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MembershipService } from '../services/membership.service';

@Component({
  imports: [],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfile implements OnInit {
  private membershipService = inject(MembershipService);

  profileContent = signal<string>('');
  isLoading = signal<boolean>(true);
  error = signal<string>('');

  ngOnInit(): void {
    void this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set('');
      const result = await this.membershipService.readProfile();
      this.profileContent.set(result.content);
    } catch (error: unknown) {
      console.error('Error reading profile:', error);
      let errorMessage = 'Failed to load profile';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      this.error.set(errorMessage);
    } finally {
      this.isLoading.set(false);
    }
  }
}
