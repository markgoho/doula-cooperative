import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-profile-preview',
  templateUrl: './profile-preview.html',
  styleUrl: './profile-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePreview {
  readonly title = input.required<string>();
  readonly credentials = input<string>();
  readonly pronouns = input<string>();
  readonly tags = input<string[]>();
  readonly bio = input.required<string>();
  readonly contact = input<{
    business_name?: string;
    phone?: string;
    email?: string;
    website?: string;
  }>();
  readonly imageUrl = input<string>();
  readonly showEditLinks = input(false);

  readonly editSection = output<string>();

  /** Normalize website URL — prepend https:// only if no protocol is present. */
  protected readonly websiteUrl = computed(() => {
    const site = this.contact()?.website;
    if (!site) return '';
    return site.startsWith('http') ? site : `https://${site}`;
  });
}
