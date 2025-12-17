/**
 * Crop data describing the crop box coordinates in pixels.
 * Received from the frontend image cropper and used to process uploaded images.
 *
 * IMPORTANT: This interface must match members/src/app/types/crop-data.ts exactly.
 * The frontend sends these coordinates after user crops their image.
 * Any changes here must be synchronized with the frontend type definition.
 *
 * @see members/src/app/types/crop-data.ts
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
  const width = data["width"];
  const height = data["height"];

  return (
    typeof x === "number" &&
    x >= 0 &&
    typeof y === "number" &&
    y >= 0 &&
    typeof width === "number" &&
    width > 0 &&
    typeof height === "number" &&
    height > 0
  );
}
