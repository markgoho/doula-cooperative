import { describe, expect, it } from "bun:test";
import { validateCropData } from "./crop-data.js";

/**
 * Tests for CropData validation.
 * CropData uses pixel-based coordinates: x, y, width, height.
 */
describe("validateCropData", () => {
  describe("valid inputs", () => {
    it("should return true for valid crop data with typical dimensions", () => {
      expect(validateCropData({ x: 100, y: 100, width: 200, height: 200 })).toBe(
        true,
      );
    });

    it("should return true for crop at origin", () => {
      expect(validateCropData({ x: 0, y: 0, width: 100, height: 100 })).toBe(
        true,
      );
    });

    it("should return true for small crop dimensions", () => {
      expect(validateCropData({ x: 0, y: 0, width: 1, height: 1 })).toBe(true);
    });

    it("should return true for large crop dimensions", () => {
      expect(
        validateCropData({ x: 0, y: 0, width: 5000, height: 5000 }),
      ).toBe(true);
    });

    it("should return true for various valid dimensions", () => {
      expect(validateCropData({ x: 50, y: 50, width: 150, height: 150 })).toBe(
        true,
      );
      expect(validateCropData({ x: 200, y: 300, width: 400, height: 500 })).toBe(
        true,
      );
      expect(
        validateCropData({ x: 1000, y: 1000, width: 2000, height: 2000 }),
      ).toBe(true);
    });

    it("should return true for boundary values", () => {
      expect(validateCropData({ x: 0, y: 0, width: 1, height: 1 })).toBe(true);
      expect(
        validateCropData({ x: 10_000, y: 10_000, width: 10_000, height: 10_000 }),
      ).toBe(true);
    });
  });

  describe("invalid x values", () => {
    it("should return false when x is negative", () => {
      expect(validateCropData({ x: -1, y: 0, width: 100, height: 100 })).toBe(
        false,
      );
      expect(validateCropData({ x: -100, y: 0, width: 100, height: 100 })).toBe(
        false,
      );
    });

    it("should return false when x is not a number", () => {
      expect(
        validateCropData({ x: "100", y: 0, width: 100, height: 100 }),
      ).toBe(false);
      // eslint-disable-next-line unicorn/no-null -- testing null handling
      expect(validateCropData({ x: null, y: 0, width: 100, height: 100 })).toBe(
        false,
      );
      expect(
        validateCropData({ x: undefined, y: 0, width: 100, height: 100 }),
      ).toBe(false);
    });
  });

  describe("invalid y values", () => {
    it("should return false when y is negative", () => {
      expect(validateCropData({ x: 0, y: -1, width: 100, height: 100 })).toBe(
        false,
      );
      expect(validateCropData({ x: 0, y: -100, width: 100, height: 100 })).toBe(
        false,
      );
    });

    it("should return false when y is not a number", () => {
      expect(
        validateCropData({ x: 0, y: "100", width: 100, height: 100 }),
      ).toBe(false);
      // eslint-disable-next-line unicorn/no-null -- testing null handling
      expect(validateCropData({ x: 0, y: null, width: 100, height: 100 })).toBe(
        false,
      );
      expect(
        validateCropData({ x: 0, y: undefined, width: 100, height: 100 }),
      ).toBe(false);
    });
  });

  describe("invalid width values", () => {
    it("should return false when width is zero", () => {
      expect(validateCropData({ x: 0, y: 0, width: 0, height: 100 })).toBe(
        false,
      );
    });

    it("should return false when width is negative", () => {
      expect(validateCropData({ x: 0, y: 0, width: -1, height: 100 })).toBe(
        false,
      );
      expect(validateCropData({ x: 0, y: 0, width: -100, height: 100 })).toBe(
        false,
      );
    });

    it("should return false when width is not a number", () => {
      expect(
        validateCropData({ x: 0, y: 0, width: "100", height: 100 }),
      ).toBe(false);
      // eslint-disable-next-line unicorn/no-null -- testing null handling
      expect(validateCropData({ x: 0, y: 0, width: null, height: 100 })).toBe(
        false,
      );
      expect(
        validateCropData({ x: 0, y: 0, width: undefined, height: 100 }),
      ).toBe(false);
    });
  });

  describe("invalid height values", () => {
    it("should return false when height is zero", () => {
      expect(validateCropData({ x: 0, y: 0, width: 100, height: 0 })).toBe(
        false,
      );
    });

    it("should return false when height is negative", () => {
      expect(validateCropData({ x: 0, y: 0, width: 100, height: -1 })).toBe(
        false,
      );
      expect(validateCropData({ x: 0, y: 0, width: 100, height: -100 })).toBe(
        false,
      );
    });

    it("should return false when height is not a number", () => {
      expect(
        validateCropData({ x: 0, y: 0, width: 100, height: "100" }),
      ).toBe(false);
      // eslint-disable-next-line unicorn/no-null -- testing null handling
      expect(validateCropData({ x: 0, y: 0, width: 100, height: null })).toBe(
        false,
      );
      expect(
        validateCropData({ x: 0, y: 0, width: 100, height: undefined }),
      ).toBe(false);
    });
  });

  describe("missing properties", () => {
    it("should return false when x is missing", () => {
      expect(validateCropData({ y: 0, width: 100, height: 100 })).toBe(false);
    });

    it("should return false when y is missing", () => {
      expect(validateCropData({ x: 0, width: 100, height: 100 })).toBe(false);
    });

    it("should return false when width is missing", () => {
      expect(validateCropData({ x: 0, y: 0, height: 100 })).toBe(false);
    });

    it("should return false when height is missing", () => {
      expect(validateCropData({ x: 0, y: 0, width: 100 })).toBe(false);
    });
  });

  describe("invalid input types", () => {
    it("should return false for non-object values", () => {
      expect(validateCropData("not an object")).toBe(false);
      expect(validateCropData(123)).toBe(false);
      expect(validateCropData(true)).toBe(false);
      // eslint-disable-next-line unicorn/no-null -- testing null handling
      expect(validateCropData(null)).toBe(false);
      expect(validateCropData(undefined)).toBe(false);
      expect(validateCropData([])).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should allow extra properties on the object", () => {
      expect(
        validateCropData({
          x: 100,
          y: 100,
          width: 200,
          height: 200,
          extra: "ignored",
        }),
      ).toBe(true);
    });

    it("should handle decimal pixel values", () => {
      expect(
        validateCropData({ x: 100.5, y: 100.5, width: 200.5, height: 200.5 }),
      ).toBe(true);
    });
  });
});
