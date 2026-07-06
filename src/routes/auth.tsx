import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

const lovableAuth = createLovableAuth();

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — AI Outbound Agent" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const goToDashboard = () => {
    navigate({ to: "/dashboard", replace: true });
  };

  useEffect(() => {
    let mounted = true;

    authClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthReady(true);
      if (data.session) goToDashboard();
    });

    const { data: sub } = authClient.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "INITIAL_SESSION") setAuthReady(true);
      if (session && event === "INITIAL_SESSION") {
        goToDashboard();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function waitForVerifiedSession() {
    const { data: sessionData } = await authClient.auth.getSession();
    if (!sessionData.session) return false;

    const { data: userData, error } = await authClient.auth.getUser();
    if (error || !userData.user) return false;
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await authClient.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Account created. Check your email to confirm it, then sign in.");
          setMode("signin");
          return;
        }
      } else {
        const { error } = await authClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      if (await waitForVerifiedSession()) {
        goToDashboard();
      } else {
        toast.error("Sign-in did not complete. Please try again.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    try {
      const res = await lovableAuth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
        extraParams: { prompt: "select_account" },
      });

      if (res.redirected) return;
      if (res.error) throw res.error;

      if (res.tokens) {
        const { error } = await authClient.auth.setSession(res.tokens);
        if (error) throw error;
      }

      if (await waitForVerifiedSession()) {
        goToDashboard();
      } else {
        toast.error("Google sign-in did not complete. Please try again.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>AI Outbound Agent</CardTitle>
          <CardDescription>
            {mode === "signin" ? "Sign in to your workspace." : "Create your workspace."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={google} variant="outline" className="w-full" disabled={loading || !authReady}>
            {loading ? "Please wait…" : "Continue with Google"}
          </Button>
          <div className="text-center text-xs text-muted-foreground">or</div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading || !authReady} className="w-full">
              {!authReady ? "Loading…" : loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
            </Button>
          </form>
          <button
            className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
          <div className="text-center text-xs text-muted-foreground pt-2">
            <Link to="/">← Home</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
