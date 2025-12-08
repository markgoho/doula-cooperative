/**
 * Crop data from client specifying how to crop the image.
 * All values are normalized to 0-1 range based on image dimensions.
 *
 * NOTE: This type is also defined in members/src/app/types/crop-data.ts for the frontend.
 * Keep them in sync when making changes.
 */
export interface CropData {
  /** X position of crop center (0-1 range) */
  x: number;
  /** Y position of crop center (0-1 range) */
  y: number;
  /** Zoom level (1.0 = no zoom, 2.0 = 2x zoom, max 10) */
  zoom: number;
}

/**
 * Validates crop data is within acceptable ranges.
 */
export function validateCropData(cropData: unknown): cropData is CropData {
  if (!cropData || typeof cropData !== "object") {
    return false;
  }

  const data = cropData as Record<string, unknown>;
  const x = data["x"];
  const y = data["y"];
  const zoom = data["zoom"];

  return (
    typeof x === "number" &&
    x >= 0 &&
    x <= 1 &&
    typeof y === "number" &&
    y >= 0 &&
    y <= 1 &&
    typeof zoom === "number" &&
    zoom >= 1 &&
    zoom <= 10
  );
}
