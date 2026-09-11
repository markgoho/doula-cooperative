import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { type ProfileData } from '../../types/profile-data';

@Component({
  selector: 'app-profile-preview',
  templateUrl: './profile-preview.html',
  styleUrl: './profile-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePreview {
  readonly profile = input.required<ProfileData>();
  readonly imageUrl = input<string>();
  readonly showEditLinks = input(false);

  readonly editSection = output<string>();

  /** Normalize website URL — prepend https:// only if no protocol is present. */
  protected readonly websiteUrl = computed(() => {
    const site = this.profile().contact?.website;
    if (!site) return '';
    return site.startsWith('http') ? site : `https://${site}`;
  });
}
