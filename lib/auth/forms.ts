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

export function pseudoValidationError(pseudo: string) {
  const length = [...pseudo].length;
  if (length < 3) return "Choisissez un pseudo d’au moins 3 caractères.";
  if (length > 30) return "Choisissez un pseudo de 30 caractères maximum.";
  if (FORBIDDEN_PSEUDO_CHARACTERS.test(pseudo)) {
    return "Le pseudo ne peut pas contenir / \\ ? # % < > ni de caractères de contrôle.";
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
    fields.email = "Indiquez une adresse email valide.";
  }
  if (!password || (signup && (password.length < 8 || password.length > 128))) {
    fields.password = signup
      ? "Choisissez un mot de passe de 8 à 128 caractères."
      : "Indiquez votre mot de passe.";
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
        : "Indiquez une adresse email valide."
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
    fields.password = "Choisissez un mot de passe de 8 à 128 caractères.";
  }
  if (confirmation !== password) {
    fields.confirmPassword = "Les deux mots de passe ne correspondent pas.";
  }
  return { password, fields, valid: Object.keys(fields).length === 0 };
}

export function validatePasswordChange(form: FormData) {
  const currentValue = form.get("currentPassword");
  const currentPassword = typeof currentValue === "string" ? currentValue : "";
  const next = validateNewPassword(form);
  const fields = { ...next.fields };
  if (!currentPassword)
    fields.currentPassword = "Indiquez votre mot de passe actuel.";
  if (currentPassword && currentPassword === next.password) {
    fields.password =
      "Le nouveau mot de passe doit être différent de l’actuel.";
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
      return "La vérification anti-robot a échoué ou a expiré. Réessaie la vérification avant de renvoyer le formulaire.";
    case "user_banned":
      return "Votre compte est banni.";
    case "invalid_credentials":
      return "Email ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Confirmez votre adresse email avant de vous connecter.";
    case "weak_password":
      return "Ce mot de passe est trop faible. Choisissez-en un plus long et plus varié.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
    case "user_already_exists":
    case "email_exists":
      return "Cette adresse email est déjà utilisée. Essayez de vous connecter.";
    case "email_address_invalid":
      return "Cette adresse email n’est pas valide.";
    case "email_address_not_authorized":
      return "Cette adresse email n’est pas autorisée à s’inscrire.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "Les inscriptions sont temporairement désactivées.";
    case "request_timeout":
    case "unexpected_failure":
      return "Le service de connexion est momentanément indisponible. Réessayez dans un instant.";
    default:
      return !code || (status !== undefined && status >= 500)
        ? "Le service de connexion est momentanément indisponible. Réessayez dans un instant."
        : "La demande d’authentification a été refusée. Vérifiez vos informations et réessayez.";
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
      : "La limite d’envoi d’e-mails du service est atteinte. Réessaie plus tard ; ton adresse n’est pas en cause.";
  }
  if (
    (code === "unexpected_failure" || (status ?? 0) >= 500) &&
    /^Error sending (confirmation|recovery) email$/.test(message)
  ) {
    return "Le service d’envoi d’e-mails est momentanément indisponible. Réessaie plus tard.";
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
