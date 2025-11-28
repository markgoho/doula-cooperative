interface RecaptchaVerifyResponse {
  success: boolean;
  score?: number;
  "error-codes"?: string[];
}

export async function verifyRecaptchaToken(
  token: string,
  secretKey: string,
): Promise<{ success: boolean; score: number; error?: string }> {
  const parameters = new URLSearchParams();
  parameters.append("secret", secretKey);
  parameters.append("response", token);

  const response = await fetch(
    "https://www.google.com/recaptcha/api/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: parameters,
    },
  );

  const data = (await response.json()) as RecaptchaVerifyResponse;

  const error = data["error-codes"]?.[0];
  return {
    success: data.success,
    score: data.score ?? 0,
    ...(error ? { error } : {}),
  };
}
