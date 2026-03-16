/**
 * Welcome email status values for member documents.
 * Shared between backend (Firestore documents, API schemas) and frontend (UI display).
 */
export type WelcomeEmailStatus = "sent" | "failed" | "pending";
