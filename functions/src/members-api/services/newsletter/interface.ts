import type { Logger } from "../../../shared-api/types/logger.js";
import type { EmailServiceInterface } from "../../../shared-api/services/email/index.js";

export interface NewsletterService {
  updateNewsletterPreference(options: {
    memberId: string;
    subscribed: boolean;
    mailerliteApiKey: string;
    emailService: EmailServiceInterface;
    logger: Logger;
  }): Promise<{ subscribed: boolean }>;
}
