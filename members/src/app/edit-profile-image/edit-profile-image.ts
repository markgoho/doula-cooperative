import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProfileService } from '../services/profile.service';

type EditorState = 'viewing' | 'selecting' | 'uploading' | 'deleting' | 'confirming-delete';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Component({
  imports: [RouterLink],
  templateUrl: './edit-profile-image.html',
  styleUrl: './edit-profile-image.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfileImage {
  readonly profileService = inject(ProfileService);

  protected readonly editorState = signal<EditorState>('viewing');
  protected readonly selectedFile = signal<File | undefined>(undefined);
  protected readonly previewUrl = signal<string | undefined>(undefined);
  protected readonly errorMessage = signal<string | undefined>(undefined);
  protected readonly successMessage = signal<string | undefined>(undefined);

  constructor() {
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
    this.previewUrl.set(URL.createObjectURL(file));
    this.editorState.set('selecting');
  }

  protected async uploadSelectedFile(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    this.editorState.set('uploading');
    this.errorMessage.set(undefined);

    try {
      await this.profileService.uploadProfileImage(file);

      this.successMessage.set(
        'Profile image updated! Your public profile will reflect this change shortly.',
      );
      this.cancelSelection();
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Upload failed. Please try again.',
      );
      this.editorState.set('selecting');
    }
  }

  protected cancelSelection(): void {
    this.selectedFile.set(undefined);
    this.previewUrl.set(undefined);
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
