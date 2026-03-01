import {
  NotFoundError,
  ValidationError,
} from "../../../shared-api/errors/http-error.js";
import { MemberFirestoreService } from "../../../shared-api/services/member-firestore/index.js";
import { updateMemberWithValidation } from "../../../shared-api/utils/firestore-helpers.js";
import { cancelStripeSubscriptionAtPeriodEnd } from "../../../stripe-webhook-api/services/cancel-stripe-subscription-at-period-end.js";
import type { MemberDocument } from "../../../types/member-document.js";
import type { MemberService as MemberServiceInterface } from "./interface.js";

/**
 * Service for member-related operations.
 * Uses plain object with functions to avoid request dependencies.
 */
export const MemberService: MemberServiceInterface = {
  /**
   * Find a member by their ID.
   *
   * @param memberId - The Firestore document ID of the member
   * @returns Member document data
   * @throws NotFoundError if member does not exist
   */
  async findById(memberId: string): Promise<MemberDocument> {
    const document = await MemberFirestoreService.getMemberByUid(memberId);

    if (!document.exists) {
      throw new NotFoundError("Member not found");
    }

    return document.data() as MemberDocument;
  },

  /**
   * Update a member's name.
   *
   * @param memberId - The Firestore document ID of the member
   * @param name - The new name to set
   * @returns Updated member document data
   * @throws NotFoundError if member does not exist
   * @throws Error for Firestore operation failures
   */
  async updateName(memberId: string, name: string): Promise<MemberDocument> {
    const document = await MemberFirestoreService.getMemberByUid(memberId);

    if (!document.exists) {
      throw new NotFoundError("Member not found");
    }

    await MemberFirestoreService.updateMember(memberId, { name });

    const updatedDocument =
      await MemberFirestoreService.getMemberByUid(memberId);

    if (!updatedDocument.exists) {
      throw new NotFoundError("Member not found after update");
    }

    return updatedDocument.data() as MemberDocument;
  },

  /**
   * Cancel a membership by scheduling Stripe subscription cancellation at period end.
   * Only available for members with Stripe subscription data.
   *
   * @param memberId - The Firestore document ID of the member
   * @returns Updated member document data
   * @throws NotFoundError if member does not exist
   * @throws ValidationError if member has no Stripe data
   * @throws Error if Stripe cancellation fails
   */
  async cancelMembership(memberId: string): Promise<MemberDocument> {
    const document = await MemberFirestoreService.getMemberByUid(memberId);

    if (!document.exists) {
      throw new NotFoundError("Member not found");
    }

    const member = document.data() as MemberDocument;

    if (
      member.stripeCustomerId === undefined ||
      member.stripeSubscriptionId === undefined
    ) {
      throw new ValidationError(
        "Cannot cancel membership: no Stripe subscription data found. Please contact support.",
      );
    }

    await cancelStripeSubscriptionAtPeriodEnd({
      subscriptionId: member.stripeSubscriptionId,
    });

    return updateMemberWithValidation({
      memberId,
      updates: {
        subscriptionStatus: "canceled",
      },
      operation: "cancel membership (self-service)",
    });
  },
};
