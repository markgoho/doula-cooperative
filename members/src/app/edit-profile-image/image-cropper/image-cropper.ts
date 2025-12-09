import {
  type AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  type OnDestroy,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import Cropper from 'cropperjs';
import { type CropData } from '../../types/crop-data';

// Re-export for consumers
export type { CropData } from '../../types/crop-data';

export interface CropResult {
  file: File;
  cropData: CropData;
  previewDataUrl?: string;
}

/**
 * Image cropper component using Cropper.js library.
 * Provides a draggable/resizable square crop box over an image.
 */
@Component({
  selector: 'app-image-cropper',
  imports: [],
  templateUrl: './image-cropper.html',
  styleUrl: './image-cropper.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageCropper implements AfterViewInit, OnDestroy {
  /** The source image file to crop */
  readonly sourceImage = input.required<File>();

  /** Emitted when user confirms the crop */
  readonly cropConfirmed = output<CropResult>();

  /** Emitted when user cancels the crop */
  readonly cancelled = output<void>();

  /** Template reference to the image element */
  private readonly imageElement = viewChild<ElementRef<HTMLImageElement>>('cropperImage');

  /** Cropper.js instance */
  private cropperInstance: Cropper | undefined;

  /** Data URL for preview */
  protected readonly imageUrl = signal<string | undefined>(undefined);

  /** Signal for image loading error state */
  protected readonly imageLoadError = signal<string | undefined>(undefined);

  constructor() {
    // Load image when source changes
    effect(() => {
      const file = this.sourceImage();
      this.loadImage(file);
    });

    // Initialize cropper when both image is loaded AND view is ready
    effect(() => {
      const url = this.imageUrl();
      const element = this.imageElement();
      if (url && element) {
        this.initializeCropper();
      }
    });
  }

  ngAfterViewInit() {
    // Initialize Cropper.js after view is ready
    // The image must be loaded (imageUrl set) and the view must be ready (imageElement available)
    const url = this.imageUrl();
    const element = this.imageElement();
    if (url && element) {
      this.initializeCropper();
    }
  }

  ngOnDestroy() {
    // Clean up Cropper instance
    this.cropperInstance?.destroy();
  }

  private loadImage(file: File): void {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      const url = reader.result as string;
      this.imageUrl.set(url);
      this.imageLoadError.set(undefined);

      // Cropper will be initialized in ngAfterViewInit when view is ready
    });

    reader.addEventListener('error', () => {
      console.error('FileReader failed to read file:', reader.error);
      this.imageLoadError.set('Unable to read image file. Please try again.');
    });

    reader.readAsDataURL(file);
  }

  private initializeCropper(): void {
    // Destroy existing instance if any
    this.cropperInstance?.destroy();

    const element = this.imageElement();
    if (!element) {
      console.error('Cannot initialize cropper: image element not available');
      return;
    }

    const imgElement = element.nativeElement;

    this.cropperInstance = new Cropper(imgElement, {
      aspectRatio: 1, // Square crop box
      viewMode: 1, // Restrict crop box to within the canvas
      cropBoxResizable: true,
      cropBoxMovable: true,
      zoomable: false, // Disable zoom
      dragMode: 'move', // Drag to move the image
      minContainerWidth: 350,
      minContainerHeight: 350,
      autoCropArea: 0.8, // Start with crop box at 80% of image
      background: true,
      modal: true,
      guides: true,
      center: true,
      highlight: true,
      responsive: true,
      restore: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cropper.js v1.6.2 types are incomplete
    } as any);
  }

  /** Confirm crop and emit result */
  protected confirm(): void {
    if (!this.cropperInstance) {
      console.error('Cropper instance not initialized');
      return;
    }

    // Get crop data with rounded pixel values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cropper.js types are incomplete
    const cropData = (this.cropperInstance as any).getData(true);

    // Get cropped canvas for preview (1200x1200 to match backend output)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cropper.js types are incomplete
    const croppedCanvas: HTMLCanvasElement | null = (this.cropperInstance as any).getCroppedCanvas({
      width: 1200,
      height: 1200,
    });

    // Convert canvas to data URL for optimistic preview
    const previewDataUrl = croppedCanvas?.toDataURL('image/jpeg', 0.9);

    const result: CropResult = {
      file: this.sourceImage(),
      cropData: {
        x: Math.round(cropData.x),
        y: Math.round(cropData.y),
        width: Math.round(cropData.width),
        height: Math.round(cropData.height),
      },
    };

    // Only include previewDataUrl if it exists (exactOptionalPropertyTypes requirement)
    if (previewDataUrl) {
      result.previewDataUrl = previewDataUrl;
    }

    this.cropConfirmed.emit(result);
  }

  /** Cancel crop and emit event */
  protected cancel(): void {
    this.cancelled.emit();
  }
}
