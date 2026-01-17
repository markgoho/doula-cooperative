import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MembershipService } from '../services/membership.service';
import { ProfileService } from '../services/profile.service';
import { ImageCropper, type CropResult } from './image-cropper/image-cropper';

type EditorState =
  | 'viewing'
  | 'selecting'
  | 'loading-existing'
  | 'cropping'
  | 'uploading'
  | 'deleting'
  | 'confirming-delete';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

@Component({
  imports: [RouterLink, ImageCropper],
  templateUrl: './edit-profile-image.html',
  styleUrl: './edit-profile-image.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfileImage {
  private readonly membershipService = inject(MembershipService);
  readonly profileService = inject(ProfileService);

  protected readonly editorState = signal<EditorState>('viewing');
  protected readonly selectedFile = signal<File | undefined>(undefined);
  protected readonly errorMessage = signal<string | undefined>(undefined);
  protected readonly successMessage = signal<string | undefined>(undefined);

  private buildSourceUrl(slug: string, extension: string): string {
    return `https://raw.githubusercontent.com/markgoho/doula-cooperative/refs/heads/trunk/hugo/content/doulas/${slug}/${slug}-profile${extension}`;
  }

  private async fetchSourceImage(slug: string): Promise<{ blob: Blob; mimeType: string }> {
    for (const extension of IMAGE_EXTENSIONS) {
      const url = this.buildSourceUrl(slug, extension);
      try {
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          return { blob, mimeType: blob.type || 'image/jpeg' };
        }
      } catch (error) {
        console.error(`Network error fetching ${extension}:`, error);
      }
    }

    throw new Error('Could not find source image');
  }

  protected async loadExistingImage(): Promise<void> {
    const slug = this.membershipService.userDocument()?.slug;
    if (!slug) {
      this.errorMessage.set(
        'Unable to load your image. Please ensure your profile is set up first.',
      );
      return;
    }

    this.editorState.set('loading-existing');
    this.errorMessage.set(undefined);
    this.successMessage.set(undefined);

    try {
      const { blob, mimeType } = await this.fetchSourceImage(slug);
      const file = new File([blob], 'profile-image.jpg', { type: mimeType });

      this.selectedFile.set(file);
      this.editorState.set('cropping');
    } catch (error) {
      console.error('Failed to load existing image for editing:', {
        error: error instanceof Error ? error.message : String(error),
        slug,
      });
      this.errorMessage.set('Could not load existing image for editing.');
      this.editorState.set('viewing');
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    // Reset input so same file can be selected again
    input.value = '';

    if (!file) {
      return;
    }

    // Validate file type
    if (!ALLOWED_TYPES.has(file.type)) {
      this.errorMessage.set('Please select a valid image (JPEG, PNG, or WebP).');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      this.errorMessage.set('Image is too large. Maximum size is 10MB.');
      return;
    }

    this.errorMessage.set(undefined);
    this.selectedFile.set(file);
    this.editorState.set('cropping');
  }

  protected async onCropConfirmed(result: CropResult): Promise<void> {
    this.editorState.set('uploading');
    this.errorMessage.set(undefined);

    try {
      // Use the cropped preview from Cropper.js for optimistic display
      await this.profileService.uploadProfileImage(
        result.file,
        result.cropData,
        result.previewDataUrl,
      );

      this.successMessage.set('Profile image updated successfully!');
      this.editorState.set('viewing');
      this.selectedFile.set(undefined);
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Upload failed. Please try again.',
      );
      this.editorState.set('viewing');
    }
  }

  protected onCropCancelled(): void {
    this.selectedFile.set(undefined);
    this.editorState.set('viewing');
  }

  protected startDelete(): void {
    this.editorState.set('confirming-delete');
    this.errorMessage.set(undefined);
    this.successMessage.set(undefined);
  }

  protected cancelDelete(): void {
    this.editorState.set('viewing');
  }

  protected confirmDelete(): void {
    this.editorState.set('deleting');
    this.errorMessage.set(undefined);

    this.profileService
      .deleteProfileImage()
      .then(() => {
        this.successMessage.set('Profile image removed.');
        this.editorState.set('viewing');
      })
      .catch((error: unknown) => {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Delete failed. Please try again.',
        );
        this.editorState.set('viewing');
      });
  }

  protected clearMessages(): void {
    this.errorMessage.set(undefined);
    this.successMessage.set(undefined);
  }
}
