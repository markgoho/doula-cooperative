import { logger } from "firebase-functions/v2";
import { dump } from "js-yaml";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { ProfileData, ProfileDataBody } from "../schemas/profile-schemas.js";

/**
 * Hugo front matter structure for profile markdown files.
 * ProfileDataBody minus 'bio' (which goes in markdown body) plus Hugo metadata.
 */
interface HugoFrontMatter extends Omit<ProfileDataBody, "bio"> {
  type: string;
  updatedAt: string;
  date?: string;
  createdAt?: string;
}

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
 * Uses js-yaml for reliable YAML generation.
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

  // Build front matter object
  const frontMatter: HugoFrontMatter = {
    title: data.title,
    type: "doulas",
    updatedAt,
  };

  // Add optional metadata fields
  if (existingMetadata?.date) {
    frontMatter.date = existingMetadata.date;
  }
  if (existingMetadata?.createdAt) {
    frontMatter.createdAt = existingMetadata.createdAt;
  }
  if (existingMetadata?.draft !== undefined) {
    frontMatter.draft = existingMetadata.draft;
  }

  // Add profile fields
  if (data.credentials) {
    frontMatter.credentials = data.credentials;
  }
  if (data.pronouns) {
    frontMatter.pronouns = data.pronouns;
  }
  if (data.tags && data.tags.length > 0) {
    frontMatter.tags = data.tags;
  }

  // Add contact information (strip website protocol, filter empty values)
  if (data.contact) {
    const contact: Record<string, string> = {};
    if (data.contact.business_name) {
      contact.business_name = data.contact.business_name;
    }
    if (data.contact.website) {
      contact.website = stripUrlProtocol(data.contact.website);
    }
    if (data.contact.phone) {
      contact.phone = data.contact.phone;
    }
    if (data.contact.email) {
      contact.email = data.contact.email;
    }

    if (Object.keys(contact).length > 0) {
      frontMatter.contact = contact;
    }
  }

  // Use js-yaml to generate YAML front matter
  const yamlFrontMatter = dump(frontMatter, {
    lineWidth: -1, // Don't wrap lines
    noRefs: true, // Don't use YAML references
  }).trim();

  return `---
${yamlFrontMatter}
---

${data.bio.trim()}
`;
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
