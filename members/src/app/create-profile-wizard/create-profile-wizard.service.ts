import { computed, Injectable, signal } from '@angular/core';
import { type Member } from '../services/membership.service';
import { type ProfileData } from '../types/profile-data';
import { type ContactInfo, type PersonalInfo, type WizardStep, WIZARD_STEPS } from './wizard-types';

export { type WizardStep, WIZARD_STEPS } from './wizard-types';

/**
 * Holds all wizard state as signals so data survives route navigation between steps.
 * Each step reads initial values from the service and writes back on "Next".
 */
@Injectable({
  providedIn: 'root',
})
export class CreateProfileWizardService {
  // Personal info fields
  readonly personalInfo = signal<PersonalInfo>({ title: '', pronouns: '', credentials: '' });

  // Service tags
  readonly selectedTags = signal<string[]>([]);

  // Bio content
  readonly bio = signal('');

  // Contact details
  readonly contactInfo = signal<ContactInfo>({
    businessName: '',
    phone: '',
    email: '',
    website: '',
  });

  // Wizard lifecycle and navigation state
  readonly completedSteps = signal<ReadonlySet<WizardStep>>(new Set());
  readonly profileCreated = signal(false);
  readonly resolvedSlug = signal('');

  /** Whether the wizard has been initialized from the member document. */
  readonly initialized = signal(false);

  /** The current step index (0-based). */
  readonly currentStepIndex = computed(() => {
    const completed = this.completedSteps();
    const index = WIZARD_STEPS.findIndex((step) => !completed.has(step));
    return index === -1 ? WIZARD_STEPS.length - 1 : index;
  });

  /**
   * Pre-fill wizard state from the member document.
   * Only runs once per wizard session.
   */
  initializeFromMember(member: Member): void {
    if (this.initialized()) return;

    this.personalInfo.set({
      title: member.name ?? '',
      pronouns: '',
      credentials: '',
    });

    this.contactInfo.update((current) => ({
      ...current,
      email: member.email ?? '',
    }));

    if (member.slug) {
      this.resolvedSlug.set(member.slug);
    }

    this.initialized.set(true);
  }

  /**
   * Assemble ProfileData from wizard signals for API submission.
   */
  buildProfileData(): ProfileData {
    const personal = this.personalInfo();
    const tags = this.selectedTags();
    const bio = this.bio();
    const contact = this.contactInfo();

    const profileData: ProfileData = {
      title: personal.title,
      bio,
    };

    if (personal.pronouns) {
      profileData.pronouns = personal.pronouns;
    }

    if (personal.credentials) {
      profileData.credentials = personal.credentials;
    }

    if (tags.length > 0) {
      profileData.tags = tags;
    }

    const hasContactInfo =
      contact.businessName || contact.phone || contact.email || contact.website;

    if (hasContactInfo) {
      profileData.contact = {};
      if (contact.businessName) profileData.contact.business_name = contact.businessName;
      if (contact.phone) profileData.contact.phone = contact.phone;
      if (contact.email) profileData.contact.email = contact.email;
      if (contact.website) profileData.contact.website = contact.website;
    }

    return profileData;
  }

  /**
   * Check if a step can be navigated to.
   * All steps before the target must be completed.
   * The image and preview steps additionally require profileCreated to be true.
   */
  canNavigateToStep(step: WizardStep): boolean {
    const stepIndex = WIZARD_STEPS.indexOf(step);
    if (stepIndex === 0) return true;

    const completed = this.completedSteps();

    // Check all prior steps are completed
    const priorSteps = WIZARD_STEPS.slice(0, stepIndex);
    if (priorSteps.some((priorStep) => !completed.has(priorStep))) return false;

    // Image and preview steps require profile to be created first
    const imageStepIndex = WIZARD_STEPS.indexOf('image');
    if (stepIndex >= imageStepIndex && !this.profileCreated()) return false;

    return true;
  }

  /**
   * Mark a step as completed.
   */
  completeStep(step: WizardStep): void {
    this.completedSteps.update((set) => {
      const next = new Set(set);
      next.add(step);
      return next;
    });
  }

  /**
   * Get the first incomplete step name.
   */
  getFirstIncompleteStep(): WizardStep {
    const completed = this.completedSteps();
    for (const step of WIZARD_STEPS) {
      if (!completed.has(step)) return step;
    }
    return 'preview';
  }

  /**
   * Clear all wizard state. Called on completion or abandonment.
   */
  reset(): void {
    this.personalInfo.set({ title: '', pronouns: '', credentials: '' });
    this.selectedTags.set([]);
    this.bio.set('');
    this.contactInfo.set({ businessName: '', phone: '', email: '', website: '' });
    this.completedSteps.set(new Set());
    this.profileCreated.set(false);
    this.resolvedSlug.set('');
    this.initialized.set(false);
  }
}
