import { describe, expect, it } from "bun:test";
import type { ProfileData } from "../schemas/profile-schemas.js";
import {
  parseExistingMetadata,
  serializeToMarkdown,
} from "./markdown-serialization.js";

const minimalProfile: ProfileData = {
  title: "Test Doula",
  bio: "A short bio for testing.",
};

const fullProfile: ProfileData = {
  title: "Jane Doe",
  bio: "An experienced doula serving the Rochester area.",
  credentials: "CD(DONA)",
  pronouns: "she/her",
  tags: ["Birth Doula", "Postpartum Doula"],
  contact: {
    email: "jane@example.com",
    phone: "585-555-0123",
    website: "https://janedoula.com",
    business_name: "Jane's Doula Services",
  },
};

describe("serializeToMarkdown", () => {
  describe("date field format", () => {
    it("should produce a date field in YYYY-MM-DD format when given an ISO string", () => {
      const metadata = {
        date: "2026-02-15T19:13:59.721Z",
        createdAt: "2026-02-15T19:13:59.721Z",
        updatedAt: "2026-02-15T19:13:59.721Z",
        draft: true,
      };

      const result = serializeToMarkdown(minimalProfile, metadata);

      expect(result).toMatch(/^date: \d{4}-\d{2}-\d{2}$/m);
    });

    it("should not include time or milliseconds in the date field", () => {
      const metadata = {
        date: "2026-02-15T19:13:59.721Z",
        createdAt: "2026-02-15T19:13:59.721Z",
        updatedAt: "2026-02-15T19:13:59.721Z",
      };

      const result = serializeToMarkdown(minimalProfile, metadata);

      const dateLine = result.split("\n").find(l => l.startsWith("date:"));
      expect(dateLine).toBeDefined();
      expect(dateLine).not.toContain("T");
      expect(dateLine).not.toContain("Z");
      expect(dateLine).not.toContain(".721");
    });

    it("should not quote the date value in YAML output", () => {
      const metadata = {
        date: "2026-02-15T19:13:59.721Z",
        createdAt: "2026-02-15T19:13:59.721Z",
        updatedAt: "2026-02-15T19:13:59.721Z",
      };

      const result = serializeToMarkdown(minimalProfile, metadata);

      const dateLine = result.split("\n").find(l => l.startsWith("date:"));
      expect(dateLine).toBeDefined();
      expect(dateLine).not.toContain("'");
      expect(dateLine).not.toContain('"');
    });

    it("should preserve a date-only string as-is", () => {
      const metadata = {
        date: "2021-06-16",
        createdAt: "2021-06-16T13:44:54Z",
        updatedAt: "2022-12-13T21:00:01Z",
      };

      const result = serializeToMarkdown(minimalProfile, metadata);

      expect(result).toMatch(/^date: 2021-06-16$/m);
    });
  });

  describe("front matter structure", () => {
    it("should wrap content in YAML front matter delimiters", () => {
      const result = serializeToMarkdown(minimalProfile);

      expect(result.startsWith("---\n")).toBe(true);
      expect(result).toContain("\n---\n");
    });

    it("should include title and type fields", () => {
      const result = serializeToMarkdown(minimalProfile);

      expect(result).toMatch(/^title: Test Doula$/m);
      expect(result).toMatch(/^type: doulas$/m);
    });

    it("should include bio in markdown body after front matter", () => {
      const result = serializeToMarkdown(minimalProfile);

      const parts = result.split("---");
      const body = parts[2]?.trim();
      expect(body).toBe("A short bio for testing.");
    });

    it("should include all profile fields for a full profile", () => {
      const result = serializeToMarkdown(fullProfile);

      expect(result).toMatch(/^title: Jane Doe$/m);
      expect(result).toMatch(/^credentials: CD\(DONA\)$/m);
      expect(result).toMatch(/^pronouns: she\/her$/m);
      expect(result).toContain("Birth Doula");
      expect(result).toContain("Postpartum Doula");
      expect(result).toContain("jane@example.com");
      expect(result).toContain("585-555-0123");
      expect(result).toContain("janedoula.com");
      expect(result).not.toMatch(/website:.*https?:\/\//);
    });

    it("should include draft field when provided in metadata", () => {
      const metadata = {
        date: "2026-02-15",
        draft: true,
      };

      const result = serializeToMarkdown(minimalProfile, metadata);

      expect(result).toMatch(/^draft: true$/m);
    });
  });
});

describe("parseExistingMetadata", () => {
  it("should parse date, createdAt, and updatedAt from front matter", () => {
    const content = `---
title: Test Doula
date: 2021-06-16
createdAt: 2021-06-16T13:44:54Z
updatedAt: 2022-12-13T21:00:01Z
type: doulas
---

Bio content here.
`;

    const metadata = parseExistingMetadata(content);

    expect(metadata.date).toBe("2021-06-16");
    expect(metadata.createdAt).toBe("2021-06-16T13:44:54Z");
    expect(metadata.updatedAt).toBe("2022-12-13T21:00:01Z");
  });

  it("should parse draft field", () => {
    const content = `---
title: Test Doula
draft: true
---

Bio.
`;

    const metadata = parseExistingMetadata(content);

    expect(metadata.draft).toBe(true);
  });

  it("should strip surrounding quotes from date values", () => {
    const content = `---
title: Test Doula
date: '2026-02-15T19:13:59.721Z'
createdAt: '2026-02-15T19:13:59.721Z'
updatedAt: '2026-02-15T19:13:59.721Z'
---

Bio.
`;

    const metadata = parseExistingMetadata(content);

    expect(metadata.date).not.toContain("'");
    expect(metadata.createdAt).not.toContain("'");
    expect(metadata.updatedAt).not.toContain("'");
  });

  it("should return empty object when no front matter found", () => {
    const content = "Just some text without front matter.";

    const metadata = parseExistingMetadata(content);

    expect(metadata).toEqual({});
  });
});
