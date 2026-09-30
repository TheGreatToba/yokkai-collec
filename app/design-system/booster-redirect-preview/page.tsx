import { BoosterRedirectProof } from "@/components/booster-redirect-proof";

export default async function BoosterRedirectPreviewPage({ searchParams }: { searchParams: Promise<{ mode?: string; disabled?: string }> }) {
  const { mode, disabled } = await searchParams;
  return <main className="mx-auto w-full max-w-6xl px-6 py-10"><p className="eyebrow">Preuve fonctionnelle</p><h1 className="yk-title mt-3">Redirection après un booster</h1><p className="mt-4 text-sm text-ink-2">Résumé réel du reveal, avec redirection après trois secondes. Utilise <code>?mode=decision</code> pour le Booster Décisif et <code>?disabled=1</code> pour la contre-preuve.</p><div className="mt-8"><BoosterRedirectProof decision={mode === "decision"} disabled={disabled === "1"}/></div></main>;
}
