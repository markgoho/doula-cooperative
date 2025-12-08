import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImageCropper, type CropResult } from './image-cropper';

function createMockFile(name = 'test.jpg', type = 'image/jpeg'): File {
  return new File(['mock-image-data'], name, { type });
}

async function setup(options: { sourceImage?: File } = {}) {
  const sourceImage = options.sourceImage ?? createMockFile();
  const onCropConfirmed = vi.fn();
  const onCancelled = vi.fn();

  await render(ImageCropper, {
    inputs: {
      sourceImage,
    },
    on: {
      cropConfirmed: onCropConfirmed,
      cancelled: onCancelled,
    },
  });

  const user = userEvent.setup();

  return { user, onCropConfirmed, onCancelled, sourceImage };
}

describe('ImageCropper', () => {
  describe('rendering', () => {
    it('should render the cropper heading', async () => {
      await setup();

      expect(screen.getByRole('heading', { name: /crop your photo/i })).toBeVisible();
    });

    it('should render position controls', async () => {
      await setup();

      expect(screen.getByRole('button', { name: /move image up/i })).toBeVisible();
      expect(screen.getByRole('button', { name: /move image down/i })).toBeVisible();
      expect(screen.getByRole('button', { name: /move image left/i })).toBeVisible();
      expect(screen.getByRole('button', { name: /move image right/i })).toBeVisible();
      expect(screen.getByRole('button', { name: /center image/i })).toBeVisible();
    });

    it('should render zoom slider', async () => {
      await setup();

      expect(screen.getByRole('slider')).toBeVisible();
    });

    it('should render action buttons', async () => {
      await setup();

      expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
      expect(screen.getByRole('button', { name: /save photo/i })).toBeVisible();
    });
  });

  describe('position controls', () => {
    it('should emit crop data with default center position when confirmed immediately', async () => {
      const { user, onCropConfirmed, sourceImage } = await setup();

      await user.click(screen.getByRole('button', { name: /save photo/i }));

      expect(onCropConfirmed).toHaveBeenCalledOnce();
      const calls = onCropConfirmed.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const result = calls[0]?.[0] as CropResult | undefined;
      expect(result).toBeDefined();
      expect(result?.file).toBe(sourceImage);
      expect(result?.cropData.x).toBe(0.5);
      expect(result?.cropData.y).toBe(0.5);
      expect(result?.cropData.zoom).toBe(1);
    });
  });

  describe('cancel', () => {
    it('should emit cancelled event when cancel is clicked', async () => {
      const { user, onCancelled } = await setup();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onCancelled).toHaveBeenCalledOnce();
    });
  });
});
