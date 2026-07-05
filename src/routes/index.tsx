import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Search, Mail, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-semibold">AI Outbound Agent</div>
          <Link to="/auth"><Button size="sm">Sign in</Button></Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Your AI agent finds coaches & consultants, writes to them, and follows up.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          You stay in control of every message. AI does the research, personalization and busywork.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth"><Button size="lg">Get started</Button></Link>
        </div>

        <div className="mt-20 grid md:grid-cols-4 gap-6 text-left">
          <Feature icon={Search} title="AI lead discovery" body="Finds coaches & consultants across the web using your targeting criteria." />
          <Feature icon={Sparkles} title="Deep enrichment" body="Analyzes each site to detect pain points and personalize outreach." />
          <Feature icon={Mail} title="Full sequences" body="Generates initial + follow-up emails tuned to their business." />
          <Feature icon={ShieldCheck} title="You approve" body="Nothing goes out without your review. Edit, reject or regenerate." />
        </div>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div>
      <Icon className="w-5 h-5 text-primary mb-2" />
      <div className="font-medium text-sm">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{body}</div>
    </div>
  );
}
