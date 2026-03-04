import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProfileService } from '../../../services/profile.service';
import { AlertBanner } from '../../../shared/alert-banner/alert-banner';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';

type ImageStepState = 'ready' | 'selecting' | 'uploading';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Component({
  imports: [AlertBanner],
  templateUrl: './image-step.html',
  styleUrls: ['./image-step.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageStep {
  private readonly wizardService = inject(CreateProfileWizardService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);

  protected readonly stepState = signal<ImageStepState>('ready');
  protected readonly selectedFile = signal<File | undefined>(undefined);
  protected readonly previewUrl = signal<string | undefined>(undefined);
  protected readonly errorMessage = signal<string | undefined>(undefined);
  protected readonly successMessage = signal<string | undefined>(undefined);

  constructor() {
    // Load the profile so image URL signal works
    this.profileService.loadProfile();

    // Cleanup preview URL when it changes or component is destroyed
    effect((onCleanup) => {
      const url = this.previewUrl();
      onCleanup(() => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    // Reset input so same file can be selected again
    input.value = '';

    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      this.errorMessage.set('Please select a valid image (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      this.errorMessage.set('Image is too large. Maximum size is 10MB.');
      return;
    }

    this.errorMessage.set(undefined);
    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    this.stepState.set('selecting');
  }

  protected async uploadSelectedFile(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    this.stepState.set('uploading');
    this.errorMessage.set(undefined);

    try {
      await this.profileService.uploadProfileImage(file);
      this.successMessage.set('Photo uploaded successfully!');
      this.cancelSelection();
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Upload failed. Please try again.',
      );
      this.stepState.set('selecting');
    }
  }

  protected cancelSelection(): void {
    this.selectedFile.set(undefined);
    this.previewUrl.set(undefined);
    this.stepState.set('ready');
  }

  protected onNext(): void {
    this.wizardService.completeStep('image');
    void this.router.navigate(['/profile/create/preview']);
  }

  protected onSkip(): void {
    this.wizardService.completeStep('image');
    void this.router.navigate(['/profile/create/preview']);
  }

  protected onBack(): void {
    void this.router.navigate(['/profile/create/contact']);
  }
}
