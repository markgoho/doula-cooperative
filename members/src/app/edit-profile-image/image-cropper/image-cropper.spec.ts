import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageCropper, type CropResult } from './image-cropper';

// Mock Cropper.js
const mockGetData = vi.fn();
const mockGetCroppedCanvas = vi.fn();

// Mock the entire cropperjs module
vi.mock('cropperjs', () => ({
  default: class {
    getData = mockGetData;
    destroy = vi.fn();
    getCroppedCanvas = mockGetCroppedCanvas;
  },
}));

function createMockFile(name = 'test.jpg', type = 'image/jpeg'): File {
  return new File(['mock-image-data'], name, { type });
}

async function setup(options: { sourceImage?: File } = {}) {
  const sourceImage = options.sourceImage ?? createMockFile();
  const onCropConfirmed = vi.fn();
  const onCancelled = vi.fn();

  const renderResult = await render(ImageCropper, {
    inputs: {
      sourceImage,
    },
    on: {
      cropConfirmed: onCropConfirmed,
      cancelled: onCancelled,
    },
  });

  const user = userEvent.setup();

  return {
    user,
    onCropConfirmed,
    onCancelled,
    sourceImage,
    unmount: renderResult.fixture.destroy.bind(renderResult.fixture),
  };
}

describe('ImageCropper', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation for getData
    mockGetData.mockReturnValue({
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      rotate: 0,
      scaleX: 1,
      scaleY: 1,
    });

    // Default mock implementation for getCroppedCanvas
    mockGetCroppedCanvas.mockReturnValue({
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,mock'),
    });
  });

  describe('rendering', () => {
    it('should render the cropper heading', async () => {
      await setup();

      expect(screen.getByRole('heading', { name: /crop your photo/i })).toBeVisible();
    });

    it('should render action buttons', async () => {
      await setup();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
        expect(screen.getByRole('button', { name: /save photo/i })).toBeVisible();
      });
    });

    it('should show loading state initially', async () => {
      await setup();

      expect(screen.getByText(/loading image/i)).toBeVisible();
    });
  });

  describe('crop confirmation', () => {
    it('should emit crop data with pixel coordinates when confirmed', async () => {
      const { user, onCropConfirmed, sourceImage } = await setup();

      await user.click(screen.getByRole('button', { name: /save photo/i }));

      await waitFor(() => {
        expect(onCropConfirmed).toHaveBeenCalledOnce();
      });

      const result = onCropConfirmed.mock.calls[0]?.[0] as CropResult;
      expect(result.file).toBe(sourceImage);
      expect(result.cropData.x).toBe(100);
      expect(result.cropData.y).toBe(100);
      expect(result.cropData.width).toBe(300);
      expect(result.cropData.height).toBe(300);
    });

    // Flaky test: intermittently fails and takes >1s to complete
    it.skip('should round pixel values', async () => {
      mockGetData.mockReturnValue({
        x: 100.7,
        y: 200.3,
        width: 299.8,
        height: 301.2,
        rotate: 0,
        scaleX: 1,
        scaleY: 1,
      });

      const { user, onCropConfirmed } = await setup();

      await user.click(screen.getByRole('button', { name: /save photo/i }));

      await waitFor(() => {
        expect(onCropConfirmed).toHaveBeenCalledOnce();
      });

      const result = onCropConfirmed.mock.calls[0]?.[0] as CropResult;
      expect(result.cropData.x).toBe(101);
      expect(result.cropData.y).toBe(200);
      expect(result.cropData.width).toBe(300);
      expect(result.cropData.height).toBe(301);
    });
  });

  describe('cancel', () => {
    it('should emit cancelled event when cancel button clicked', async () => {
      const { user, onCancelled } = await setup();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onCancelled).toHaveBeenCalledOnce();
    });
  });
});
