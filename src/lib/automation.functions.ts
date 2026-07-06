import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAutomationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("automation_settings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const saveAutomationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    enabled: boolean;
    daily_lead_target: number;
    auto_enrich: boolean;
    auto_draft: boolean;
    active_search_config_id: string | null;
  }) => d)
  .handler(async ({ context, data }) => {
    const { data: existing } = await context.supabase
      .from("automation_settings")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      const { data: r, error } = await context.supabase
        .from("automation_settings")
        .update(data)
        .eq("user_id", context.userId)
        .select()
        .single();
      if (error) throw error;
      return r;
    }
    const { data: r, error } = await context.supabase
      .from("automation_settings")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw error;
    return r;
  });

export const runAutopilotNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { runAutopilotForUser } = await import("./autopilot.server");
    return runAutopilotForUser(context.userId);
  });
