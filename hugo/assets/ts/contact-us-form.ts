const contactForm: HTMLFormElement | null = document.querySelector(".form");
const contactName: HTMLInputElement | null = document.querySelector("#name");
const email: HTMLInputElement | null = document.querySelector("#email");
const message: HTMLTextAreaElement | null = document.querySelector("#message");
const submitButton: HTMLButtonElement | null =
  document.querySelector("#submit-button");
const formError: HTMLDivElement | null = document.querySelector("#form-error");

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
  if (contactName?.value && email?.value && message?.value && submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Verifying...";
    if (formError) {
      formError.textContent = "";
    }

    try {
      // Get reCAPTCHA site key from form data attribute
      const siteKey = contactForm?.dataset["recaptchaSiteKey"];
      if (!siteKey) {
        throw new Error("reCAPTCHA site key not found");
      }

      // Get reCAPTCHA token
      const recaptchaToken = await globalThis.grecaptcha.execute(siteKey, {
        action: "contact_form_submit",
      });

      submitButton.textContent = "Sending...";

      await sendContactForm({
        contactName: contactName.value,
        email: email.value,
        message: message.value,
        recaptchaToken,
      });
    } catch (error) {
      console.error("Failed to send contact form:", error);
      if (formError) {
        formError.textContent =
          "Sorry, there was an error sending your message. Please try again later.";
      }
      submitButton.disabled = false;
      submitButton.textContent = "Submit";
    }
  }
};

if (submitButton) {
  submitButton.addEventListener("click", (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    void doSubmit();
  });
}
