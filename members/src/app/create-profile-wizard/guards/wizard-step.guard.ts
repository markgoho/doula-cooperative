import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { CreateProfileWizardService, type WizardStep } from '../create-profile-wizard.service';

/**
 * Guard factory that prevents navigating to a wizard step
 * unless all prerequisite steps are completed.
 */
export function wizardStepGuard(step: WizardStep): CanActivateFn {
  return () => {
    const wizardService = inject(CreateProfileWizardService);
    const router = inject(Router);

    if (wizardService.canNavigateToStep(step)) {
      return true;
    }

    const firstIncomplete = wizardService.getFirstIncompleteStep();

    // Avoid redirect loop: if the first incomplete step also can't be navigated to
    // (e.g., image/preview require profileCreated), fall back to the last navigable step
    if (!wizardService.canNavigateToStep(firstIncomplete)) {
      return router.createUrlTree(['/profile/create', 'contact']);
    }

    return router.createUrlTree(['/profile/create', firstIncomplete]);
  };
}
