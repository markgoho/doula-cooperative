import type { EmailServiceInterface } from "@doula-coop/functions-shared/shared-api/services/email/index.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import type {
  DeleteUnclaimedProfileSuccessResponse,
  ListUnclaimedProfilesSuccessResponse,
  RefreshPaymentDatesSuccessResponse,
  UnclaimedProfileSuccessResponse,
} from "../schemas/unclaimed-profile-schemas.js";

export interface UnclaimedProfileAdminService {
  listUnclaimedProfiles(options: {
    limit?: number;
    offset?: number;
    logger: Logger;
  }): Promise<ListUnclaimedProfilesSuccessResponse>;

  getUnclaimedProfile(options: {
    email: string;
    logger: Logger;
  }): Promise<UnclaimedProfileSuccessResponse>;

  updateEmail(options: {
    oldEmail: string;
    newEmail: string;
    logger: Logger;
  }): Promise<{ success: true }>;

  deleteUnclaimedProfile(options: {
    email: string;
    mailerliteApiKey: string;
    emailService: EmailServiceInterface;
    logger: Logger;
  }): Promise<DeleteUnclaimedProfileSuccessResponse>;

  refreshPaymentDates(options: {
    logger: Logger;
  }): Promise<RefreshPaymentDatesSuccessResponse>;
}
