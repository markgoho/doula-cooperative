import type { Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import type { Request } from "firebase-functions/v2/https";
import type { MailgunMessageData } from "mailgun.js/definitions";
import { MEMBERS_COLLECTION, type MemberDocument } from "../collections/index.js";
import {
  ERROR_IDS,
  MARK_EMAIL,
  NO_REPLY_EMAIL,
} from "../constants/index.js";
import { sendEmail } from "../utils/send-email.js";
import type { WebhookPayload } from "./types.js";

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index++) {
    const aCode = a.codePointAt(index) ?? 0;
    const bCode = b.codePointAt(index) ?? 0;
    result |= aCode ^ bCode;
  }
  return result === 0;
}

export async function handler(
  request: Request,
  response: Response,
): Promise<void> {
  const webhookSecret = process.env["DEPLOY_WEBHOOK_SECRET"];
  const mailgunApiKey = process.env["MAILGUN_API_KEY"];

  if (!webhookSecret) {
    logger.error("DEPLOY_WEBHOOK_SECRET not configured");
    response.status(500).send({ error: "Server configuration error" });
    return;
  }

  if (!mailgunApiKey) {
    logger.error("MAILGUN_API_KEY not configured");
    response.status(500).send({ error: "Server configuration error" });
    return;
  }

  // Parse and validate request body
  const payload = request.body as Partial<WebhookPayload>;

  if (!payload.secret) {
    logger.warn("Webhook called without secret", {
      errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_INVALID_SECRET,
    });
    response.status(401).send({ error: "Unauthorized" });
    return;
  }

  // Validate secret with constant-time comparison
  if (!secureCompare(payload.secret, webhookSecret)) {
    logger.warn("Invalid webhook secret", {
      errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_INVALID_SECRET,
    });
    response.status(401).send({ error: "Unauthorized" });
    return;
  }

  const { commitMessage, commitSha, slug } = payload;

  // Validate payload
  if (!commitMessage || !commitSha || slug === undefined) {
    logger.warn("Invalid webhook payload", {
      hasCommitMessage: !!commitMessage,
      hasCommitSha: !!commitSha,
      hasSlug: slug !== undefined,
    });
    response.status(200).send({
      received: true,
      notified: false,
      reason: "invalid_payload",
    });
    return;
  }

  // Check if this is a single profile update
  if (!slug || slug === "") {
    logger.info("Not a single profile update, skipping notification", {
      commitMessage,
      commitSha,
    });
    response.status(200).send({
      received: true,
      notified: false,
      reason: "not_single_profile",
    });
    return;
  }

  // Check if commit message indicates a profile or image update (not creation)
  const isProfileUpdate = commitMessage.startsWith("Update profile for ");
  const isImageUpdate = commitMessage.startsWith("Update profile image for ");

  if (!isProfileUpdate && !isImageUpdate) {
    logger.info("Not a profile-related commit, skipping notification", {
      commitMessage,
      commitSha,
      slug,
    });
    response.status(200).send({
      received: true,
      notified: false,
      reason: "not_profile_related",
    });
    return;
  }

  // Query member by slug
  const membersReference = getFirestore().collection(MEMBERS_COLLECTION);
  const memberQuery = membersReference.where("slug", "==", slug).limit(1);

  let snapshot;
  try {
    snapshot = await memberQuery.get();
  } catch (error) {
    logger.error("Failed to query members collection", {
      error,
      slug,
      commitSha,
    });
    response.status(200).send({
      received: true,
      notified: false,
      reason: "query_failed",
    });
    return;
  }

  if (snapshot.empty || !snapshot.docs[0]) {
    logger.warn("Member not found for profile update notification", {
      errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_MEMBER_NOT_FOUND,
      slug,
      commitSha,
    });
    response.status(200).send({
      received: true,
      notified: false,
      reason: "member_not_found",
    });
    return;
  }

  const memberDocument = snapshot.docs[0];
  const memberData = memberDocument.data() as MemberDocument;

  // Validate member has email
  if (!memberData.email) {
    logger.error("Member has no email address", {
      errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_MEMBER_NOT_FOUND,
      slug,
      uid: memberData.uid,
      commitSha,
    });
    response.status(200).send({
      received: true,
      notified: false,
      reason: "no_email",
    });
    return;
  }

  // Construct profile URL
  const profileUrl = `https://doulacooperative.com/doulas/${slug}/`;

  // Customize email content based on update type
  const subject = isImageUpdate
    ? "Your profile photo has been updated"
    : "Your Doula Cooperative profile has been updated";

  const heading = isImageUpdate
    ? "Your profile photo has been updated!"
    : "Your profile has been updated!";

  const description = isImageUpdate
    ? "Your profile photo on the Rochester Doula Cooperative website has been successfully updated and is now live."
    : "Your public doula profile on the Rochester Doula Cooperative website has been successfully updated and is now live.";

  // Construct email
  const emailMessage: MailgunMessageData = {
    from: `Rochester Doula Cooperative <${NO_REPLY_EMAIL}>`,
    to: memberData.email,
    subject,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h2 style="color: #2c5282; margin-top: 0;">${heading}</h2>

    <p>Hello${memberData.name ? ` ${memberData.name}` : ""},</p>

    <p>${description}</p>

    <p style="text-align: center; margin: 30px 0;">
      <a href="${profileUrl}"
         style="display: inline-block; background-color: #4299e1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
        View Your Profile
      </a>
    </p>

    <p style="font-size: 14px; color: #666;">
      If you did not make this update or notice any issues with your profile, please contact us at
      <a href="mailto:${MARK_EMAIL}" style="color: #4299e1;">${MARK_EMAIL}</a>.
    </p>
  </div>

  <p style="font-size: 12px; color: #999; text-align: center;">
    This is an automated notification from the Rochester Doula Cooperative.
  </p>
</body>
</html>`,
  };

  // Send email (skip in emulator mode)
  if (process.env["FUNCTIONS_EMULATOR"]) {
    logger.info("Emulator detected, skipping email dispatch");
    logger.info("Would have sent profile update notification", {
      to: memberData.email,
      slug,
      profileUrl,
    });
    response.status(200).send({
      received: true,
      notified: true,
      emulator: true,
    });
    return;
  }

  try {
    await sendEmail(emailMessage, mailgunApiKey);
    logger.info("Profile update notification sent", {
      email: memberData.email,
      slug,
      commitSha,
    });
    response.status(200).send({
      received: true,
      notified: true,
    });
  } catch (error) {
    logger.error("Failed to send profile update notification", {
      error,
      errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_EMAIL_FAILED,
      email: memberData.email,
      slug,
      commitSha,
    });
    response.status(200).send({
      received: true,
      notified: false,
      reason: "email_failed",
    });
  }
}
