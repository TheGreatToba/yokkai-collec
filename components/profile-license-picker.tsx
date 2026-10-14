"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import {
  getProfileWidgetLicenses,
  type ProfileLicensePage
} from "@/lib/data/profile";

type PickerProps = {
  category: string;
  selected: string[];
  disabled: boolean;
  load: typeof getProfileWidgetLicenses;
  onToggle: (license: string) => void;
};

function LicenseResults({
  category,
  selected,
  disabled,
  load,
  onToggle,
  query
}: PickerProps & { query: string }) {
  const [result, setResult] = useState<ProfileLicensePage>({
    items: [],
    total: 0
  });
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    const timer = window.setTimeout(
      () => {
        void load({ category, query, page: 1 }).then(
          data => {
            if (!active) return;
            setResult(data);
            setPage(1);
            setBusy(false);
          },
          reason => {
            if (!active) return;
            setError(
              reason instanceof Error
                ? reason.message
                : "Licences indisponibles."
            );
            setBusy(false);
          }
        );
      },
      query ? 200 : 0
    );
    return () => {
      active = false;
      mounted.current = false;
      window.clearTimeout(timer);
    };
  }, [category, query, load]);
  async function nextPage() {
    if (pending.current || busy || disabled) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await load({ category, query, page: page + 1 });
      if (!mounted.current) return;
      setResult(current => ({
        items: [...new Set([...current.items, ...data.items])],
        total: data.total
      }));
      setPage(current => current + 1);
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error ? reason.message : "Licences indisponibles."
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      <p className="yk-profile-muted" role="status">
        {busy && !page
          ? "Chargement des licences…"
          : `${result.total} licence${result.total > 1 ? "s" : ""} disponible${result.total > 1 ? "s" : ""} · ${selected.length}/12 sélectionnées`}
      </p>
      <div
        className="yk-profile-license-results"
        aria-label={`Licences disponibles · ${category}`}
      >
        {result.items.map(license => (
          <button
            key={license}
            type="button"
            aria-pressed={selected.includes(license)}
            disabled={
              disabled || (!selected.includes(license) && selected.length >= 12)
            }
            onClick={() => onToggle(license)}
          >
            <span aria-hidden="true">
              {selected.includes(license) ? "✓" : "+"}
            </span>
            <span>{license}</span>
          </button>
        ))}
      </div>
      {!busy && !error && !result.total && (
        <p className="yk-profile-empty">
          Aucune licence ne correspond à cette recherche.
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger-ink">
          {error}
        </p>
      )}
      {(error || result.items.length < result.total) && (
        <Button
          variant="secondary"
          disabled={busy || disabled}
          onClick={() => void nextPage()}
        >
          {busy
            ? "Chargement…"
            : error
              ? "Réessayer"
              : "Afficher plus de licences"}
        </Button>
      )}
    </>
  );
}

export function ProfileLicensePicker(props: PickerProps) {
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth"
    });
  }, []);
  return (
    <div className="yk-profile-license-picker" ref={panel}>
      <label>
        Rechercher parmi les licences du catalogue
        <input
          className="auth-input"
          type="search"
          maxLength={200}
          value={query}
          disabled={props.disabled}
          placeholder="Rechercher une licence…"
          onChange={event => setQuery(event.target.value)}
        />
      </label>
      <LicenseResults
        key={`${props.category}:${query}`}
        {...props}
        query={query}
      />
    </div>
  );
}
