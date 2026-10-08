/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedCard, isShareImageUrl } from "@/lib/server/card-sharing";
import type { Rarity } from "@/lib/data/cards";

export const dynamic = "force-dynamic";

type Props={params:Promise<{id:string}>};
const rarityText:Record<Rarity,string>={C:"text-rarity-c",R:"text-rarity-r",SR:"text-rarity-sr",SSR:"text-rarity-ssr",LR:"text-rarity-lr"};

function siteOrigin() {
  const fallback=process.env.NODE_ENV==="production"?undefined:"http://localhost:3000";
  const value=process.env.NEXT_PUBLIC_SITE_URL||fallback;
  if(!value)throw new Error("NEXT_PUBLIC_SITE_URL is required");
  return new URL(value).origin;
}

export async function generateMetadata({params}:Props):Promise<Metadata> {
  const {id}=await params;
  const card=await getSharedCard(id);
  if(!card)notFound();
  const owner=card.pseudo?` par ${card.pseudo}`:"";
  const description=`${card.cardName}, carte ${card.rarity}${card.shiny?" Shiny":""} de ${card.franchise}, partagée${owner} sur Yokkai Collec'.`;
  const image=`${siteOrigin()}/partage/${id}/image/og`;
  return {
    title:`${card.cardName} · Yokkai Collec'`,description,
    robots:{index:false,follow:false},
    openGraph:{title:`${card.cardName} · Yokkai Collec'`,description,images:[{url:image,width:1200,height:630,alt:card.cardName}]},
    twitter:{card:"summary_large_image",title:`${card.cardName} · Yokkai Collec'`,description,images:[image]},
  };
}

export default async function SharedCardPage({params}:Props) {
  const {id}=await params;
  const card=await getSharedCard(id);
  if(!card)notFound();
  return <main className="flex min-h-screen items-center justify-center bg-void px-5 py-12 text-ink-1">
    <article className="w-full max-w-xl rounded-panel border border-veil bg-surface p-6 text-center shadow-2xl sm:p-10">
      <p className="eyebrow">Carte partagée</p>
      <div className="mx-auto mt-6 aspect-[4/5] max-w-sm overflow-hidden rounded-card border border-veil bg-elevated">
        {isShareImageUrl(card.catalogueImageUrl)?
          <img className="h-full w-full object-cover" src={card.catalogueImageUrl} alt={`Illustration de ${card.cardName}`}/>:
          <div className="flex h-full items-center justify-center p-6 text-ink-2">{card.cardName}</div>}
      </div>
      <h1 className="yk-title mt-7">{card.cardName}</h1>
      <p className="mt-3 text-sm text-ink-2">{card.franchise}</p>
      <p className={`mt-4 font-display ${rarityText[card.rarity]}`}>{card.rarity}{card.shiny?" · Shiny":""}</p>
      {card.pseudo?<p className="mt-4 text-sm text-ink-3">Partagée par {card.pseudo}</p>:null}
      <Link className="yk-button yk-button-primary mt-8 inline-flex" href="/inscription">Rejoindre Yokkai Collec&apos;</Link>
    </article>
  </main>;
}
