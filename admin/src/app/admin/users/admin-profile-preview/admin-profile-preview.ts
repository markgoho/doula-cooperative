import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertBanner } from '../../../shared/alert-banner/alert-banner';
import { ProfilePreview } from '../../../shared/profile-preview/profile-preview';
import { AdminMemberDetailService } from '../admin-member-detail/admin-member-detail.service';

@Component({
  imports: [ProfilePreview, AlertBanner, RouterLink],
  templateUrl: './admin-profile-preview.html',
  styleUrl: './admin-profile-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminMemberDetailService],
})
export class AdminProfilePreview {
  protected service = inject(AdminMemberDetailService);

  readonly uid = input.required<string>();

  constructor() {
    this.service.init(this.uid);

    effect(() => {
      const member = this.service.memberResource.value();
      if (member?.slug) {
        this.service.loadProfile(member);
      }
    });
  }
}
