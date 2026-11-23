import type { Logger } from "../../../shared-api/types/logger.js";

/** A Member as the doula picker needs it. `name` is "" when unset; `email` stays on the server. */
export interface MemberDoula {
  uid: string;
  name: string;
  email: string;
}

/** An Unclaimed Legacy Membership as the doula picker needs it. `name` is "" when unset; `email` stays on the server. */
export interface LegacyDoula {
  email: string;
  name: string;
}

/**
 * Result of recording an Offline Response.
 * - `recorded`: stored.
 * - `has_outreach`: the Member already sent Outreach on this Referral.
 * - `already_recorded`: this doula already has an Offline Response on it.
 */
export type OfflineResponseRecording =
  "recorded" | "has_outreach" | "already_recorded";

export interface OfflineResponseService {
  /** Every Member, in any membership state. */
  listMemberDoulas(logger: Logger): Promise<MemberDoula[]>;
  /** Every Unclaimed Legacy Membership (`migrated_users_import`). */
  listUnclaimedLegacyMemberships(logger: Logger): Promise<LegacyDoula[]>;
  /**
   * Atomically record a Member's Offline Response, unless they sent Outreach
   * on this Referral or already have one. Sets `memberUid` so the Member's
   * reached-out list finds the Referral.
   */
  recordMemberOfflineResponse(
    record: {
      requestId: string;
      memberUid: string;
      recordedBy: string;
      recordedAt: Date;
    },
    logger: Logger,
  ): Promise<OfflineResponseRecording>;
  /** Record an Unclaimed Legacy Membership's Offline Response, unless it already has one. */
  recordLegacyOfflineResponse(
    record: {
      requestId: string;
      legacyEmail: string;
      displayName: string;
      recordedBy: string;
      recordedAt: Date;
    },
    logger: Logger,
  ): Promise<Exclude<OfflineResponseRecording, "has_outreach">>;
  /**
   * Remove a Member's Offline Response. When the Member never sent Outreach,
   * their Referral Outcome goes with it, since nothing unlocks it any more.
   */
  deleteMemberOfflineResponse(
    target: { requestId: string; memberUid: string },
    logger: Logger,
  ): Promise<void>;
  /** Remove an Unclaimed Legacy Membership's Offline Response. */
  deleteLegacyOfflineResponse(
    target: { requestId: string; legacyEmail: string },
    logger: Logger,
  ): Promise<void>;
}
