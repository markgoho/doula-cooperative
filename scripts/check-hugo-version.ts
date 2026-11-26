#!/usr/bin/env bun

/**
 * Fail when the installed Hugo differs from the version CI builds with.
 *
 * The Dockerfile's HUGO_VERSION is the single source of truth. Hugo versions
 * can render the same content differently, so a mismatch hides bugs that only
 * show up in the deployed site.
 */

import { $ } from "bun";

// CI's image is built from the Dockerfile, so it can only differ while a
// rebuild is in flight; failing a deploy for that helps nobody.
if (process.env["CI"]) {
  process.exit(0);
}

const VERSION_PATTERN = /v(\d+\.\d+\.\d+)/;
const PINNED_PATTERN = /^ARG HUGO_VERSION=(\d+\.\d+\.\d+)$/m;

const dockerfile = await Bun.file(`${import.meta.dir}/../Dockerfile`).text();
const pinned = PINNED_PATTERN.exec(dockerfile)?.[1];
const installed = VERSION_PATTERN.exec(await $`hugo version`.text())?.[1];

if (!pinned || !installed) {
  console.error(
    `❌ Could not read Hugo versions (Dockerfile: ${pinned}, installed: ${installed})`,
  );
  process.exit(1);
}

if (pinned !== installed) {
  console.error(
    [
      `❌ Hugo version mismatch: installed ${installed}, Dockerfile pins ${pinned}.`,
      "   Stay on the latest release: upgrade the older side.",
      "   - Local: brew upgrade hugo",
      "   - CI: bump ARG HUGO_VERSION in Dockerfile (trunk push rebuilds the image)",
    ].join("\n"),
  );
  process.exit(1);
}
