export type AuthState = {
  error?: string;
  success?: boolean;
  fields?: Partial<Record<"email" | "password" | "pseudo", string>>;
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
    fields.password = signup ? "Choisissez un mot de passe de 8 à 128 caractères." : "Indiquez votre mot de passe.";
  }
  const pseudoError = signup ? pseudoValidationError(pseudo) : undefined;
  if (pseudoError) fields.pseudo = pseudoError;
  return { email, password, pseudo, fields, valid: Object.keys(fields).length === 0 };
}

export function authError(code?: string, status?: number) {
  switch (code) {
    case "user_banned": return "Votre compte est banni.";
    case "invalid_credentials": return "Email ou mot de passe incorrect.";
    case "email_not_confirmed": return "Confirmez votre adresse email avant de vous connecter.";
    case "weak_password": return "Ce mot de passe est trop faible. Choisissez-en un plus long et plus varié.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit": return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
    case "user_already_exists":
    case "email_exists": return "Cette adresse email est déjà utilisée. Essayez de vous connecter.";
    case "email_address_invalid": return "Cette adresse email n’est pas valide.";
    case "email_address_not_authorized": return "Cette adresse email n’est pas autorisée à s’inscrire.";
    case "signup_disabled":
    case "email_provider_disabled": return "Les inscriptions sont temporairement désactivées.";
    case "request_timeout":
    case "unexpected_failure": return "Le service de connexion est momentanément indisponible. Réessayez dans un instant.";
    default:
      return !code || (status !== undefined && status >= 500)
        ? "Le service de connexion est momentanément indisponible. Réessayez dans un instant."
        : "La demande d’authentification a été refusée. Vérifiez vos informations et réessayez.";
  }
}
