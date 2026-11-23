import { NotFoundError } from "../../../shared-api/errors/http-error.js";
import type { Logger } from "../../../shared-api/types/logger.js";
import type { MemberDocument } from "../../../types/member-document.js";
import type { ReferralDetail } from "../../schemas/referral-schemas.js";
import type { OutreachService } from "./interface.js";

/**
 * Who the viewer's Outreach email would come from, for the composer.
 * Undefined when the viewer has no member document (they can't send Outreach).
 */
export async function loadOutreachSender({
  loadMember,
  fallbackEmail,
  outreachService,
  logger,
}: {
  loadMember: () => Promise<MemberDocument>;
  fallbackEmail: string | undefined;
  outreachService: OutreachService;
  logger: Logger;
}): Promise<ReferralDetail["outreachSender"]> {
  let member: MemberDocument;
  try {
    member = await loadMember();
  } catch (error) {
    if (error instanceof NotFoundError) return undefined;
    throw error;
  }

  const profileUrl = await outreachService.findPublishedProfileUrl(
    member.slug,
    logger,
  );
  return {
    name: member.name?.trim() ?? "",
    email: member.email.trim() === "" ? (fallbackEmail ?? "") : member.email,
    ...(profileUrl !== undefined && { profileUrl }),
  };
}
