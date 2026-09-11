/**
 * ProfileData interface for doula profiles.
 * This represents the structure of a doula profile.
 */
export interface ProfileData {
  /** Required: The doula's display name */
  title: string;

  /** Optional: Pronouns (e.g., "she/her", "he/him", "they/them") */
  pronouns?: string;

  /** Optional: Professional credentials (e.g., "CD(DONA), CPD") */
  credentials?: string;

  /** Optional: Array of service tags/specialties */
  tags?: string[];

  /** Optional: Contact information */
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
    business_name?: string;
  };

  /** Required: Bio/description of services */
  bio: string;

  /** Optional: Draft status (read from markdown, preserved on updates, but not set by user input) */
  draft?: boolean;

  /** Optional: Profile image URL (managed separately from markdown content, provided by backend) */
  image?: string;
}

/**
 * YAML front matter structure from Hugo markdown files.
 * This represents what gets parsed from the --- delimited front matter.
 */
export interface ProfileFrontMatter {
  title?: string;
  pronouns?: string;
  credentials?: string;
  tags?: string[];
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
    business_name?: string;
  };
  draft?: boolean;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  type?: string;
}
