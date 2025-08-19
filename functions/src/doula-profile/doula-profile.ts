import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

export const handleUpdateDoulaProfile = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const { doulaId, frontMatter, content } = request.body;

    if (!doulaId || !frontMatter || content === undefined) {
      response.status(400).send("Missing required fields: doulaId, frontMatter, or content.");
      return;
    }

    const doulaDir = path.join(process.cwd(), "..", "hugo", "content", "doulas", doulaId);
    const filePath = path.join(doulaDir, "index.md");

    // Check if the directory and file exist
    try {
      await fs.access(filePath);
    } catch (error) {
      response.status(404).send(`Doula profile not found for ID: ${doulaId}`);
      return;
    }

    const newContent = matter.stringify(content, frontMatter);

    await fs.writeFile(filePath, newContent, "utf-8");

    response.status(200).send({
      message: "Doula profile updated successfully.",
      doulaId,
    });
  } catch (error) {
    console.error("Error updating doula profile:", error);
    response.status(500).send("An internal error occurred.");
  }
};
