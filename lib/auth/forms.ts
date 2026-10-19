export type AuthState = {
  error?: string;
  success?: boolean;
  retryAfter?: number;
  fields?: Partial<
    Record<
      "email" | "currentPassword" | "password" | "confirmPassword" | "pseudo",
      string
    >
  >;
  values?: { email: string; pseudo: string };
};

const FORBIDDEN_PSEUDO_CHARACTERS = /[/\\?#%<>\p{Cc}]/u;

export function normalizeReferralCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase();
  return /^[a-f0-9]{12}$/.test(code) ? code : null;
}

export function pseudoValidationError(pseudo: string) {
  const length = [...pseudo].length;
  if (length < 3) return "Choose a username with at least 3 characters.";
  if (length > 30) return "Choose a username with no more than 30 characters.";
  if (FORBIDDEN_PSEUDO_CHARACTERS.test(pseudo)) {
    return "Your username can't contain / \\ ? # % < > or control characters.";
  }
  return undefined;
}

export function validateCredentials(form: FormData, signup: boolean) {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const email = text("email").trim();
  const password = text("password"); // Password whitespace is meaningful.
  const pseudo = text("pseudo").trim();
  const fields: NonNullable<AuthState["fields"]> = {};
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fields.email = "Enter a valid email address.";
  }
  if (!password || (signup && (password.length < 8 || password.length > 128))) {
    fields.password = signup
      ? "Choose a password with 8–128 characters."
      : "Enter your password.";
  }
  const pseudoError = signup ? pseudoValidationError(pseudo) : undefined;
  if (pseudoError) fields.pseudo = pseudoError;
  return {
    email,
    password,
    pseudo,
    fields,
    valid: Object.keys(fields).length === 0
  };
}

export function validateEmail(form: FormData) {
  const value = form.get("email");
  const email = typeof value === "string" ? value.trim() : "";
  return {
    email,
    error:
      email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? undefined
        : "Enter a valid email address."
  };
}

export function validateNewPassword(form: FormData) {
  const passwordValue = form.get("password");
  const confirmationValue = form.get("confirmPassword");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const confirmation =
    typeof confirmationValue === "string" ? confirmationValue : "";
  const fields: NonNullable<AuthState["fields"]> = {};
  if (password.length < 8 || password.length > 128) {
    fields.password = "Choose a password with 8–128 characters.";
  }
  if (confirmation !== password) {
    fields.confirmPassword = "The passwords don't match.";
  }
  return { password, fields, valid: Object.keys(fields).length === 0 };
}

export function validatePasswordChange(form: FormData) {
  const currentValue = form.get("currentPassword");
  const currentPassword = typeof currentValue === "string" ? currentValue : "";
  const next = validateNewPassword(form);
  const fields = { ...next.fields };
  if (!currentPassword) fields.currentPassword = "Enter your current password.";
  if (currentPassword && currentPassword === next.password) {
    fields.password =
      "Your new password must be different from your current one.";
  }
  return {
    currentPassword,
    password: next.password,
    fields,
    valid: Object.keys(fields).length === 0
  };
}

export function authError(code?: string, status?: number) {
  switch (code) {
    case "captcha_failed":
      return "Bot verification failed or expired. Complete verification again before resubmitting the form.";
    case "user_banned":
      return "Your account is banned.";
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Confirm your email address before signing in.";
    case "weak_password":
      return "This password is too weak. Choose a longer one with more variety.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "Too many attempts. Wait a few minutes before trying again.";
    case "user_already_exists":
    case "email_exists":
      return "This email address is already in use. Try signing in.";
    case "email_address_invalid":
      return "This email address is invalid.";
    case "email_address_not_authorized":
      return "This email address can't be used to sign up.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "Sign-ups are temporarily disabled.";
    case "request_timeout":
    case "unexpected_failure":
      return "Sign-in is temporarily unavailable. Please try again in a moment.";
    default:
      return !code || (status !== undefined && status >= 500)
        ? "Sign-in is temporarily unavailable. Please try again in a moment."
        : "Authentication was declined. Check your details and try again.";
  }
}

// GoTrue uses the same code for the shared budget and the per-address cooldown.
// Match its fixed messages, but never expose SMTP/provider details to the player.
export function authEmailError(error: unknown) {
  if (typeof error !== "object" || error === null) return authError();
  const code =
    "code" in error && typeof error.code === "string" ? error.code : undefined;
  const status =
    "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  if (code === "over_email_send_rate_limit") {
    return /^For security purposes, you can only request this /.test(message)
      ? authError("over_request_rate_limit")
      : "The service has reached its email sending limit. Try again later; this isn't an issue with your address.";
  }
  if (
    (code === "unexpected_failure" || (status ?? 0) >= 500) &&
    /^Error sending (confirmation|recovery) email$/.test(message)
  ) {
    return "Email delivery is temporarily unavailable. Please try again later.";
  }
  return authError(code, status);
}

export function captchaOptions(form: FormData, siteKey?: string) {
  if (!siteKey) return {};
  const tokens = form.getAll("cf-turnstile-response");
  const token = tokens[0];
  if (
    tokens.length !== 1 ||
    typeof token !== "string" ||
    !token ||
    token.length > 2048 ||
    token !== token.trim()
  )
    return undefined;
  return { captchaToken: token };
}
