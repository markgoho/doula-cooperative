/**
 * Crop data describing how to crop an image.
 * All position values are normalized to 0-1 range.
 *
 * NOTE: This type is also defined in functions/src/types/crop-data.ts for the backend.
 * Keep them in sync when making changes.
 */
export interface CropData {
  /** X position of crop center (0-1 range) */
  x: number;
  /** Y position of crop center (0-1 range) */
  y: number;
  /** Zoom level (1.0 = no zoom, 2.0 = 2x zoom, backend max = 10, frontend max = 3) */
  zoom: number;
}
