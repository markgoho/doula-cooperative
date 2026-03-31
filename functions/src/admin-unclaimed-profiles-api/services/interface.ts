import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type {
  DeleteUnclaimedProfileSuccessResponse,
  DraftUnclaimedProfileSuccessResponse,
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

  draftUnclaimedProfile(options: {
    email: string;
    logger: Logger;
  }): Promise<DraftUnclaimedProfileSuccessResponse & { rebuildTriggered: boolean }>;

  refreshPaymentDates(options: {
    logger: Logger;
  }): Promise<RefreshPaymentDatesSuccessResponse>;
}
