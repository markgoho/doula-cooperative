import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PROFILE_TAGS } from '../../../constants/profile-tags';
import { AlertBanner } from '../../../shared/alert-banner/alert-banner';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';

@Component({
  imports: [AlertBanner],
  templateUrl: './tags-step.html',
  styleUrls: ['../../../shared/profile-form/profile-form-styles.scss', './tags-step.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagsStep {
  private readonly wizardService = inject(CreateProfileWizardService);
  private readonly router = inject(Router);

  protected readonly availableTags = PROFILE_TAGS;
  protected readonly selectedTags = signal<Set<string>>(new Set(this.wizardService.selectedTags()));
  protected readonly errorMessage = signal('');

  protected isSelected(tag: string): boolean {
    return this.selectedTags().has(tag);
  }

  protected toggleTag(tag: string): void {
    this.selectedTags.update((set) => {
      const next = new Set(set);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
    this.errorMessage.set('');
  }

  protected onNext(): void {
    if (this.selectedTags().size === 0) {
      this.errorMessage.set('Please select at least one service or specialty.');
      return;
    }

    this.wizardService.selectedTags.set([...this.selectedTags()]);
    this.wizardService.completeStep('tags');
    void this.router.navigate(['/profile/create/bio']);
  }

  protected onBack(): void {
    // Save current selections even when going back
    this.wizardService.selectedTags.set([...this.selectedTags()]);
    void this.router.navigate(['/profile/create/personal']);
  }
}
