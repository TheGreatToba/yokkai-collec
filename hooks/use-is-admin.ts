"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    void createClient().rpc("is_current_user_admin").then(({ data, error }) => {
      if (active) setIsAdmin(!error && data === true);
    });
    return () => { active = false; };
  }, []);
  return isAdmin;
}
