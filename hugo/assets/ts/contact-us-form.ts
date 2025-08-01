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
}: {
  contactName: string;
  email: string;
  message: string;
}): Promise<void> {
  const url = "/api/contact-us-form";

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ contactName, email, message }),
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
    submitButton.textContent = "Sending...";
    if (formError) {
      formError.textContent = "";
    }

    try {
      await sendContactForm({
        contactName: contactName.value,
        email: email.value,
        message: message.value,
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
