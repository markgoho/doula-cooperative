import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  type AbstractControl,
  type AsyncValidatorFn,
  FormBuilder,
  type FormControl,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, from, map, type Observable, of, switchMap, timer } from 'rxjs';
import { MembershipService } from '../../../services/membership.service';
import { AlertBanner } from '../../../shared/alert-banner/alert-banner';
import { ensureUniqueSlug, generateSlug } from '../../../utils/slug-generator';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';

@Component({
  imports: [ReactiveFormsModule, AlertBanner],
  templateUrl: './personal-info-step.html',
  styleUrls: ['../../../shared/profile-form/profile-form-styles.scss', './personal-info-step.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalInfoStep {
  private readonly wizardService = inject(CreateProfileWizardService);
  private readonly membershipService = inject(MembershipService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly resolvedSlug = signal('');
  protected readonly errorMessage = signal('');

  protected readonly unownedMatch = signal<{ slug: string; title: string } | undefined>(undefined);
  protected readonly dismissedMatchSlug = signal<string | undefined>(undefined);
  protected readonly linkRequestInProgress = signal(false);
  protected readonly linkRequestSent = signal(false);

  protected readonly form = this.fb.group({
    title: [
      this.wizardService.personalInfo().title,
      [Validators.required],
      [this.createSlugValidator()],
    ],
    pronouns: [this.wizardService.personalInfo().pronouns],
    credentials: [this.wizardService.personalInfo().credentials],
  });

  protected get titleControl(): FormControl {
    return this.form.get('title') as FormControl;
  }

  constructor() {
    // Initialize resolved slug from wizard service
    this.resolvedSlug.set(this.wizardService.resolvedSlug());
  }

  protected async onNext(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');

    try {
      // Save form data to wizard service
      this.wizardService.personalInfo.set({
        title: this.form.value.title?.trim() ?? '',
        pronouns: this.form.value.pronouns?.trim() ?? '',
        credentials: this.form.value.credentials?.trim() ?? '',
      });

      // If slug changed from what's on the member document, persist it
      const resolved = this.resolvedSlug();
      const currentSlug = this.membershipService.userDocument()?.slug;

      if (resolved && resolved !== currentSlug) {
        await this.membershipService.updateMemberSlug(resolved);
      }

      this.wizardService.resolvedSlug.set(resolved);
      this.wizardService.completeStep('personal');
      void this.router.navigate(['/profile/create/tags']);
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to save. Please try again.',
      );
    }
  }

  protected onCancel(): void {
    void this.router.navigate(['/membership']);
  }

  protected async onConfirmUnownedMatch(): Promise<void> {
    const match = this.unownedMatch();
    if (!match) return;

    this.linkRequestInProgress.set(true);
    this.errorMessage.set('');
    try {
      await this.membershipService.requestProfileLink(match.slug);
      this.linkRequestSent.set(true);
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'Failed to request profile link. Please try again.',
      );
    } finally {
      this.linkRequestInProgress.set(false);
    }
  }

  protected onDeclineUnownedMatch(): void {
    const match = this.unownedMatch();
    if (!match) return;

    this.dismissedMatchSlug.set(match.slug);
    this.unownedMatch.set(undefined);
    this.titleControl.updateValueAndValidity();
  }

  private createSlugValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const currentSlug = this.membershipService.userDocument()?.slug;
      const name = control.value?.trim();
      // eslint-disable-next-line unicorn/no-null -- Angular validator API requires null for "no error"
      if (!name) return of(null);

      const slug = generateSlug(name);
      if (slug === currentSlug) {
        this.resolvedSlug.set(slug);
        this.unownedMatch.set(undefined);
        // eslint-disable-next-line unicorn/no-null -- Angular validator API requires null for "no error"
        return of(null);
      }

      return timer(500).pipe(
        switchMap(() => this.resolveSlug(slug)),
        catchError((error: unknown) => {
          console.error('Slug availability check failed:', error);
          return of({ slugCheckFailed: true });
        }),
      );
    };
  }

  /**
   * Resolve the base slug for a profile. If it matches an existing
   * unowned profile the member hasn't already dismissed, surface it
   * instead of silently deduplicating with a numeric suffix.
   *
   * Only offered when the member has no slug at all: by the time this
   * step is reached, `onCreateProfile` has almost always already set
   * `member.slug`, and the link-request endpoint always rejects once a
   * slug is set. Prompting in that case would show a dialog whose
   * "Yes" answer is guaranteed to fail.
   */
  private resolveSlug(slug: string): Observable<ValidationErrors | null> {
    if (slug === this.dismissedMatchSlug()) {
      return this.deduplicateSlug(slug);
    }

    const hasExistingSlug = this.membershipService.userDocument()?.slug !== undefined;

    return from(this.membershipService.checkSlugAvailability(slug)).pipe(
      switchMap(({ taken, unownedMatch }) => {
        if (unownedMatch && !hasExistingSlug) {
          this.unownedMatch.set(unownedMatch);
          this.resolvedSlug.set('');
          return of({ unownedProfileFound: true });
        }

        this.unownedMatch.set(undefined);
        if (!taken) {
          this.resolvedSlug.set(slug);
          // eslint-disable-next-line unicorn/no-null -- Angular validator API requires null for "no error"
          return of(null);
        }

        return this.deduplicateSlug(slug);
      }),
    );
  }

  private deduplicateSlug(slug: string): Observable<ValidationErrors | null> {
    return from(ensureUniqueSlug(slug, (s) => this.membershipService.checkSlugExists(s))).pipe(
      map((resolved) => {
        this.resolvedSlug.set(resolved);
        // eslint-disable-next-line unicorn/no-null -- Angular validator API requires null for "no error"
        return null;
      }),
    );
  }
}
