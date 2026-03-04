import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ProfileService } from '../../../services/profile.service';
import { ProfilePreview } from '../../../shared/profile-preview/profile-preview';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';
import { AlertBanner } from '../../../shared/alert-banner/alert-banner';

const STEP_ROUTE_MAP: Record<string, string> = {
  personal: '/profile/create/personal',
  tags: '/profile/create/tags',
  bio: '/profile/create/bio',
  contact: '/profile/create/contact',
  image: '/profile/create/image',
};

@Component({
  imports: [ProfilePreview, AlertBanner],
  templateUrl: './preview-step.html',
  styleUrl: './preview-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewStep {
  private readonly wizardService = inject(CreateProfileWizardService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);

  protected readonly profileData = computed(() => {
    return this.wizardService.buildProfileData();
  });

  protected readonly imageUrl = this.profileService.profileImageUrl;

  protected onEditSection(section: string): void {
    const route = STEP_ROUTE_MAP[section];
    if (route) {
      void this.router.navigate([route]);
    }
  }

  protected onFinish(): void {
    this.wizardService.reset();
    void this.router.navigate(['/profile']);
  }
}
