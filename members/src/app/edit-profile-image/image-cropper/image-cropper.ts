import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import 'cropperjs';
import { type CropData } from '../../types/crop-data';

// Re-export for consumers
export type { CropData } from '../../types/crop-data';

export interface CropResult {
  file: File;
  cropData: CropData;
  previewDataUrl?: string;
}

interface CropperSelection extends HTMLElement {
  x: number;
  y: number;
  width: number;
  height: number;
  $toCanvas(options?: { width?: number; height?: number }): HTMLCanvasElement | null;
}

/**
 * Image cropper component using Cropper.js v2 Web Components library.
 * Provides a draggable/resizable square crop box over an image.
 */
@Component({
  selector: 'app-image-cropper',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './image-cropper.html',
  styleUrl: './image-cropper.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageCropper {
  /** The source image file to crop */
  readonly sourceImage = input.required<File>();

  /** Emitted when user confirms the crop */
  readonly cropConfirmed = output<CropResult>();

  /** Emitted when user cancels the crop */
  readonly cancelled = output<void>();

  /** Template reference to the cropper selection element */
  private readonly selectionElement = viewChild<ElementRef<CropperSelection>>('cropperSelection');

  /** Data URL for the image */
  protected readonly imageUrl = signal<string | undefined>(undefined);

  /** Signal for image loading error state */
  protected readonly imageLoadError = signal<string | undefined>(undefined);

  /** Calculated canvas width based on image aspect ratio */
  protected readonly canvasWidth = signal<number | undefined>(undefined);

  constructor() {
    effect(() => {
      const file = this.sourceImage();
      this.loadImage(file);
    });
  }

  private readonly CANVAS_HEIGHT = 600;

  private loadImage(file: File): void {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      const dataUrl = reader.result as string;

      // Load image to get dimensions and calculate canvas width
      const img = new Image();
      img.addEventListener('load', () => {
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        const calculatedWidth = Math.round(this.CANVAS_HEIGHT * aspectRatio);
        this.canvasWidth.set(calculatedWidth);
        this.imageUrl.set(dataUrl);
        this.imageLoadError.set(undefined);
      });
      img.addEventListener('error', () => {
        this.imageLoadError.set('Unable to load image. Please try again.');
      });
      img.src = dataUrl;
    });

    reader.addEventListener('error', () => {
      console.error('FileReader failed to read file:', reader.error);
      this.imageLoadError.set('Unable to read image file. Please try again.');
    });

    reader.readAsDataURL(file);
  }

  /** Confirm crop and emit result */
  protected confirm(): void {
    const selection = this.selectionElement()?.nativeElement;
    if (!selection) {
      console.error('Cropper selection not available');
      return;
    }

    const cropData = {
      x: Math.round(selection.x),
      y: Math.round(selection.y),
      width: Math.round(selection.width),
      height: Math.round(selection.height),
    };

    const croppedCanvas = selection.$toCanvas({
      width: 1200,
      height: 1200,
    });

    const previewDataUrl = croppedCanvas?.toDataURL('image/jpeg', 0.9);

    const result: CropResult = {
      file: this.sourceImage(),
      cropData,
    };

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
