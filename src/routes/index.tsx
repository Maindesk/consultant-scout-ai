import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Search, Mail, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "PixelOutreach — AI outbound for any business" }] }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-semibold">PixelOutreach</div>
          <Link to="/auth">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Find the right prospects. Send emails they actually reply to.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          PixelOutreach is an AI outbound platform: it discovers ideal leads for your business, personalizes every
          message from what it reads on their site, and follows up until they respond. You approve every send.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth">
            <Button size="lg">Start free trial</Button>
          </Link>
        </div>

        <div className="mt-20 grid md:grid-cols-4 gap-6 text-left">
          <Feature icon={Search} title="Lead discovery" body="Finds prospects across the web matching your niche, location and tech stack." />
          <Feature icon={Sparkles} title="Deep enrichment" body="Reads each site to detect pain points, embedded tools and buying signals." />
          <Feature icon={Mail} title="Personalized sequences" body="Writes initial + follow-up emails tuned to the prospect and your offer." />
          <Feature icon={ShieldCheck} title="You approve" body="Nothing goes out without your review. Edit, reject or regenerate any draft." />
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
