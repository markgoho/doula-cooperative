import { logger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { ProfileData } from "../schemas/profile-schemas.js";

/**
 * Remove protocol from URLs for Hugo front matter.
 * Hugo adds protocols automatically in templates, so storing without protocol
 * keeps data clean and protocol-agnostic.
 */
function stripUrlProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/**
 * Serialize ProfileData to Hugo markdown format with YAML front matter.
 */
export function serializeToMarkdown(
  data: ProfileData,
  existingMetadata?: {
    date?: string;
    createdAt?: string;
    updatedAt?: string;
    draft?: boolean;
  },
): string {
  const updatedAt = new Date().toISOString();

  // Format tags as YAML array
  const tagsYaml =
    data.tags && data.tags.length > 0
      ? `tags:\n${data.tags.map((tag: string) => `  - "${tag}"`).join("\n")}`
      : "";

  // Format contact information
  // Filter out undefined values before checking if contact object has data
  const hasContactData =
    data.contact !== undefined &&
    Object.values(data.contact).some((v) => typeof v === "string" && v !== "");
  const contactYaml =
    hasContactData && data.contact
      ? `contact:
${data.contact.business_name ? `  business_name: ${data.contact.business_name}\n` : ""}${data.contact.website ? `  website: ${stripUrlProtocol(data.contact.website)}\n` : ""}${data.contact.phone ? `  phone: ${data.contact.phone}\n` : ""}${data.contact.email ? `  email: "${data.contact.email}"\n` : ""}`.trimEnd()
      : "";

  const createdAt = existingMetadata?.createdAt;
  // Always use current timestamp for updatedAt
  const finalUpdatedAt = updatedAt;

  return `---
title: "${data.title}"
${existingMetadata?.date ? `date: ${existingMetadata.date}` : ""}
${createdAt ? `createdAt: ${createdAt}` : ""}
updatedAt: ${finalUpdatedAt}
type: "doulas"
${data.credentials ? `credentials: "${data.credentials}"` : ""}
${data.pronouns ? `pronouns: "${data.pronouns}"` : ""}
${tagsYaml}
${contactYaml}
${existingMetadata?.draft === undefined ? "" : `draft: ${existingMetadata.draft}`}
---

${data.bio.trim()}
`
    .split("\n")
    .filter((line) => line === "" || line.trim() !== "")
    .join("\n");
}

/**
 * Parse existing metadata from profile markdown content.
 * Preserves Hugo metadata fields that should be retained across updates.
 */
export function parseExistingMetadata(content: string): {
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  draft?: boolean;
} {
  const frontMatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);

  if (!frontMatterMatch?.[1]) {
    logger.warn(
      "No front matter found in existing profile content - metadata may be lost",
      {
        errorId: ERROR_IDS.API_PROFILE_WRITE_FAILED,
        contentPreview: content.slice(0, 200),
      },
    );
    return {};
  }

  const frontMatter = frontMatterMatch[1];
  const metadata: {
    date?: string;
    createdAt?: string;
    updatedAt?: string;
    draft?: boolean;
  } = {};

  const dateMatch = /^date:\s*(.+)$/m.exec(frontMatter);
  if (dateMatch?.[1]) {
    metadata.date = dateMatch[1].trim();
  }

  const createdAtMatch = /^createdAt:\s*(.+)$/m.exec(frontMatter);
  if (createdAtMatch?.[1]) {
    metadata.createdAt = createdAtMatch[1].trim();
  }

  const updatedAtMatch = /^updatedAt:\s*(.+)$/m.exec(frontMatter);
  if (updatedAtMatch?.[1]) {
    metadata.updatedAt = updatedAtMatch[1].trim();
  }

  const draftMatch = /^draft:\s*(.+)$/m.exec(frontMatter);
  if (draftMatch?.[1]) {
    metadata.draft = draftMatch[1].trim() === "true";
  }

  return metadata;
}
