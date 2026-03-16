import type { EmailServiceInterface } from "@doula-coop/functions-shared/shared-api/services/email/index.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";

export interface NewsletterService {
  updateNewsletterPreference(options: {
    memberId: string;
    subscribed: boolean;
    mailerliteApiKey: string;
    emailService: EmailServiceInterface;
    logger: Logger;
  }): Promise<{ subscribed: boolean }>;
}
