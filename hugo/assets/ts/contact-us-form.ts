import { isDoulaRequest } from "./detect-doula-request.js";

const contactForm: HTMLFormElement | null = document.querySelector(".form");
const contactName: HTMLInputElement | null = document.querySelector("#name");
const email: HTMLInputElement | null = document.querySelector("#email");
const message: HTMLTextAreaElement | null = document.querySelector("#message");
const website: HTMLInputElement | null = document.querySelector("#website");
const submitButton: HTMLButtonElement | null =
  document.querySelector("#submit-button");
const formLoadedAt = Date.now();
const formError: HTMLDivElement | null = document.querySelector("#form-error");
const doulaRedirectNotice: HTMLDivElement | null = document.querySelector(
  "#doula-redirect-notice",
);
const doulaRedirectAnnouncement: HTMLDivElement | null = document.querySelector(
  "#doula-redirect-announcement",
);
const dismissDoulaNoticeButton: HTMLButtonElement | null =
  document.querySelector("#dismiss-doula-notice");
function getFormText(key: keyof DOMStringMap, fallback: string): string {
  return contactForm?.dataset[key] ?? fallback;
}

function getAnnouncementText(): string {
  return getFormText(
    "textDoulaAnnouncement",
    "Looking for doula support? Use the doula match form, or dismiss this notice to continue.",
  );
}

const doulaNoticeState = { overridden: false };

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
      doulaRedirectAnnouncement.textContent = getAnnouncementText();
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
  doulaNoticeState.overridden = false;
}

function maybeHideDoulaRedirectNotice(): void {
  if (!message || isDoulaRequest(message.value)) {
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
  submitButton.textContent = getFormText("textSubmit", "Submit");
}

function beginSubmit(): void {
  if (!submitButton) {
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = getFormText("textVerifying", "Verifying...");
}

function showSubmissionError(): void {
  if (formError) {
    formError.textContent = getFormText(
      "textGenericError",
      "Sorry, there was an error sending your message. Please try again later.",
    );
  }

  resetSubmitButton();
}

function updateSubmitButtonToSending(): void {
  if (submitButton) {
    submitButton.textContent = getFormText("textSending", "Sending...");
  }
}

function handleMessageInput(): void {
  resetDoulaNoticeOverride();
  maybeHideDoulaRedirectNotice();
}

function handleDismissDoulaNotice(): void {
  doulaNoticeState.overridden = true;
  hideDoulaRedirectNotice();
}

function shouldBlockForDoulaRequest(): boolean {
  return Boolean(
    message && isDoulaRequest(message.value) && !doulaNoticeState.overridden,
  );
}

function shouldProceedWithSubmit(): boolean {
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
  const siteKey = contactForm?.dataset.recaptchaSiteKey;
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
    website: website?.value ?? "",
    formLoadedAt,
  });
}

function handleSubmitError(error: unknown): void {
  console.error("Failed to send contact form:", error);
  showSubmissionError();
}

function shouldSubmit(): boolean {
  return Boolean(submitButton && shouldProceedWithSubmit());
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
  website,
  formLoadedAt,
}: {
  contactName: string;
  email: string;
  message: string;
  recaptchaToken: string;
  website: string;
  formLoadedAt: number;
}): Promise<void> {
  const url = contactForm?.dataset.apiUrl;
  if (!url) {
    throw new Error("API URL not found");
  }

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({
      contactName,
      email,
      message,
      recaptchaToken,
      website,
      formLoadedAt,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${String(response.status)}`);
  }

  const successUrl =
    contactForm.dataset.successUrl ?? "/thank-you-for-contacting-us/";
  location.assign(successUrl);
}

const doSubmit = async () => {
  if (!shouldSubmit()) {
    return;
  }

  try {
    await submitContactForm();
  } catch (error) {
    handleSubmitError(error);
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
