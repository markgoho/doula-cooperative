import { readdirSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const transpiler = new Bun.Transpiler({
  loader: "ts",
});

async function transpileDirectory(
  sourceDirectory: string,
  outputDirectory: string,
) {
  const entries = readdirSync(sourceDirectory);

  for (const entry of entries) {
    const sourcePath = path.join(sourceDirectory, entry);
    const stat = statSync(sourcePath);

    if (stat.isDirectory()) {
      // Recursively transpile subdirectories
      await transpileDirectory(sourcePath, outputDirectory);
    } else if (entry.endsWith(".ts")) {
      // Transpile .ts file
      const code = await Bun.file(sourcePath).text();
      const output = transpiler.transformSync(code);

      // Calculate output path
      const relativePath = path.relative("src", sourcePath);
      const outPath = path.join(
        outputDirectory,
        relativePath.replace(/\.ts$/, ".js"),
      );

      // Ensure output directory exists
      await mkdir(path.dirname(outPath), { recursive: true });

      // Write transpiled file
      await Bun.write(outPath, output);
      console.log(`✓ ${relativePath} → ${path.relative(".", outPath)}`);
    }
  }
}

console.log("Transpiling TypeScript files...");
await transpileDirectory("src", "lib");
console.log("✅ Build complete!");
