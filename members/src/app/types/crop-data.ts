/**
 * Crop data describing the crop box coordinates in pixels.
 * Used by the image cropper component to specify the selected region.
 *
 * IMPORTANT: This interface must match functions/src/types/crop-data.ts exactly.
 * The backend validates and uses these coordinates to process the image.
 * Any changes here must be synchronized with the backend type definition.
 *
 * @see functions/src/types/crop-data.ts
 */
export interface CropData {
  /** Top-left X coordinate in pixels (must be >= 0) */
  x: number;
  /** Top-left Y coordinate in pixels (must be >= 0) */
  y: number;
  /** Crop box width in pixels (must be > 0) */
  width: number;
  /** Crop box height in pixels (must be > 0) */
  height: number;
}
