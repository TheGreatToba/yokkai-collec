"use client";

import { useEffect, useState } from "react";
import { Button, Toast } from "@/components/ui";
import { getProfilePrivacy, setProfilePrivacy } from "@/lib/data/settings";

export function SettingsPanel() {
  const [isPublic,setIsPublic]=useState<boolean>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [toast,setToast]=useState("");
  useEffect(()=>{void getProfilePrivacy().then(setIsPublic,reason=>setError(reason instanceof Error?reason.message:"Chargement impossible."));},[]);
  async function save(){if(isPublic===undefined)return;setBusy(true);setError("");try{setIsPublic(await setProfilePrivacy(isPublic));setToast("Confidentialité mise à jour");}catch(reason){setError(reason instanceof Error?reason.message:"Enregistrement impossible.");}finally{setBusy(false);}}
  return <section className="rounded-panel border border-veil bg-surface p-6"><div className="flex flex-wrap items-start justify-between gap-6"><div className="max-w-2xl"><h2 className="font-display text-xl">Confidentialité du profil</h2><p className="mt-3 text-sm leading-6 text-ink-2">Choisis qui peut voir ta collection et découvrir les cartes que tu possèdes dans le catalogue.</p><p className="mt-3 text-xs leading-5 text-ink-3">En activant « Profil privé », seuls tes amis voient ta collection. Pour tous les autres, tu disparais de la liste des possesseurs et tes exemplaires ne sont pas comptabilisés.</p></div><button type="button" role="switch" aria-label={isPublic===false?"Rendre le profil public":"Rendre le profil privé"} aria-checked={isPublic===undefined?false:!isPublic} disabled={isPublic===undefined||busy} className="yk-shiny-toggle" onClick={()=>setIsPublic(value=>!value)}><span>{isPublic===undefined?"Chargement…":isPublic?"Profil public":"Profil privé"}</span><i aria-hidden="true"/></button></div>{error&&<p role="alert" className="mt-5 text-sm text-danger">{error}</p>}<div className="mt-6 flex justify-end"><Button disabled={isPublic===undefined||busy} onClick={()=>void save()}>{busy?"Enregistrement…":"Enregistrer"}</Button></div><Toast message={toast} onDismiss={()=>setToast("")}/></section>;
}
