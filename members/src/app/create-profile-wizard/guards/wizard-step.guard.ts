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

    if (wizardService.canNavigateToStep(step)) {
      return true;
    }

    const router = inject(Router);
    const firstIncomplete = wizardService.getFirstIncompleteStep();
    return router.createUrlTree(['/profile/create', firstIncomplete]);
  };
}
