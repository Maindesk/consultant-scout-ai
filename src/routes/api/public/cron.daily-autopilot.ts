import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron: runs the autopilot for every user with automation_settings.enabled = true.
 * Schedule daily via pg_cron. Auth via the anon key in the `apikey` header.
 */
export const Route = createFileRoute("/api/public/cron/daily-autopilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        const apikey = request.headers.get("apikey");
        if (!anon || apikey !== anon) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runAutopilotForUser } = await import("@/lib/autopilot.server");

        const { data: users, error } = await supabaseAdmin
          .from("automation_settings")
          .select("user_id")
          .eq("enabled", true);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const results = [];
        for (const u of users ?? []) {
          try {
            const r = await runAutopilotForUser(u.user_id);
            results.push(r);
          } catch (e) {
            results.push({ user_id: u.user_id, error: String(e) });
          }
        }
        return Response.json({ ran: results.length, results });
      },
    },
  },
});
