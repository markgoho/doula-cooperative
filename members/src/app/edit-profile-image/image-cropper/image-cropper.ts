import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { type CropData } from '../../types/crop-data';

// Re-export for consumers
export type { CropData } from '../../types/crop-data';

export interface CropResult {
  file: File;
  cropData: CropData;
}

/**
 * Accessible image cropper component using CSS-based preview.
 * Uses object-fit/object-position for visual cropping with
 * keyboard-accessible controls for positioning and zoom.
 */
@Component({
  selector: 'app-image-cropper',
  imports: [DecimalPipe],
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

  /** X position (0-1) - center of crop area */
  protected readonly posX = signal(0.5);

  /** Y position (0-1) - center of crop area */
  protected readonly posY = signal(0.5);

  /** Zoom level (minimum 1.0 = no zoom; backend maximum 10) */
  protected readonly zoom = signal(1);

  /** Data URL for preview */
  protected readonly imageUrl = signal<string | undefined>(undefined);

  /** Image natural dimensions */
  protected readonly imageWidth = signal(0);
  protected readonly imageHeight = signal(0);

  /** Drag state */
  protected readonly isDragging = signal(false);
  private dragStartX = 0;
  private dragStartY = 0;
  private startPosX = 0;
  private startPosY = 0;

  /** Position step for arrow buttons (percentage of image) */
  private readonly POSITION_STEP = 0.05;

  /** Sensitivity for drag (lower = more sensitive) */
  private readonly DRAG_SENSITIVITY = 300;

  /** Computed transform style combining position and zoom */
  protected readonly transformStyle = computed(() => {
    const zoom = this.zoom();
    // Convert 0-1 position to translate percentages
    // At pos 0.5, no translation (centered)
    // At pos 0, translate +50% (show left/top edge)
    // At pos 1, translate -50% (show right/bottom edge)
    const translateX = (0.5 - this.posX()) * 100;
    const translateY = (0.5 - this.posY()) * 100;
    return `scale(${zoom}) translate(${translateX}%, ${translateY}%)`;
  });

  /** Computed crop data for output */
  protected readonly cropData = computed<CropData>(() => ({
    x: this.posX(),
    y: this.posY(),
    zoom: this.zoom(),
  }));

  constructor() {
    // Load image when source changes
    effect(() => {
      const file = this.sourceImage();
      this.loadImage(file);
    });
  }

  /** Signal for image loading error state */
  protected readonly imageLoadError = signal<string | undefined>(undefined);

  private loadImage(file: File): void {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      const url = reader.result as string;
      this.imageUrl.set(url);
      this.imageLoadError.set(undefined);

      // Get image dimensions
      const img = new Image();
      img.addEventListener('load', () => {
        this.imageWidth.set(img.naturalWidth);
        this.imageHeight.set(img.naturalHeight);
      });
      img.addEventListener('error', () => {
        console.error('Failed to decode image as Image element');
        this.imageLoadError.set('Unable to load image. The file may be corrupted.');
      });
      img.src = url;
    });

    reader.addEventListener('error', () => {
      console.error('FileReader failed to read file:', reader.error);
      this.imageLoadError.set('Unable to read image file. Please try again.');
    });

    reader.readAsDataURL(file);
  }

  /** Shifts the visible crop region upward on the image */
  protected moveUp(): void {
    this.posY.update(y => Math.min(1, y + this.POSITION_STEP));
  }

  /** Shifts the visible crop region downward on the image */
  protected moveDown(): void {
    this.posY.update(y => Math.max(0, y - this.POSITION_STEP));
  }

  /** Shifts the visible crop region leftward on the image */
  protected moveLeft(): void {
    this.posX.update(x => Math.min(1, x + this.POSITION_STEP));
  }

  /** Shifts the visible crop region rightward on the image */
  protected moveRight(): void {
    this.posX.update(x => Math.max(0, x - this.POSITION_STEP));
  }

  /** Center the crop area */
  protected centerPosition(): void {
    this.posX.set(0.5);
    this.posY.set(0.5);
  }

  /** Update zoom from slider */
  protected onZoomChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.zoom.set(Number.parseFloat(input.value));
  }

  /** Confirm crop and emit result */
  protected confirm(): void {
    this.cropConfirmed.emit({
      file: this.sourceImage(),
      cropData: this.cropData(),
    });
  }

  /** Cancel crop and emit event */
  protected cancel(): void {
    this.cancelled.emit();
  }

  /** Handle keyboard navigation in preview area */
  protected onPreviewKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowUp': {
        event.preventDefault();
        this.moveUp();
        break;
      }
      case 'ArrowDown': {
        event.preventDefault();
        this.moveDown();
        break;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        this.moveLeft();
        break;
      }
      case 'ArrowRight': {
        event.preventDefault();
        this.moveRight();
        break;
      }
    }
  }

  /** Start dragging (mouse) */
  protected onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.startDrag(event.clientX, event.clientY);

    // Add global listeners for mouse move/up
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  /** Handle mouse move during drag */
  private onMouseMove = (event: MouseEvent): void => {
    if (!this.isDragging()) return;
    this.updateDragPosition(event.clientX, event.clientY);
  };

  /** End mouse drag */
  private onMouseUp = (): void => {
    this.endDrag();
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  };

  /** Start dragging (touch) */
  protected onTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    if (!touch || event.touches.length !== 1) return;
    this.startDrag(touch.clientX, touch.clientY);
  }

  /** Handle touch move during drag */
  protected onTouchMove(event: TouchEvent): void {
    const touch = event.touches[0];
    if (!touch || !this.isDragging() || event.touches.length !== 1) return;
    event.preventDefault(); // Prevent scrolling while dragging
    this.updateDragPosition(touch.clientX, touch.clientY);
  }

  /** End touch drag */
  protected onTouchEnd(): void {
    this.endDrag();
  }

  /** Common drag start logic */
  private startDrag(clientX: number, clientY: number): void {
    this.isDragging.set(true);
    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.startPosX = this.posX();
    this.startPosY = this.posY();
  }

  /** Common drag position update logic */
  private updateDragPosition(clientX: number, clientY: number): void {
    const deltaX = (clientX - this.dragStartX) / this.DRAG_SENSITIVITY;
    const deltaY = (clientY - this.dragStartY) / this.DRAG_SENSITIVITY;

    // Invert deltas: dragging up (negative deltaY) should increase posY
    const newX = Math.max(0, Math.min(1, this.startPosX - deltaX));
    const newY = Math.max(0, Math.min(1, this.startPosY - deltaY));

    this.posX.set(newX);
    this.posY.set(newY);
  }

  /** Common drag end logic */
  private endDrag(): void {
    this.isDragging.set(false);
  }
}
