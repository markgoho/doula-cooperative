import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { MembershipService } from '../services/membership.service';
import {
  CreateProfileWizardService,
  WIZARD_STEPS,
  type WizardStep,
} from './create-profile-wizard.service';
import { StepIndicator } from './step-indicator/step-indicator';

@Component({
  imports: [RouterOutlet, StepIndicator],
  templateUrl: './create-profile-wizard.html',
  styleUrl: './create-profile-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateProfileWizard {
  protected readonly wizardService = inject(CreateProfileWizardService);
  private readonly membershipService = inject(MembershipService);
  private readonly router = inject(Router);

  protected readonly userDocument = this.membershipService.userDocument;

  /** Track which step is currently active based on the URL. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly currentStep = computed((): WizardStep => {
    const url = this.currentUrl();
    for (const step of WIZARD_STEPS) {
      if (url.includes(`/profile/create/${step}`)) return step;
    }
    return 'personal';
  });

  constructor() {
    // Redirect to /profile if user already has a profile
    effect(() => {
      const user = this.userDocument();
      if (user?.profileCreatedAt) {
        void this.router.navigate(['/profile']);
      }
    });

    // Initialize wizard from member document
    effect(() => {
      const user = this.userDocument();
      if (user) {
        this.wizardService.initializeFromMember(user);
      }
    });
  }
}
