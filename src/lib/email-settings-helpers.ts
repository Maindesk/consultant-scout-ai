export async function assertWorkspaceAdmin(supabase: any, userId: string, workspaceId: string) {
  const { data: m } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!m || !["owner", "admin"].includes(m.role)) throw new Error("Forbidden");
}
