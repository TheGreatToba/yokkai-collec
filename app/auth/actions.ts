"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  authError,
  authEmailError,
  captchaOptions,
  pseudoValidationError,
  validateCredentials,
  validateEmail,
  validateNewPassword,
  validatePasswordChange,
  type AuthState
} from "@/lib/auth/forms";

function configuredSiteOrigin() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  try {
    const site = new URL(configuredUrl);
    const secureProtocol =
      process.env.NODE_ENV === "production"
        ? site.protocol === "https:"
        : ["http:", "https:"].includes(site.protocol);
    if (!secureProtocol || site.username || site.password) return undefined;
    return site.origin;
  } catch {
    return undefined;
  }
}

function errorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error))
    return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function errorStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error))
    return undefined;
  return typeof error.status === "number" ? error.status : undefined;
}

function redactAuthDiagnostic(message: string) {
  // Captcha details may contain an opaque token without a predictable label.
  if (/captcha|turnstile/i.test(message)) return "[captcha details redacted]";
  return message
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email redacted]")
    .replace(
      /(?<![\w])(?:[a-f0-9]{0,4}:){2,}[a-f0-9:.]*(?:%[\w.-]+)?/gi,
      "[IP redacted]"
    )
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP redacted]")
    .replace(/[A-Za-z0-9_.~-]{40,}/g, "[token redacted]");
}

function authErrorDiagnostic(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return {
      code: undefined,
      status: undefined,
      kind: typeof error,
      message: redactAuthDiagnostic(String(error))
    };
  }
  const status = "status" in error ? error.status : undefined;
  const name = "name" in error ? error.name : undefined;
  const message = "message" in error ? error.message : undefined;
  return {
    code: errorCode(error),
    status: typeof status === "number" ? status : undefined,
    kind: typeof name === "string" ? name : "object",
    // Keep useful provider diagnostics without email, IP or captcha details.
    message:
      typeof message === "string" ? redactAuthDiagnostic(message) : undefined
  };
}

function logAuthErrorInDevelopment(
  operation: "sign-in" | "sign-up",
  error: unknown
) {
  if (process.env.NODE_ENV !== "production") {
    console.error(
      `Authentication ${operation} failed`,
      authErrorDiagnostic(error)
    );
  }
}

async function checkPseudoAvailability(
  supabase: ReturnType<typeof createClient>,
  pseudo: string
) {
  const { data, error } = await supabase.rpc("is_pseudo_available", {
    p_pseudo: pseudo
  });
  if (error) {
    logAuthErrorInDevelopment("sign-up", error);
    return undefined;
  }
  return data === true;
}

export async function checkPseudoAvailabilityWhileTyping(pseudo: string) {
  const cleanPseudo = pseudo.trim();
  if (pseudoValidationError(cleanPseudo)) return undefined;
  try {
    const supabase = createClient(await cookies());
    return await checkPseudoAvailability(supabase, cleanPseudo);
  } catch (error) {
    logAuthErrorInDevelopment("sign-up", error);
    return undefined;
  }
}

function isTransientNetworkError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const name =
    "name" in error && typeof error.name === "string" ? error.name : "";
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  return name === "TypeError" || /fetch|network|timeout|socket/i.test(message);
}

export async function signIn(
  _state: AuthState,
  form: FormData
): Promise<AuthState> {
  const input = validateCredentials(form, false);
  const values = { email: input.email, pseudo: "" };
  if (!input.valid) return { fields: input.fields, values };
  const captcha = captchaOptions(
    form,
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
  if (!captcha) return { error: authError("captcha_failed"), values };
  try {
    const supabase = createClient(await cookies());
    const credentials = {
      email: input.email,
      password: input.password,
      options: captcha
    };
    let result;
    try {
      result = await supabase.auth.signInWithPassword(credentials);
    } catch (error) {
      // A short-lived connection reset should not force the user to submit the form again.
      if (captcha.captchaToken || !isTransientNetworkError(error)) throw error;
      result = await supabase.auth.signInWithPassword(credentials);
    }
    const { error } = result;
    if (error) return { error: authError(error.code, error.status), values };
  } catch (error) {
    logAuthErrorInDevelopment("sign-in", error);
    return { error: authError(errorCode(error), errorStatus(error)), values };
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(
  _state: AuthState,
  form: FormData
): Promise<AuthState> {
  const input = validateCredentials(form, true);
  const values = { email: input.email, pseudo: input.pseudo };
  if (!input.valid) return { fields: input.fields, values };
  const captcha = captchaOptions(
    form,
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
  if (!captcha) return { error: authError("captcha_failed"), values };
  let hasSession = false;
  try {
    // Use a configured origin, never an untrusted Host/next query parameter.
    const siteOrigin = configuredSiteOrigin();
    if (!siteOrigin) {
      return { error: authError(), values };
    }
    const supabase = createClient(await cookies());
    const pseudoAvailable = await checkPseudoAvailability(
      supabase,
      input.pseudo
    );
    if (pseudoAvailable === false) {
      return {
        fields: { pseudo: "That username is already taken. Try another one." },
        values
      };
    }
    if (pseudoAvailable === undefined) return { error: authError(), values };
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        ...captcha,
        data: { pseudo: input.pseudo },
        emailRedirectTo: `${siteOrigin}/auth/confirm`
      }
    });
    if (error) {
      logAuthErrorInDevelopment("sign-up", error);
      if (error.code === "unexpected_failure") {
        const availableAfterFailure = await checkPseudoAvailability(
          supabase,
          input.pseudo
        );
        if (availableAfterFailure === false) {
          return {
            fields: {
              pseudo: "That username is already taken. Try another one."
            },
            values
          };
        }
      }
      return { error: authEmailError(error), values };
    }
    hasSession = Boolean(data.session);
  } catch (error) {
    logAuthErrorInDevelopment("sign-up", error);
    return { error: authEmailError(error), values };
  }
  if (!hasSession) return { success: true, values, retryAfter: 60 };
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(
  _state: AuthState,
  form: FormData
): Promise<AuthState> {
  const { email, error } = validateEmail(form);
  const values = { email, pseudo: "" };
  if (error) return { fields: { email: error }, values };
  const captcha = captchaOptions(
    form,
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
  if (!captcha) return { error: authError("captcha_failed"), values };
  const siteOrigin = configuredSiteOrigin();
  if (!siteOrigin) return { error: authError(), values };
  try {
    const supabase = createClient(await cookies());
    const result = await supabase.auth.resetPasswordForEmail(email, {
      ...captcha,
      redirectTo: `${siteOrigin}/auth/confirm?next=/reset-password`
    });
    if (result.error && result.error.code !== "user_not_found") {
      return {
        error: authEmailError(result.error),
        values
      };
    }
  } catch (error) {
    return { error: authEmailError(error), values };
  }
  // Do not reveal whether the address belongs to an account.
  return { success: true, values };
}

export async function resendConfirmation(
  _state: AuthState,
  form: FormData
): Promise<AuthState> {
  const { email, error } = validateEmail(form);
  const values = { email, pseudo: "" };
  if (error) return { fields: { email: error }, values };
  const captcha = captchaOptions(
    form,
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
  if (!captcha) return { error: authError("captcha_failed"), values };
  const siteOrigin = configuredSiteOrigin();
  if (!siteOrigin) return { error: authError(), values };
  try {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { ...captcha, emailRedirectTo: siteOrigin + "/auth/confirm" }
    });
    // Auth already returns success for missing/confirmed accounts; retain neutrality.
    if (error && error.code !== "user_not_found") {
      return { error: authEmailError(error), values, retryAfter: 60 };
    }
  } catch (error) {
    return { error: authEmailError(error), values, retryAfter: 60 };
  }
  return { success: true, values, retryAfter: 60 };
}

export async function updateRecoveredPassword(
  _state: AuthState,
  form: FormData
): Promise<AuthState> {
  const input = validateNewPassword(form);
  if (!input.valid) return { fields: input.fields };
  try {
    const supabase = createClient(await cookies());
    const {
      data: { user },
      error: sessionError
    } = await supabase.auth.getUser();
    if (sessionError || !user) {
      return { error: "This password reset link is invalid or has expired." };
    }
    const { error } = await supabase.auth.updateUser({
      password: input.password
    });
    if (error) return { error: authError(error.code, error.status) };
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    return { error: authError() };
  }
  revalidatePath("/", "layout");
  redirect("/login?mot-de-passe=modifie");
}

export async function changePassword(
  _state: AuthState,
  form: FormData
): Promise<AuthState> {
  const input = validatePasswordChange(form);
  if (!input.valid) return { fields: input.fields };
  const captcha = captchaOptions(
    form,
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
  if (!captcha) return { error: authError("captcha_failed") };
  try {
    const supabase = createClient(await cookies());
    const {
      data: { user },
      error: sessionError
    } = await supabase.auth.getUser();
    if (sessionError || !user?.email)
      return {
        error: "Your session has expired. Sign in again and retry."
      };

    const verification = await supabase.auth.signInWithPassword({
      email: user.email,
      password: input.currentPassword,
      options: captcha
    });
    if (verification.error?.code === "invalid_credentials") {
      return {
        fields: { currentPassword: "Incorrect current password." }
      };
    }
    if (verification.error)
      return {
        error: authError(verification.error.code, verification.error.status)
      };
    if (verification.data.user?.id !== user.id) return { error: authError() };

    const { error } = await supabase.auth.updateUser({
      password: input.password
    });
    if (error) return { error: authError(error.code, error.status) };
  } catch (error) {
    return { error: authError(errorCode(error), errorStatus(error)) };
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function signOut(): Promise<AuthState> {
  try {
    const supabase = createClient(await cookies());
    await supabase.rpc("mark_offline");
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { error: "Couldn't sign out. Please try again." };
  } catch {
    return { error: "Couldn't sign out. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
