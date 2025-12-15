import type { Logger } from "../../shared-api/types/logger.js";
import type {
  ListUnclaimedProfilesResponse,
  UnclaimedProfileResponse,
} from "../schemas/unclaimed-profile-schemas.js";

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
}
