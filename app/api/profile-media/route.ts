import { randomUUID } from "node:crypto";
import { inspectProfileImage } from "@/lib/pro/image";
import {
  ProError,
  proUser,
  proClient,
  hasPaidPro,
  boundedBody,
  proReply,
  proFailure
} from "@/lib/pro/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await proUser(request, true);
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data;"))
      throw new ProError("REQUEST_INVALID", 400);
    const bytes = await boundedBody(request, 4 * 1024 * 1024 + 8192);
    let form;
    try {
      form = await new Response(bytes, {
        headers: { "Content-Type": contentType }
      }).formData();
    } catch {
      throw new ProError("REQUEST_INVALID", 400);
    }
    if (
      [...form.keys()].some(key => key !== "file" && key !== "purpose") ||
      form.getAll("file").length !== 1 ||
      form.getAll("purpose").length !== 1
    )
      throw new ProError("REQUEST_INVALID", 400);
    const file = form.get("file"),
      purpose = form.get("purpose");
    if (
      !(file instanceof File) ||
      typeof purpose !== "string" ||
      !["avatar", "banner", "background", "card-back"].includes(purpose)
    )
      throw new ProError("REQUEST_INVALID", 400);
    let image;
    const imageBytes = new Uint8Array(await file.arrayBuffer());
    try {
      image = inspectProfileImage(imageBytes);
    } catch {
      throw new ProError(
        "PROFILE_IMAGE_INVALID",
        file.size > 4 * 1024 * 1024 ? 413 : 400
      );
    }
    const client = proClient();
    if (
      (purpose !== "avatar" || image.animated) &&
      !(await hasPaidPro(user.id, client))
    )
      throw new ProError("PRO_REQUIRED", 403);
    const path = `${user.id}/${purpose}-${randomUUID()}.${image.extension}`;
    const url = client.storage.from("avatars").getPublicUrl(path)
      .data.publicUrl;
    // Reserve a validated asset and the durable quota before uploading bytes.
    const { error: reserveError } = await client
      .from("profile_media_assets")
      .insert({
        path,
        user_id: user.id,
        purpose,
        mime_type: image.mime,
        animated: image.animated,
        public_url: url
      });
    if (reserveError?.message === "PRO_REQUIRED")
      throw new ProError("PRO_REQUIRED", 403);
    if (reserveError?.message === "PROFILE_MEDIA_RATE_LIMITED")
      throw new ProError("PROFILE_MEDIA_RATE_LIMITED", 429);
    if (reserveError) throw new ProError("PRO_UNAVAILABLE");
    const { error } = await client.storage
      .from("avatars")
      .upload(path, imageBytes, {
        upsert: false,
        contentType: image.mime,
        cacheControl: "3600"
      });
    if (error) {
      await client
        .from("profile_media_assets")
        .delete()
        .eq("path", path)
        .eq("user_id", user.id);
      throw new ProError("PROFILE_MEDIA_UNAVAILABLE");
    }
    return proReply({ url });
  } catch (error) {
    return proFailure(error);
  }
}
