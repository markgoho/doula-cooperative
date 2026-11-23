import { SERVICE_LABELS } from './referral.constants';

/** Short service labels joined for display, e.g. "Birth, Postpartum". */
export function formatServices(services: string[]): string {
  return services.map((service) => SERVICE_LABELS[service] ?? service).join(', ');
}
