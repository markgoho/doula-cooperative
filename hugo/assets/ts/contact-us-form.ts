const contactName: HTMLInputElement | null = document.querySelector("#name");
const email: HTMLInputElement | null = document.querySelector("#email");
const message: HTMLTextAreaElement | null = document.querySelector("#message");
const submitButton: HTMLButtonElement | null =
  document.querySelector("#submit-button");

async function sendContactForm({
  contactName,
  email,
  message,
}: {
  contactName: string;
  email: string;
  message: string;
}): Promise<void> {
  const url = "//api/contact-us-form";

  await fetch(url, {
    method: "POST",
    body: JSON.stringify({ contactName, email, message }),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

const doSubmit = async () => {
  if (contactName?.value && email?.value && message?.value) {
    await sendContactForm({
      contactName: contactName.value,
      email: email.value,
      message: message.value,
    });
  }
};

if (submitButton) {
  submitButton.addEventListener("click", (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    void doSubmit();
  });
}
