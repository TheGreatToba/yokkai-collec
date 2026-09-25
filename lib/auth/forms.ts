export type AuthState = {
  error?: string;
  success?: boolean;
  fields?: Partial<Record<"email" | "password" | "pseudo", string>>;
  values?: { email: string; pseudo: string };
};

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
  if (signup && (!pseudo || pseudo.length > 30)) {
    fields.pseudo = "Choisissez un pseudo de 1 à 30 caractères.";
  }
  return { email, password, pseudo, fields, valid: Object.keys(fields).length === 0 };
}

export function authError(code?: string) {
  switch (code) {
    case "invalid_credentials": return "Email ou mot de passe incorrect.";
    case "email_not_confirmed": return "Confirmez votre adresse email avant de vous connecter.";
    case "weak_password": return "Ce mot de passe est trop faible. Choisissez-en un plus long et plus varié.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit": return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
    case "user_already_exists":
    case "email_exists": return "Impossible de créer ce compte. Essayez de vous connecter si vous avez déjà un compte.";
    default: return "Le service de connexion est momentanément indisponible. Réessayez dans un instant.";
  }
}
