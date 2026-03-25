import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { MembershipService } from '../services/membership.service';

export const profileEditingGuard: CanActivateFn = () => {
  const membershipService = inject(MembershipService);
  const router = inject(Router);

  const member = membershipService.userDocument();
  if (member?.membershipActive && member.allowProfileEditing) {
    return true;
  }

  return router.createUrlTree(['/membership']);
};
