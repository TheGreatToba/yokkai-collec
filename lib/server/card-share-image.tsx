/* eslint-disable @next/next/no-img-element */
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getSupabaseConfig } from "@/utils/supabase/config";
import type { Rarity } from "@/lib/data/cards";
import type { SharedCard } from "@/lib/server/card-sharing";

export type ShareImageFormat="og"|"story"|"square";
const sizes={og:{width:1200,height:630},story:{width:1080,height:1920},square:{width:1080,height:1080}};
const MAX_IMAGE_BYTES=6*1024*1024;
const IMAGE_TIMEOUT_MS=2000;
const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/gif"]);
const font=readFile(join(process.cwd(),"public/fonts/Sora-Bold.ttf"));
const tokensSource=readFile(join(process.cwd(),"styles/card-tokens.css"),"utf8");

function variable(source:string,name:string) {
  const match=source.match(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*:\\s*([^;]+)`));
  if(!match)throw new Error(`Missing card token ${name}`);
  return match[1].trim();
}

function resolved(source:string,value:string) {
  return value.replace(/var\((--[a-z0-9-]+)\)/gi,(_match,name:string)=>variable(source,name));
}

function supportedGradient(value:string) {
  if(!value.startsWith("conic-gradient"))return value;
  const colors=value.match(/#[0-9a-f]{3,8}/gi);
  return colors?.length?`linear-gradient(135deg,${colors.join(",")})`:"#E8C26A";
}

async function rarityTokens(rarity:Rarity,shiny:boolean) {
  const source=await tokensSource;
  const block=source.match(new RegExp(`\\.yk-rarity-${rarity}\\s*\\{([^}]+)\\}`))?.[1];
  if(!block)throw new Error(`Missing rarity ${rarity}`);
  return {
    frame:supportedGradient(resolved(source,shiny?variable(source,"--holo-frame"):variable(block,"--card-frame"))),
    background:resolved(source,variable(block,"--card-bg")),
    accent:resolved(source,shiny?variable(source,"--holo-badge"):variable(block,"--card-badge")),
    ink:shiny?"#04000B":resolved(source,variable(block,"--card-badge-ink")),
  };
}

function validMagic(bytes:Uint8Array,type:string) {
  if(type==="image/png")return [137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value);
  if(type==="image/jpeg")return bytes[0]===255&&bytes[1]===216&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217;
  if(type==="image/gif")return new TextDecoder().decode(bytes.slice(0,6)).match(/^GIF8[79]a$/)!==null;
  return type==="image/webp"&&new TextDecoder().decode(bytes.slice(0,4))==="RIFF"&&new TextDecoder().decode(bytes.slice(8,12))==="WEBP";
}

export async function fetchCatalogueImage(url:string,fetchImage:typeof fetch=fetch) {
  try{
    const source=new URL(url);
    const catalogue=new URL(getSupabaseConfig().url);
    if(source.protocol!=="https:"||source.origin!==catalogue.origin||
      !source.pathname.startsWith("/storage/v1/object/public/card-images/"))return null;
    const response=await fetchImage(source,{redirect:"error",signal:AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      headers:{Accept:"image/png,image/jpeg,image/webp,image/gif"}});
    if(!response.ok)return null;
    const type=response.headers.get("content-type")?.split(";")[0].trim().toLowerCase()??"";
    if(!allowedTypes.has(type)||Number(response.headers.get("content-length"))>MAX_IMAGE_BYTES)return null;
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(!bytes.length||bytes.byteLength>MAX_IMAGE_BYTES||!validMagic(bytes,type))return null;
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  }catch{return null;}
}

export async function renderSharedCardImage(card:SharedCard,format:ShareImageFormat) {
  const [{width,height},fonts,colors,image]=await Promise.all([
    Promise.resolve(sizes[format]),font,rarityTokens(card.rarity,card.shiny),fetchCatalogueImage(card.catalogueImageUrl),
  ]);
  const portrait=format==="story";
  const square=format==="square";
  const artWidth=portrait?820:square?650:260;
  const artHeight=portrait?1040:square?650:320;
  const response=new ImageResponse(
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",justifyContent:"space-between",
      padding:portrait?80:square?70:52,color:"white",fontFamily:"Sora",background:colors.background}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:portrait?30:24,letterSpacing:2}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}><span style={{display:"flex",width:52,height:52,
          alignItems:"center",justifyContent:"center",borderRadius:26,background:colors.accent,color:colors.ink}}>Y</span>
          <span>YOKKAI COLLEC&apos;</span></div>
        <span>{card.rarity}{card.shiny?" · SHINY":""}</span>
      </div>
      <div style={{display:"flex",flexDirection:portrait||square?"column":"row",alignItems:"center",justifyContent:"center",
        gap:portrait?70:square?42:64,flex:1}}>
        <div style={{display:"flex",padding:12,background:colors.frame,borderRadius:36}}>
          <div style={{display:"flex",width:artWidth,height:artHeight,alignItems:"center",justifyContent:"center",
            overflow:"hidden",borderRadius:26,background:"#0F0C1D",color:"#C9C4DD",fontSize:portrait?48:34,textAlign:"center",padding:image?0:40}}>
            {image?<img alt="" src={image} width={artWidth} height={artHeight} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:
              <span>{card.cardName}</span>}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:portrait||square?"center":"flex-start",
          maxWidth:portrait?900:square?900:520,textAlign:portrait||square?"center":"left"}}>
          <div style={{fontSize:portrait?80:square?68:62,lineHeight:1.08}}>{card.cardName}</div>
          <div style={{marginTop:24,fontSize:portrait?38:square?30:28,color:"#D7D2E8"}}>{card.franchise}</div>
          {card.pseudo?<div style={{marginTop:portrait?56:34,fontSize:portrait?30:22,color:"#A9A2C2"}}>Partagée par {card.pseudo}</div>:null}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"center",fontSize:portrait?26:18,color:"#A9A2C2"}}>yokkai.fr</div>
    </div>,
    {width,height,fonts:[{name:"Sora",data:fonts,weight:700,style:"normal"}]},
  );
  return new Uint8Array(await response.arrayBuffer());
}
