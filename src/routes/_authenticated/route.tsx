import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIsSuperAdmin } from "@/lib/admin.functions";
import {
  LayoutDashboard,
  Building2,
  Target,
  Users,
  CheckCircle2,
  Inbox,
  BarChart3,
  LogOut,
  KanbanSquare,
  Settings,
  CreditCard,
  Shield,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await authClient.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedShell,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/business", label: "My Business", icon: Building2 },
  { to: "/targeting", label: "Targeting", icon: Target },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/board", label: "Board", icon: KanbanSquare },
  { to: "/approval", label: "Approval", icon: CheckCircle2 },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AuthedShell() {
  const navigate = useNavigate();
  const isAdminFn = useServerFn(getIsSuperAdmin);
  const { data: adminInfo } = useQuery({
    queryKey: ["is_super_admin"],
    queryFn: () => isAdminFn(),
  });

  async function signOut() {
    await authClient.auth.signOut();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 border-r border-border bg-card flex flex-col">
        <div className="px-4 py-5 border-b border-border">
          <div className="font-semibold text-sm">PixelOutreach</div>
          <div className="text-xs text-muted-foreground">AI outbound platform</div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeProps={{ className: "bg-accent text-accent-foreground" }}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition"
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </Link>
          ))}
          {adminInfo?.is_super_admin && (
            <Link
              to="/admin"
              activeProps={{ className: "bg-accent text-accent-foreground" }}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-amber-600 hover:bg-accent hover:text-accent-foreground transition"
            >
              <Shield className="w-4 h-4" />
              Platform admin
            </Link>
          )}
        </nav>
        <div className="p-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start">
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
