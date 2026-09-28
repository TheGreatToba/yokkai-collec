"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { authError, validateCredentials, type AuthState } from "@/lib/auth/forms";

function errorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function errorStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  return typeof error.status === "number" ? error.status : undefined;
}

function authErrorDiagnostic(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { code: undefined, status: undefined, kind: typeof error, message: String(error) };
  }
  const status = "status" in error ? error.status : undefined;
  const name = "name" in error ? error.name : undefined;
  const message = "message" in error ? error.message : undefined;
  return {
    code: errorCode(error),
    status: typeof status === "number" ? status : undefined,
    kind: typeof name === "string" ? name : "object",
    // Provider messages are useful diagnostically; redact any email-like value defensively.
    message: typeof message === "string"
      ? message.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email redacted]")
      : undefined,
  };
}

function logAuthErrorInDevelopment(operation: "sign-in" | "sign-up", error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`Authentication ${operation} failed`, authErrorDiagnostic(error));
  }
}

async function checkPseudoAvailability(
  supabase: ReturnType<typeof createClient>,
  pseudo: string,
) {
  const { data, error } = await supabase.rpc("is_pseudo_available", { p_pseudo: pseudo });
  if (error) {
    logAuthErrorInDevelopment("sign-up", error);
    return undefined;
  }
  return data === true;
}

function isTransientNetworkError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return name === "TypeError" || /fetch|network|timeout|socket/i.test(message);
}

export async function signIn(_state: AuthState, form: FormData): Promise<AuthState> {
  const input = validateCredentials(form, false);
  const values = { email: input.email, pseudo: "" };
  if (!input.valid) return { fields: input.fields, values };
  try {
    const supabase = createClient(await cookies());
    const credentials = { email: input.email, password: input.password };
    let result;
    try {
      result = await supabase.auth.signInWithPassword(credentials);
    } catch (error) {
      // A short-lived connection reset should not force the user to submit the form again.
      if (!isTransientNetworkError(error)) throw error;
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

export async function signUp(_state: AuthState, form: FormData): Promise<AuthState> {
  const input = validateCredentials(form, true);
  const values = { email: input.email, pseudo: input.pseudo };
  if (!input.valid) return { fields: input.fields, values };
  let hasSession = false;
  try {
    // Use a configured origin, never an untrusted Host/next query parameter.
    const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
    const site = new URL(configuredUrl);
    const secureProtocol = process.env.NODE_ENV === "production"
      ? site.protocol === "https:"
      : ["http:", "https:"].includes(site.protocol);
    if (!secureProtocol || site.username || site.password) {
      return { error: authError(), values };
    }
    const supabase = createClient(await cookies());
    const pseudoAvailable = await checkPseudoAvailability(supabase, input.pseudo);
    if (pseudoAvailable === false) {
      return {
        fields: { pseudo: "Ce pseudo est déjà pris, essaie-en un autre." },
        values,
      };
    }
    if (pseudoAvailable === undefined) return { error: authError(), values };
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { pseudo: input.pseudo }, emailRedirectTo: `${site.origin}/auth/confirm` },
    });
    if (error) {
      logAuthErrorInDevelopment("sign-up", error);
      if (error.code === "unexpected_failure") {
        const availableAfterFailure = await checkPseudoAvailability(supabase, input.pseudo);
        if (availableAfterFailure === false) {
          return {
            fields: { pseudo: "Ce pseudo est déjà pris, essaie-en un autre." },
            values,
          };
        }
      }
      return { error: authError(error.code, error.status), values };
    }
    hasSession = Boolean(data.session);
  } catch (error) {
    logAuthErrorInDevelopment("sign-up", error);
    return { error: authError(errorCode(error), errorStatus(error)), values };
  }
  if (!hasSession) return { success: true, values };
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut(): Promise<AuthState> {
  try {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { error: "La déconnexion a échoué. Réessayez." };
  } catch {
    return { error: "La déconnexion a échoué. Réessayez." };
  }
  revalidatePath("/", "layout");
  redirect("/connexion");
}
