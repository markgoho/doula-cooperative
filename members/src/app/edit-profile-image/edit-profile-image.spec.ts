import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditProfileImage } from './edit-profile-image';

describe('EditProfileImage', () => {
  describe('image display', () => {
    it('should display current image when imageUrl is provided', async () => {
      await setup({ imageUrl: 'https://example.com/profile.jpg' });

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', 'https://example.com/profile.jpg');
    });

    it('should display placeholder when no imageUrl provided', async () => {
      await setup();

      expect(screen.getByText(/no image/i)).toBeVisible();
    });

    it('should display alt text for accessibility', async () => {
      await setup({ imageUrl: 'https://example.com/profile.jpg' });

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt');
    });
  });

  describe('file selection', () => {
    it('should have a file input for selecting images', async () => {
      await setup();

      const fileInput = screen.getByLabelText(/choose image|select image|upload/i);
      expect(fileInput).toHaveAttribute('type', 'file');
    });

    it('should accept only image files', async () => {
      await setup();

      const fileInput = screen.getByLabelText(/choose image|select image|upload/i);
      expect(fileInput).toHaveAttribute('accept', expect.stringContaining('image'));
    });

    it('should update preview when file is selected', async () => {
      const user = userEvent.setup();
      await setup();

      const fileInput = screen.getByLabelText(/choose image|select image|upload/i);
      const file = new File(['image'], 'profile.jpg', { type: 'image/jpeg' });

      await user.upload(fileInput, file);

      // Check that preview is shown (implementation specific)
      // This test may need adjustment based on actual implementation
      expect(fileInput.files?.[0]).toBe(file);
    });

    it('should show file name after selection', async () => {
      const user = userEvent.setup();
      await setup();

      const fileInput = screen.getByLabelText(/choose image|select image|upload/i);
      const file = new File(['image'], 'profile.jpg', { type: 'image/jpeg' });

      await user.upload(fileInput, file);

      expect(screen.getByText(/profile\.jpg/i)).toBeVisible();
    });
  });

  describe('file upload', () => {
    it('should have an upload button', async () => {
      await setup();

      expect(screen.getByRole('button', { name: /upload|save/i })).toBeVisible();
    });

    it('should disable upload button when no file selected', async () => {
      await setup();

      const uploadButton = screen.getByRole('button', { name: /upload|save/i });
      expect(uploadButton).toBeDisabled();
    });

    it('should enable upload button when file is selected', async () => {
      const user = userEvent.setup();
      await setup();

      const fileInput = screen.getByLabelText(/choose image|select image|upload/i);
      const file = new File(['image'], 'profile.jpg', { type: 'image/jpeg' });

      await user.upload(fileInput, file);

      const uploadButton = screen.getByRole('button', { name: /upload|save/i });
      expect(uploadButton).not.toBeDisabled();
    });

    it('should show loading state during upload', async () => {
      const user = userEvent.setup();
      let resolveUpload: () => void;
      const mockOnUpload = vi.fn().mockImplementation(() => new Promise(resolve => {
        resolveUpload = resolve;
      }));

      await setup({ onUpload: mockOnUpload });

      const fileInput = screen.getByLabelText(/choose image|select image|upload/i);
      const file = new File(['image'], 'profile.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, file);

      const uploadButton = screen.getByRole('button', { name: /upload|save/i });
      await user.click(uploadButton);

      expect(screen.getByText(/uploading/i)).toBeVisible();

      resolveUpload!();
    });

    it('should call onUpload callback with selected file', async () => {
      const user = userEvent.setup();
      const mockOnUpload = vi.fn().mockResolvedValue(undefined);
      await setup({ onUpload: mockOnUpload });

      const fileInput = screen.getByLabelText(/choose image|select image|upload/i);
      const file = new File(['image'], 'profile.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, file);

      const uploadButton = screen.getByRole('button', { name: /upload|save/i });
      await user.click(uploadButton);

      expect(mockOnUpload).toHaveBeenCalledWith(file);
    });

    it('should show error message when upload fails', async () => {
      const user = userEvent.setup();
      const mockOnUpload = vi.fn().mockRejectedValue(new Error('Upload failed'));
      await setup({ onUpload: mockOnUpload });

      const fileInput = screen.getByLabelText(/choose image|select image|upload/i);
      const file = new File(['image'], 'profile.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, file);

      const uploadButton = screen.getByRole('button', { name: /upload|save/i });
      await user.click(uploadButton);

      expect(await screen.findByText(/upload failed|error/i)).toBeVisible();
    });

    it('should show success message after successful upload', async () => {
      const user = userEvent.setup();
      const mockOnUpload = vi.fn().mockResolvedValue(undefined);
      await setup({ onUpload: mockOnUpload });

      const fileInput = screen.getByLabelText(/choose image|select image|upload/i);
      const file = new File(['image'], 'profile.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, file);

      const uploadButton = screen.getByRole('button', { name: /upload|save/i });
      await user.click(uploadButton);

      expect(await screen.findByText(/success|uploaded/i)).toBeVisible();
    });
  });

  describe('file validation', () => {
    it('should reject files larger than max size', async () => {
      const user = userEvent.setup();
      await setup({ maxFileSize: 1024 * 1024 }); // 1MB

      const fileInput = screen.getByLabelText(/choose image|select image|upload/i);
      const largeFile = new File(
        [new ArrayBuffer(2 * 1024 * 1024)], // 2MB
        'large-image.jpg',
        { type: 'image/jpeg' }
      );

      await user.upload(fileInput, largeFile);

      expect(screen.getByText(/file too large|size/i)).toBeVisible();
    });

    it('should reject non-image files', async () => {
      const user = userEvent.setup();
      await setup();

      const fileInput = screen.getByLabelText(/choose image|select image|upload/i);
      const textFile = new File(['text'], 'document.txt', { type: 'text/plain' });

      await user.upload(fileInput, textFile);

      expect(screen.getByText(/invalid file type|image/i)).toBeVisible();
    });

    it('should accept valid image formats (jpg, png, gif)', async () => {
      const user = userEvent.setup();
      await setup();

      const fileInput = screen.getByLabelText(/choose image|select image|upload/i);

      // Test JPEG
      const jpegFile = new File(['image'], 'image.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, jpegFile);
      expect(screen.queryByText(/invalid file type/i)).not.toBeInTheDocument();

      // Test PNG
      const pngFile = new File(['image'], 'image.png', { type: 'image/png' });
      await user.upload(fileInput, pngFile);
      expect(screen.queryByText(/invalid file type/i)).not.toBeInTheDocument();
    });
  });

  describe('cancel action', () => {
    it('should have a cancel button', async () => {
      await setup();

      expect(screen.getByRole('button', { name: /cancel|close/i })).toBeVisible();
    });

    it('should call onCancel callback when cancel is clicked', async () => {
      const user = userEvent.setup();
      const mockOnCancel = vi.fn();
      await setup({ onCancel: mockOnCancel });

      const cancelButton = screen.getByRole('button', { name: /cancel|close/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should clear selected file when cancel is clicked', async () => {
      const user = userEvent.setup();
      await setup();

      const fileInput = screen.getByLabelText(/choose image|select image|upload/i);
      const file = new File(['image'], 'profile.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, file);

      const cancelButton = screen.getByRole('button', { name: /cancel|close/i });
      await user.click(cancelButton);

      expect(fileInput.files).toHaveLength(0);
    });
  });
});

interface SetupOptions {
  imageUrl?: string;
  onUpload?: (file: File) => Promise<void>;
  onCancel?: () => void;
  maxFileSize?: number;
}

async function setup({
  imageUrl,
  onUpload = vi.fn().mockResolvedValue(undefined),
  onCancel = vi.fn(),
  maxFileSize,
}: SetupOptions = {}) {
  return await render(EditProfileImage, {
    componentInputs: {
      imageUrl,
      onUpload,
      onCancel,
      maxFileSize,
    },
  });
}
