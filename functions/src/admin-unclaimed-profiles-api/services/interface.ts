import type { Logger } from "../../shared-api/types/logger.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type {
  ListUnclaimedProfilesResponse,
  UnclaimedProfileResponse,
} from "../schemas/unclaimed-profile-schemas.js";
import type { SendInvitationResponse } from "./send-invitation.js";

export interface UnclaimedProfileAdminService {
  listUnclaimedProfiles(options: {
    limit?: number;
    offset?: number;
    logger: Logger;
  }): Promise<ListUnclaimedProfilesResponse>;

  getUnclaimedProfile(options: {
    email: string;
    logger: Logger;
  }): Promise<UnclaimedProfileResponse>;

  sendInvitation(options: {
    email: string;
    emailService: EmailServiceInterface;
    logger: Logger;
  }): Promise<SendInvitationResponse>;
}
