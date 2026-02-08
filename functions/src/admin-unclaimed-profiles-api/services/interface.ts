import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type {
  ChangeEmailAndResendSuccessResponse,
  ListUnclaimedProfilesSuccessResponse,
  SendInvitationSuccessResponse,
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

  sendInvitation(options: {
    email: string;
    emailService: EmailServiceInterface;
    logger: Logger;
  }): Promise<SendInvitationSuccessResponse>;

  changeEmailAndResend(options: {
    oldEmail: string;
    newEmail: string;
    emailService: EmailServiceInterface;
    logger: Logger;
  }): Promise<ChangeEmailAndResendSuccessResponse>;

  deleteUnclaimedProfile(options: {
    email: string;
    mailerliteApiKey: string;
    emailService: EmailServiceInterface;
    logger: Logger;
  }): Promise<{ success: true }>;
}
