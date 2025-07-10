import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatDate(d: Date): string {
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function processFile(file: string) {
  try {
    const stats = await fs.stat(file);
    const d = new Date(stats.mtimeMs);
    const timestamp = formatDate(d);
    const data = await fs.readFile(file, "utf8");
    if (data.includes("YYYY-MM-DD HH:MM:SS")) {
      const updated = data.replaceAll("YYYY-MM-DD HH:MM:SS", timestamp);
      await fs.writeFile(file, updated, "utf8");
      console.log(`Updated ${file} with timestamp ${timestamp}`);
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Error processing ${file}:`, error.message);
    } else {
      console.error(`Unknown error processing ${file}`);
    }
  }
}

async function walk(directory: string) {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Error reading directory ${directory}:`, error.message);
    } else {
      console.error(`Unknown error reading directory ${directory}`);
    }
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      await processFile(fullPath);
    }
  }
}

const folder = Bun.argv[2];
if (!folder) {
  console.error("Usage: bun get-task-timestamps.ts <folder>");
  throw new Error("No folder specified");
}
await walk(folder);
