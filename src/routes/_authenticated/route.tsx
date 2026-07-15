import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { authClient } from "@/lib/auth-client";
import logoAsset from "@/assets/pixeloutreach-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIsSuperAdmin } from "@/lib/admin.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Zap,
  ChevronDown,
  Sparkles,
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

const navGroups = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/business", label: "My Business", icon: Building2 },
      { to: "/settings", label: "Integrations", icon: Settings },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { to: "/targeting", label: "Targeting", icon: Target },
      { to: "/leads", label: "Leads", icon: Users },
      { to: "/board", label: "Board", icon: KanbanSquare },
    ],
  },
  {
    label: "Outreach",
    items: [
      { to: "/approval", label: "Approval", icon: CheckCircle2 },
      { to: "/inbox", label: "Inbox", icon: Inbox },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/billing", label: "Billing", icon: CreditCard },
    ],
  },
] as const;

function AuthedShell() {
  const navigate = useNavigate();
  const isAdminFn = useServerFn(getIsSuperAdmin);
  const { data: adminInfo } = useQuery({
    queryKey: ["is_super_admin"],
    queryFn: () => isAdminFn(),
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const allItems: { to: string; label: string }[] = navGroups.flatMap((g) => g.items.map((i) => ({ to: i.to, label: i.label })));
  const active = allItems.find((i) => pathname.startsWith(i.to));
  const pageTitle = active?.label ?? (pathname.startsWith("/admin") ? "Platform admin" : "PixelOutreach");

  const userEmail = (typeof window !== "undefined" && (window as any).__lovable_user_email) || "";

  async function signOut() {
    await authClient.auth.signOut();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-[oklch(0.985_0.005_60)]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border/60 bg-white flex flex-col sticky top-0 h-screen">
        <Link to="/dashboard" className="px-5 h-16 flex items-center gap-2.5 border-b border-border/60">
          <img src={logoAsset.url} alt="PixelOutreach" className="w-8 h-8 rounded-lg shadow-brand" />
          <div>
            <div className="font-semibold text-[15px] tracking-tight leading-none">PixelOutreach</div>
            <div className="text-[11px] text-muted-foreground mt-1">AI outbound platform</div>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-2 pb-2 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.08em]">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((n) => {
                  const isActive = pathname.startsWith(n.to);
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      className={
                        "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all " +
                        (isActive
                          ? "bg-brand-gradient-soft text-foreground shadow-sm ring-1 ring-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60")
                      }
                    >
                      <n.icon
                        className={
                          "w-4 h-4 transition-colors " +
                          (isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")
                        }
                        strokeWidth={isActive ? 2.25 : 2}
                      />
                      {n.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {adminInfo?.is_super_admin && (
            <div>
              <div className="px-2 pb-2 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.08em]">
                Admin
              </div>
              <Link
                to="/admin"
                className={
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all " +
                  (pathname.startsWith("/admin")
                    ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                    : "text-amber-700 hover:bg-amber-50")
                }
              >
                <Shield className="w-4 h-4" strokeWidth={2.25} />
                Platform admin
              </Link>
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-border/60">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/60 transition text-left">
                <div className="w-8 h-8 rounded-full bg-brand-gradient text-white flex items-center justify-center text-xs font-semibold shadow-brand">
                  {(userEmail?.[0] ?? "U").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium truncate">{userEmail || "Signed in"}</div>
                  <div className="text-[10px] text-muted-foreground">Manage account</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel className="text-xs">Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/billing"><CreditCard className="w-4 h-4 mr-2" /> Billing & plan</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings"><Settings className="w-4 h-4 mr-2" /> Integrations</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 sticky top-0 z-30 border-b border-border/60 bg-white/80 backdrop-blur-xl flex items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-semibold tracking-tight">{pageTitle}</h1>
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/70 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/approval">
              <Button variant="ghost" size="sm" className="text-[12px] gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Review queue
              </Button>
            </Link>
            <Link to="/targeting">
              <Button size="sm" className="text-[12px] gap-1.5 bg-brand-gradient shadow-brand hover:opacity-95">
                <Sparkles className="w-3.5 h-3.5" /> New discovery
              </Button>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
