import { createClient } from "@/utils/supabase/client";

export async function getProfilePrivacy() {
  const { data, error } = await createClient().rpc("get_profile_privacy");
  if (error) throw new Error("Impossible de charger la confidentialité du profil.");
  return Boolean(data);
}

export async function setProfilePrivacy(isPublic: boolean) {
  const { data, error } = await createClient().rpc("set_profile_privacy", { p_is_public: isPublic });
  if (error) throw new Error("Impossible de modifier la confidentialité du profil.");
  return Boolean(data);
}
