import { detectDoulaRequest } from "./detect-doula-request.js";

const contactForm: HTMLFormElement | null = document.querySelector(".form");
const contactName: HTMLInputElement | null = document.querySelector("#name");
const email: HTMLInputElement | null = document.querySelector("#email");
const message: HTMLTextAreaElement | null = document.querySelector("#message");
const submitButton: HTMLButtonElement | null =
  document.querySelector("#submit-button");
const formError: HTMLDivElement | null = document.querySelector("#form-error");
const doulaRedirectNotice: HTMLDivElement | null = document.querySelector(
  "#doula-redirect-notice",
);
const doulaRedirectAnnouncement: HTMLDivElement | null = document.querySelector(
  "#doula-redirect-announcement",
);
const dismissDoulaNoticeButton: HTMLButtonElement | null =
  document.querySelector("#dismiss-doula-notice");
const announcementText =
  "Looking for doula support? Use the doula match form, or dismiss this notice to continue.";

let doulaNoticeOverridden = false;

function showDoulaRedirectNotice(): void {
  if (!doulaRedirectNotice) {
    return;
  }

  if (doulaRedirectAnnouncement) {
    doulaRedirectAnnouncement.textContent = "";
  }

  doulaRedirectNotice.hidden = false;
  doulaRedirectNotice.scrollIntoView({ behavior: "smooth", block: "nearest" });

  if (doulaRedirectAnnouncement) {
    requestAnimationFrame(() => {
      doulaRedirectAnnouncement.textContent = announcementText;
    });
  }
}

function hideDoulaRedirectNotice(): void {
  if (!doulaRedirectNotice) {
    return;
  }

  doulaRedirectNotice.hidden = true;
  if (doulaRedirectAnnouncement) {
    doulaRedirectAnnouncement.textContent = "";
  }
}

function resetDoulaNoticeOverride(): void {
  doulaNoticeOverridden = false;
}

function maybeHideDoulaRedirectNotice(): void {
  if (!message || detectDoulaRequest(message.value)) {
    return;
  }

  hideDoulaRedirectNotice();
}

function hasRequiredFields(): boolean {
  return Boolean(contactName?.value && email?.value && message?.value);
}

function showValidationState(): void {
  contactForm?.classList.add("was-validated");
}

function clearValidationState(): void {
  contactForm?.classList.remove("was-validated");
}

function clearFormError(): void {
  if (formError) {
    formError.textContent = "";
  }
}

function resetSubmitButton(): void {
  if (!submitButton) {
    return;
  }

  submitButton.disabled = false;
  submitButton.textContent = "Submit";
}

function beginSubmit(): void {
  if (!submitButton) {
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Verifying...";
}

function showSubmissionError(): void {
  if (formError) {
    formError.textContent =
      "Sorry, there was an error sending your message. Please try again later.";
  }

  resetSubmitButton();
}

function updateSubmitButtonToSending(): void {
  if (submitButton) {
    submitButton.textContent = "Sending...";
  }
}

function handleMessageInput(): void {
  resetDoulaNoticeOverride();
  maybeHideDoulaRedirectNotice();
}

function handleDismissDoulaNotice(): void {
  doulaNoticeOverridden = true;
  hideDoulaRedirectNotice();
}

function shouldBlockForDoulaRequest(): boolean {
  return Boolean(
    message && detectDoulaRequest(message.value) && !doulaNoticeOverridden,
  );
}

function prepareForSubmit(): boolean {
  showValidationState();

  if (!hasRequiredFields()) {
    return false;
  }

  clearValidationState();
  clearFormError();

  if (shouldBlockForDoulaRequest()) {
    showDoulaRedirectNotice();
    return false;
  }

  hideDoulaRedirectNotice();
  beginSubmit();
  return true;
}

async function getRecaptchaToken(): Promise<string> {
  const siteKey = contactForm?.dataset["recaptchaSiteKey"];
  if (!siteKey) {
    throw new Error("reCAPTCHA site key not found");
  }

  return globalThis.grecaptcha.execute(siteKey, {
    action: "contact_form_submit",
  });
}

async function submitContactForm(): Promise<void> {
  if (!contactName || !email || !message) {
    return;
  }

  const recaptchaToken = await getRecaptchaToken();
  updateSubmitButtonToSending();

  await sendContactForm({
    contactName: contactName.value,
    email: email.value,
    message: message.value,
    recaptchaToken,
  });
}

async function handleSubmitError(error: unknown): Promise<void> {
  console.error("Failed to send contact form:", error);
  showSubmissionError();
}

function shouldSubmit(): boolean {
  return Boolean(submitButton && prepareForSubmit());
}

function handleSubmitClick(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  void doSubmit();
}

async function sendContactForm({
  contactName,
  email,
  message,
  recaptchaToken,
}: {
  contactName: string;
  email: string;
  message: string;
  recaptchaToken: string;
}): Promise<void> {
  const url = contactForm?.dataset["apiUrl"];
  if (!url) {
    throw new Error("API URL not found");
  }

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ contactName, email, message, recaptchaToken }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${String(response.status)}`);
  }

  location.href = "/thank-you-for-contacting-us";
}

const doSubmit = async () => {
  if (!shouldSubmit()) {
    return;
  }

  try {
    await submitContactForm();
  } catch (error) {
    await handleSubmitError(error);
  }
};

if (dismissDoulaNoticeButton) {
  dismissDoulaNoticeButton.addEventListener("click", handleDismissDoulaNotice);
}

if (message) {
  message.addEventListener("input", handleMessageInput);
}

if (submitButton) {
  submitButton.addEventListener("click", handleSubmitClick);
}
