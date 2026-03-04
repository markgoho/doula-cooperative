export const WIZARD_STEPS = ['personal', 'tags', 'bio', 'contact', 'image', 'preview'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export interface PersonalInfo {
  title: string;
  pronouns: string;
  credentials: string;
}

export interface ContactInfo {
  businessName: string;
  phone: string;
  email: string;
  website: string;
}
