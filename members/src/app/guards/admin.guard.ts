import { hasCustomClaim } from '@angular/fire/auth-guard';
import { pipe } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Auth pipe that checks if user has admin custom claim.
 * Redirects non-admin users to the membership page.
 */
export const redirectNonAdminToMembership = () =>
  pipe(
    hasCustomClaim('admin'),
    map((hasAdminClaim) => hasAdminClaim || ['/membership']),
  );
