import { expect } from "chai";
import { updateDoulaProfile } from "../src/index";
import fs from "fs/promises";
import path from "path";

describe("updateDoulaProfile", () => {
  const testDoulaId = "test-doula-for-update";
  const doulaDir = path.join(process.cwd(), "..", "hugo", "content", "doulas", testDoulaId);
  const filePath = path.join(doulaDir, "index.md");

  beforeEach(async () => {
    // Create a dummy doula profile for testing
    await fs.mkdir(doulaDir, { recursive: true });
    const initialContent = `---
title: "Test Doula"
---
Initial content.`;
    await fs.writeFile(filePath, initialContent, "utf-8");
  });

  afterEach(async () => {
    // Clean up the dummy doula profile
    await fs.rm(doulaDir, { recursive: true, force: true });
  });

  it("should update the doula profile successfully", async () => {
    const req = {
      body: {
        doulaId: testDoulaId,
        frontMatter: { title: "Updated Test Doula" },
        content: "Updated content.",
      },
    };

    const res = {
      status: (code: number) => {
        expect(code).to.equal(200);
        return {
          send: (body: any) => {
            expect(body.message).to.equal("Doula profile updated successfully.");
            expect(body.doulaId).to.equal(testDoulaId);
          },
        };
      },
    };

    await (updateDoulaProfile as any)(req, res);

    const updatedFileContent = await fs.readFile(filePath, "utf-8");
    expect(updatedFileContent).to.include("title: Updated Test Doula");
    expect(updatedFileContent).to.include("Updated content.");
  });

  it("should return 400 if required fields are missing", async () => {
    const req = {
      body: {}, // Missing required fields
    };
    const res = {
      status: (code: number) => {
        expect(code).to.equal(400);
        return {
          send: (message: string) => {
            expect(message).to.equal("Missing required fields: doulaId, frontMatter, or content.");
          },
        };
      },
    };

    await (updateDoulaProfile as any)(req, res);
  });

  it("should return 404 if doula profile does not exist", async () => {
    const req = {
      body: {
        doulaId: "non-existent-doula",
        frontMatter: { title: "title" },
        content: "content",
      },
    };
    const res = {
      status: (code: number) => {
        expect(code).to.equal(404);
        return {
          send: (message: string) => {
            expect(message).to.equal("Doula profile not found for ID: non-existent-doula");
          },
        };
      },
    };

    await (updateDoulaProfile as any)(req, res);
  });
});
