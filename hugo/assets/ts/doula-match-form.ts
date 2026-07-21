const matchForm: HTMLFormElement | null = document.querySelector(".form");
const contactName: HTMLInputElement | null = document.querySelector("#name");
const phone: HTMLInputElement | null = document.querySelector("#phone");
const email: HTMLInputElement | null = document.querySelector("#email");
const zipcode: HTMLInputElement | null = document.querySelector("#zipcode");
const month: HTMLInputElement | null = document.querySelector("#month");
const day: HTMLInputElement | null = document.querySelector("#day");
const year: HTMLInputElement | null = document.querySelector("#year");
const otherInfo: HTMLTextAreaElement | null =
  document.querySelector("#other-info");
const submitButton: HTMLButtonElement | null = document.querySelector(
  'button[type="submit"]',
);
const formError: HTMLDivElement | null = document.querySelector("#form-error");

interface DoulaMatchFormRequest {
  name?: string;
  phone: string;
  email: string;
  zipcode: string;
  estimatedDueDate: {
    month: string;
    day: string;
    year: string;
  };
  services: string[];
  birthLocation: string;
  otherInfo: string;
  insurance: string[];
  otherHospitalName?: string;
  recaptchaToken: string;
  locale?: string;
}

async function sendMatchForm(data: DoulaMatchFormRequest): Promise<void> {
  const url = matchForm?.dataset.apiUrl;
  if (!url) {
    throw new Error("API URL not found");
  }

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${String(response.status)}`);
  }

  const successUrl =
    matchForm.dataset.successUrl ?? "/thank-you-for-your-match-request/";
  location.assign(successUrl);
}

function validateDueDateRange(
  month: string,
  day: string,
  year: string,
): { isError: boolean; message: string } {
  // If any field is empty, don't validate (date is optional)
  if (!month || !day || !year) {
    return { isError: false, message: "" };
  }

  // Parse numeric values
  const m = Number(month);
  const d = Number(day);
  const y = Number(year);

  // Construct date (month is 0-indexed in JavaScript Date)
  const enteredDate = new Date(y, m - 1, d);

  // Check if date is invalid
  if (Number.isNaN(enteredDate.getTime())) {
    return { isError: false, message: "" };
  }

  // Calculate date bounds
  const now = new Date();
  const oneYearAgo = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate(),
  );
  const twoYearsFromNow = new Date(
    now.getFullYear() + 2,
    now.getMonth(),
    now.getDate(),
  );

  // Check if date is outside acceptable range
  if (enteredDate < oneYearAgo || enteredDate > twoYearsFromNow) {
    const dateRangeError =
      matchForm?.dataset.textDateRangeError ??
      "The date you entered is outside the typical doula service window. Please enter a date within 1 year past to 2 years in the future.";
    return {
      isError: true,
      message: dateRangeError,
    };
  }

  return { isError: false, message: "" };
}

const doSubmit = async () => {
  const textVerifying = matchForm?.dataset.textVerifying ?? "Verifying...";
  const textSending = matchForm?.dataset.textSending ?? "Sending...";
  const textSubmit = matchForm?.dataset.textSubmit ?? "Submit Information";

  if (submitButton) {
    submitButton.textContent = textVerifying;
  }
  if (formError) {
    formError.textContent = "";
    formError.style.display = "none";
  }

  try {
    // Validate due date range
    const dateValidation = validateDueDateRange(
      month?.value ?? "",
      day?.value ?? "",
      year?.value ?? "",
    );

    if (dateValidation.isError) {
      if (formError) {
        formError.textContent = dateValidation.message;
        formError.style.display = "block";
      }
      if (submitButton) {
        submitButton.textContent = textSubmit;
      }
      return;
    }

    // Get reCAPTCHA site key from form data attribute
    const siteKey = matchForm?.dataset.recaptchaSiteKey;
    if (!siteKey) {
      throw new Error("reCAPTCHA site key not found");
    }

    // Get reCAPTCHA token
    const recaptchaToken = await globalThis.grecaptcha.execute(siteKey, {
      action: "doula_match_form_submit",
    });

    if (submitButton) {
      submitButton.textContent = textSending;
    }

    const services: string[] = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]:checked:not(#medicaid):not(#carrot)',
      ),
      checkbox => checkbox.id,
    );

    const selectedBirthLocationRadio = document.querySelector<HTMLInputElement>(
      'input[name="birth-location"]:checked',
    );

    let birthLocation = "n/a";
    if (selectedBirthLocationRadio) {
      if (selectedBirthLocationRadio.id === "other-hospital") {
        const otherHospitalInput = document.querySelector<HTMLInputElement>(
          "#other-hospital-input",
        );
        birthLocation = otherHospitalInput?.value ?? "Other Hospital";
      } else {
        birthLocation = selectedBirthLocationRadio.value;
      }
    }

    const insurance: string[] = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"][id="medicaid"]:checked, input[type="checkbox"][id="carrot"]:checked',
      ),
      checkbox => checkbox.id,
    );

    const localeInput = document.querySelector<HTMLInputElement>(
      'input[name="locale"]',
    );

    const formData: DoulaMatchFormRequest = {
      name: contactName?.value ?? "",
      phone: phone?.value ?? "",
      email: email?.value ?? "",
      zipcode: zipcode?.value ?? "",
      estimatedDueDate: {
        month: month?.value ?? "",
        day: day?.value ?? "",
        year: year?.value ?? "",
      },
      services,
      birthLocation,
      otherInfo: otherInfo?.value ?? "",
      insurance,
      recaptchaToken,
      locale: localeInput?.value ?? undefined,
    };

    // console.log(formData);
    await sendMatchForm(formData);
  } catch (error) {
    console.error("Failed to send match form:", error);
    if (formError) {
      formError.textContent =
        matchForm?.dataset.textGenericError ??
        "Sorry, there was an error sending your message. Please try again later.";
      formError.style.display = "block";
    }
    if (submitButton) {
      submitButton.textContent =
        matchForm?.dataset.textSubmit ?? "Submit Information";
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

const birthDoulaCheckbox =
  document.querySelector<HTMLInputElement>("#birth-doula");
const birthLocationFieldset = document.querySelector<HTMLFieldSetElement>(
  "#birth-location-fieldset",
);
const dynamicLayoutContainer = document.querySelector<HTMLDivElement>(
  ".dynamic-layout-container",
);

if (birthDoulaCheckbox && birthLocationFieldset && dynamicLayoutContainer) {
  birthDoulaCheckbox.addEventListener("change", () => {
    birthLocationFieldset.style.display = birthDoulaCheckbox.checked
      ? "grid"
      : "none";
    dynamicLayoutContainer.classList.toggle(
      "birth-doula-selected",
      birthDoulaCheckbox.checked,
    );
  });
}

const birthLocationRadios = document.querySelectorAll<HTMLInputElement>(
  'input[name="birth-location"]',
);
const otherHospitalInputContainer = document.querySelector<HTMLDivElement>(
  "#other-hospital-input-container",
);
const otherHospitalRadio =
  document.querySelector<HTMLInputElement>("#other-hospital");

for (const radio of birthLocationRadios) {
  radio.addEventListener("change", () => {
    if (otherHospitalInputContainer) {
      otherHospitalInputContainer.style.display = otherHospitalRadio?.checked
        ? "block"
        : "none";
    }
  });
}
