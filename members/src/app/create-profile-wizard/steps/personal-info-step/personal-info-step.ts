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

  private createSlugValidator(): AsyncValidatorFn {
    const currentSlug = this.membershipService.userDocument()?.slug;

    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const name = control.value?.trim();
      // eslint-disable-next-line unicorn/no-null -- Angular validator API requires null for "no error"
      if (!name) return of(null);

      const slug = generateSlug(name);
      if (slug === currentSlug) {
        this.resolvedSlug.set(slug);
        // eslint-disable-next-line unicorn/no-null -- Angular validator API requires null for "no error"
        return of(null);
      }

      return timer(500).pipe(
        switchMap(() =>
          from(ensureUniqueSlug(slug, (s) => this.membershipService.checkSlugExists(s))),
        ),
        map((resolved) => {
          this.resolvedSlug.set(resolved);
          // eslint-disable-next-line unicorn/no-null -- Angular validator API requires null for "no error"
          return null;
        }),
        catchError(() => of({ slugCheckFailed: true })),
      );
    };
  }
}
