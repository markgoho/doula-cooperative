import type { Logger } from "../../../shared-api/types/logger.js";

export interface NewsletterService {
  updateNewsletterPreference(options: {
    memberId: string;
    subscribed: boolean;
    mailerliteApiKey: string;
    mailgunApiKey: string | undefined;
    logger: Logger;
  }): Promise<{ subscribed: boolean }>;
}
