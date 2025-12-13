import { describe, expect, it } from "bun:test";
import { validateCropData } from "./crop-data.js";

describe("validateCropData", () => {
  describe("valid inputs", () => {
    it("should return true for valid crop data at center", () => {
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: 1 })).toBe(true);
    });

    it("should return true for valid crop data at top-left corner", () => {
      expect(validateCropData({ x: 0, y: 0, zoom: 1 })).toBe(true);
    });

    it("should return true for valid crop data at bottom-right corner", () => {
      expect(validateCropData({ x: 1, y: 1, zoom: 1 })).toBe(true);
    });

    it("should return true for maximum zoom", () => {
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: 10 })).toBe(true);
    });

    it("should return true for various zoom levels", () => {
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: 1.5 })).toBe(true);
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: 2 })).toBe(true);
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: 5 })).toBe(true);
    });

    it("should return true for boundary values", () => {
      expect(validateCropData({ x: 0, y: 0, zoom: 1 })).toBe(true);
      expect(validateCropData({ x: 1, y: 1, zoom: 10 })).toBe(true);
    });
  });

  describe("invalid x values", () => {
    it("should return false when x is negative", () => {
      expect(validateCropData({ x: -0.1, y: 0.5, zoom: 1 })).toBe(false);
      expect(validateCropData({ x: -1, y: 0.5, zoom: 1 })).toBe(false);
    });

    it("should return false when x is greater than 1", () => {
      expect(validateCropData({ x: 1.1, y: 0.5, zoom: 1 })).toBe(false);
      expect(validateCropData({ x: 2, y: 0.5, zoom: 1 })).toBe(false);
    });

    it("should return false when x is not a number", () => {
      expect(validateCropData({ x: "0.5", y: 0.5, zoom: 1 })).toBe(false);
      // eslint-disable-next-line unicorn/no-null -- testing null handling
      expect(validateCropData({ x: null, y: 0.5, zoom: 1 })).toBe(false);
      expect(validateCropData({ x: undefined, y: 0.5, zoom: 1 })).toBe(false);
    });
  });

  describe("invalid y values", () => {
    it("should return false when y is negative", () => {
      expect(validateCropData({ x: 0.5, y: -0.1, zoom: 1 })).toBe(false);
      expect(validateCropData({ x: 0.5, y: -1, zoom: 1 })).toBe(false);
    });

    it("should return false when y is greater than 1", () => {
      expect(validateCropData({ x: 0.5, y: 1.1, zoom: 1 })).toBe(false);
      expect(validateCropData({ x: 0.5, y: 2, zoom: 1 })).toBe(false);
    });

    it("should return false when y is not a number", () => {
      expect(validateCropData({ x: 0.5, y: "0.5", zoom: 1 })).toBe(false);
      // eslint-disable-next-line unicorn/no-null -- testing null handling
      expect(validateCropData({ x: 0.5, y: null, zoom: 1 })).toBe(false);
      expect(validateCropData({ x: 0.5, y: undefined, zoom: 1 })).toBe(false);
    });
  });

  describe("invalid zoom values", () => {
    it("should return false when zoom is less than 1", () => {
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: 0.5 })).toBe(false);
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: 0 })).toBe(false);
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: 0.999 })).toBe(false);
    });

    it("should return false when zoom is greater than 10", () => {
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: 10.1 })).toBe(false);
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: 11 })).toBe(false);
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: 100 })).toBe(false);
    });

    it("should return false when zoom is negative", () => {
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: -1 })).toBe(false);
    });

    it("should return false when zoom is not a number", () => {
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: "1" })).toBe(false);
      // eslint-disable-next-line unicorn/no-null -- testing null handling
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: null })).toBe(false);
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: undefined })).toBe(false);
    });
  });

  describe("non-object inputs", () => {
    it("should return false for null", () => {
      // eslint-disable-next-line unicorn/no-null -- testing null handling
      expect(validateCropData(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(validateCropData(undefined)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(validateCropData("crop")).toBe(false);
      expect(validateCropData(42)).toBe(false);
      expect(validateCropData(true)).toBe(false);
    });

    it("should return false for arrays", () => {
      expect(validateCropData([0.5, 0.5, 1])).toBe(false);
    });
  });

  describe("objects with missing properties", () => {
    it("should return false when x is missing", () => {
      expect(validateCropData({ y: 0.5, zoom: 1 })).toBe(false);
    });

    it("should return false when y is missing", () => {
      expect(validateCropData({ x: 0.5, zoom: 1 })).toBe(false);
    });

    it("should return false when zoom is missing", () => {
      expect(validateCropData({ x: 0.5, y: 0.5 })).toBe(false);
    });

    it("should return false for empty object", () => {
      expect(validateCropData({})).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should return false for NaN values", () => {
      expect(validateCropData({ x: Number.NaN, y: 0.5, zoom: 1 })).toBe(false);
      expect(validateCropData({ x: 0.5, y: Number.NaN, zoom: 1 })).toBe(false);
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: Number.NaN })).toBe(false);
    });

    it("should return false for Infinity values", () => {
      expect(validateCropData({ x: Infinity, y: 0.5, zoom: 1 })).toBe(false);
      expect(validateCropData({ x: 0.5, y: Infinity, zoom: 1 })).toBe(false);
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: Infinity })).toBe(false);
    });

    it("should return false for -Infinity values", () => {
      expect(validateCropData({ x: -Infinity, y: 0.5, zoom: 1 })).toBe(false);
      expect(validateCropData({ x: 0.5, y: -Infinity, zoom: 1 })).toBe(false);
      expect(validateCropData({ x: 0.5, y: 0.5, zoom: -Infinity })).toBe(false);
    });

    it("should allow extra properties on the object", () => {
      expect(
        validateCropData({ x: 0.5, y: 0.5, zoom: 1, extra: "ignored" }),
      ).toBe(true);
    });
  });
});
