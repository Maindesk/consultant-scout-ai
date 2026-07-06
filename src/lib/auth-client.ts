import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const cloudAuthUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

function getManagedStorageKey() {
  try {
    const hostLabel = new URL(cloudAuthUrl).hostname.split(".")[0];
    return `sb-${hostLabel}-auth-token`;
  } catch {
    return undefined;
  }
}

function getAuthUrl() {
  if (projectId) return `https://${projectId}.supabase.co`;
  return cloudAuthUrl;
}

export const authClient = createClient<Database>(getAuthUrl(), publishableKey, {
  auth: {
    storage: typeof window !== "undefined" ? localStorage : undefined,
    storageKey: getManagedStorageKey(),
    persistSession: true,
    autoRefreshToken: true,
  },
});