import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageCropper, type CropResult } from './image-cropper';

// Mock the cropperjs module to prevent actual Web Component registration
vi.mock('cropperjs', () => ({}));

// Mock custom elements for Cropper.js v2 Web Components
class MockCropperCanvas extends HTMLElement {}
class MockCropperImage extends HTMLElement {}
class MockCropperShade extends HTMLElement {}
class MockCropperHandle extends HTMLElement {}
class MockCropperGrid extends HTMLElement {}
class MockCropperCrosshair extends HTMLElement {}

class MockCropperSelection extends HTMLElement {
  x = 100;
  y = 100;
  width = 300;
  height = 300;

  $toCanvas = vi.fn(() => ({
    toDataURL: vi.fn(() => 'data:image/jpeg;base64,mock'),
  }));
}

// Register mock custom elements before tests
beforeAll(() => {
  if (!customElements.get('cropper-canvas')) {
    customElements.define('cropper-canvas', MockCropperCanvas);
  }
  if (!customElements.get('cropper-image')) {
    customElements.define('cropper-image', MockCropperImage);
  }
  if (!customElements.get('cropper-shade')) {
    customElements.define('cropper-shade', MockCropperShade);
  }
  if (!customElements.get('cropper-handle')) {
    customElements.define('cropper-handle', MockCropperHandle);
  }
  if (!customElements.get('cropper-selection')) {
    customElements.define('cropper-selection', MockCropperSelection);
  }
  if (!customElements.get('cropper-grid')) {
    customElements.define('cropper-grid', MockCropperGrid);
  }
  if (!customElements.get('cropper-crosshair')) {
    customElements.define('cropper-crosshair', MockCropperCrosshair);
  }
});

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
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const user = userEvent.setup();

  return {
    user,
    onCropConfirmed,
    onCancelled,
    sourceImage,
    container: renderResult.container,
    unmount: renderResult.fixture.destroy.bind(renderResult.fixture),
  };
}

describe('ImageCropper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
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
      const { user, onCropConfirmed, sourceImage, container } = await setup();

      // Wait for image to load and cropper to render
      await waitFor(() => {
        expect(container.querySelector('cropper-selection')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /save photo/i }));

      expect(onCropConfirmed).toHaveBeenCalledOnce();
      const result = onCropConfirmed.mock.calls[0]?.[0] as CropResult;
      expect(result.file).toBe(sourceImage);
      expect(result.cropData.x).toBe(100);
      expect(result.cropData.y).toBe(100);
      expect(result.cropData.width).toBe(300);
      expect(result.cropData.height).toBe(300);
    });

    it('should round pixel values', async () => {
      const { user, onCropConfirmed, container } = await setup();

      // Wait for cropper to render
      await waitFor(() => {
        expect(container.querySelector('cropper-selection')).toBeInTheDocument();
      });

      // Mock selection with decimal values
      const selection = container.querySelector('cropper-selection') as MockCropperSelection;
      Object.defineProperties(selection, {
        x: { value: 100.7, writable: true },
        y: { value: 200.3, writable: true },
        width: { value: 299.8, writable: true },
        height: { value: 301.2, writable: true },
      });

      await user.click(screen.getByRole('button', { name: /save photo/i }));

      const result = onCropConfirmed.mock.calls[0]?.[0] as CropResult;
      expect(result.cropData.x).toBe(101);
      expect(result.cropData.y).toBe(200);
      expect(result.cropData.width).toBe(300);
      expect(result.cropData.height).toBe(301);
    });

    it('should include preview data URL in result', async () => {
      const { user, onCropConfirmed, container } = await setup();

      // Wait for cropper to render
      await waitFor(() => {
        expect(container.querySelector('cropper-selection')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /save photo/i }));

      const result = onCropConfirmed.mock.calls[0]?.[0] as CropResult;
      expect(result.previewDataUrl).toBe('data:image/jpeg;base64,mock');
    });

    it('should call $toCanvas with correct dimensions', async () => {
      const { user, container } = await setup();

      // Wait for cropper to render
      await waitFor(() => {
        expect(container.querySelector('cropper-selection')).toBeInTheDocument();
      });

      const selection = container.querySelector('cropper-selection') as MockCropperSelection;

      await user.click(screen.getByRole('button', { name: /save photo/i }));

      expect(selection.$toCanvas).toHaveBeenCalledWith({
        width: 1200,
        height: 1200,
      });
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
