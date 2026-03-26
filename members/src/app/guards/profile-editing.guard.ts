import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { MembershipService } from '../services/membership.service';

export const profileEditingGuard: CanActivateFn = () => {
  const membershipService = inject(MembershipService);
  const router = inject(Router);

  return firstValueFrom(
    toObservable(membershipService.userDocumentResource.status).pipe(
      filter((status) => !['idle', 'loading', 'reloading'].includes(status)),
      map(() => {
        const member = membershipService.userDocument();
        if (member?.membershipActive && member.allowProfileEditing) {
          return true;
        }

        return router.createUrlTree(['/membership']);
      }),
    ),
  );
};
