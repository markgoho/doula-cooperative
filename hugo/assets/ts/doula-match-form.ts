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

  location.href = "/thank-you-for-your-match-request";
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
  const m = Number.parseInt(month, 10);
  const d = Number.parseInt(day, 10);
  const y = Number.parseInt(year, 10);

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
    return {
      isError: true,
      message:
        "The date you entered is outside the typical doula service window. Please enter a date within 1 year past to 2 years in the future.",
    };
  }

  return { isError: false, message: "" };
}

const doSubmit = async () => {
  if (submitButton) {
    submitButton.textContent = "Verifying...";
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
        submitButton.textContent = "Submit Information";
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
      submitButton.textContent = "Sending...";
    }

    // eslint-disable-next-line unicorn/prefer-spread
    const services: string[] = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]:checked:not(#medicaid):not(#carrot)',
      ),
    ).map((checkbox: HTMLInputElement) => checkbox.id);

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
        const label = document.querySelector<HTMLLabelElement>(
          `label[for="${selectedBirthLocationRadio.id}"]`,
        );
        const labelText = label?.textContent;
        birthLocation = labelText
          ? labelText.trim()
          : selectedBirthLocationRadio.id;
      }
    }

    // eslint-disable-next-line unicorn/prefer-spread
    const insurance: string[] = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"][id="medicaid"]:checked, input[type="checkbox"][id="carrot"]:checked',
      ),
    ).map((checkbox: HTMLInputElement) => checkbox.id);

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
    };

    // console.log(formData);
    await sendMatchForm(formData);
  } catch (error) {
    console.error("Failed to send match form:", error);
    if (formError) {
      formError.textContent =
        "Sorry, there was an error sending your message. Please try again later.";
      formError.style.display = "block";
    }
    if (submitButton) {
      submitButton.textContent = "Submit Information";
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

// eslint-disable-next-line unicorn/no-array-for-each
birthLocationRadios.forEach(radio => {
  radio.addEventListener("change", () => {
    if (otherHospitalInputContainer) {
      otherHospitalInputContainer.style.display = otherHospitalRadio?.checked
        ? "block"
        : "none";
    }
  });
});
