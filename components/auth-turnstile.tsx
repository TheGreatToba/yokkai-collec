"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "auto";
      size: "flexible";
      language: "fr";
      callback(): void;
      "expired-callback"(): void;
      "timeout-callback"(): void;
      "error-callback"(): void;
    }
  ): string;
  reset(id: string): void;
  remove(id: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function AuthTurnstile() {
  const id = useId();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const configuredSupport = process.env.NEXT_PUBLIC_AUTH_SUPPORT_URL;
  let supportUrl: string | undefined;
  try {
    const url = new URL(configuredSupport ?? "");
    if (url.protocol === "https:" && !url.username && !url.password)
      supportUrl = url.href;
  } catch {
    /* An absent/invalid support URL must not create an unsafe link. */
  }
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string>(undefined);
  const [error, setError] = useState("");

  function renderWidget() {
    if (
      !siteKey ||
      !container.current ||
      !window.turnstile ||
      widget.current !== undefined
    )
      return;
    try {
      widget.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        theme: "auto",
        size: "flexible",
        language: "fr",
        callback: () => setError(""),
        "expired-callback": () => {
          if (widget.current !== undefined)
            window.turnstile?.reset(widget.current);
          setError(
            "La vérification a expiré. Attends la nouvelle vérification ou réessaie."
          );
        },
        "timeout-callback": () => {
          if (widget.current !== undefined)
            window.turnstile?.reset(widget.current);
          setError("La vérification a pris trop de temps. Réessaie.");
        },
        "error-callback": () =>
          setError(
            "La vérification anti-robot est indisponible. Réessaie ou utilise un autre navigateur compatible."
          )
      });
    } catch {
      setError("La vérification anti-robot est indisponible. Réessaie.");
    }
  }

  useEffect(() => {
    const form = container.current?.closest("form");
    if (!siteKey || !form) return;
    const reset = () => {
      if (widget.current !== undefined) window.turnstile?.reset(widget.current);
    };
    // formdata is emitted after the payload is captured: clearing the DOM here
    // preserves that one submission while preventing a retry with its old token.
    form.addEventListener("formdata", reset);
    form.addEventListener("reset", reset);
    return () => {
      form.removeEventListener("formdata", reset);
      form.removeEventListener("reset", reset);
      if (widget.current !== undefined)
        window.turnstile?.remove(widget.current);
      widget.current = undefined;
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return (
    <div className="grid gap-2">
      <p className="text-sm">
        Vérification anti-robot : le widget est utilisable au clavier. Aucun
        puzzle visuel n’est nécessaire.
      </p>
      <div ref={container} />
      <Script
        id={"auth-turnstile-" + id}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onLoad={renderWidget}
        onReady={renderWidget}
        onError={() =>
          setError(
            "La vérification n’a pas pu charger. Vérifie ta connexion ou réessaie."
          )
        }
      />
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <button
        type="button"
        className="yk-auth-link text-sm"
        onClick={() => {
          if (!window.turnstile) {
            window.location.reload();
            return;
          }
          if (widget.current !== undefined)
            window.turnstile.reset(widget.current);
          else renderWidget();
          setError("");
        }}
      >
        Réessayer la vérification
      </button>
      {supportUrl && (
        <a
          href={supportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="yk-auth-link text-sm"
        >
          Vérification inaccessible ? Demander une aide humaine
        </a>
      )}
      <noscript>
        Active JavaScript pour utiliser cette vérification accessible. Si elle
        reste inaccessible, demande de l’aide à l’équipe par ton canal habituel.
      </noscript>
    </div>
  );
}
