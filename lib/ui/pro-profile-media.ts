export const PRO_BANNER_MESSAGE =
  "Custom banners are available to Pro members only.";
export const PRO_AVATAR_GIF_MESSAGE =
  "Animated profile photos are available to Pro members only.";

export async function isGifProfilePhoto(file: File) {
  if (file.type.toLowerCase() === "image/gif" || /\.gif$/i.test(file.name))
    return true;
  const bytes = new Uint8Array(await file.slice(0, 6).arrayBuffer());
  const signature = String.fromCharCode(...bytes);
  return signature === "GIF87a" || signature === "GIF89a";
}
