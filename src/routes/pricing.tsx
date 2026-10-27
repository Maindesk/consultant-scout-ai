import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Globe, Mail, Search, Workflow, Zap, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PricingPlans } from "@/components/PricingPlans";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [
    { title: "Pricing — PixelOutreach | Base $29 & Pro $59" },
    { name: "description", content: "Grow your Simvoly white-label with PixelOutreach. Compare Base at $29/month and Pro at $59/month, with AI lead research, outreach and connected demo sites." },
    { property: "og:title", content: "PixelOutreach pricing — two plans for white-label growth" },
    { property: "og:description", content: "Base $29/month. Pro $59/month. Lead discovery, deep enrichment, personalized outreach and your white-label platform, connected." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: PricingPage,
});

const features = [
  { icon: Search, title: "Find your next users", text: "Describe your audience. Discover prospects on the website platforms you want to replace." },
  { icon: Zap, title: "Make every email relevant", text: "Deep website research and evidence-backed signals shape your personalized outreach." },
  { icon: Globe, title: "Show them your white-label", text: "Create template-based demos on your own platform, preview them, and approve them for outreach." },
  { icon: Workflow, title: "Keep the conversation connected", text: "Manage replies and your pipeline, then sync contacts and tags to your main website." },
];
const questions = [
  { q: "What is included in a lead?", a: "The proposed allowance covers discovering a prospect, enriching their website and preparing personalized outreach. Your daily Autopilot allowance is part of this monthly total, not an extra allowance." },
  { q: "Are demo sites an extra charge?", a: "No. PixelOutreach asks your connected white-label platform to copy your selected template and populate supported business details. AI does not build the site. There is no PixelOutreach per-demo fee or demo-site cap in these plans; your own platform's terms and limits still apply." },
  { q: "Do I need an email sending service?", a: "Yes. Connect your own Resend, SendGrid or Postmark account and sending domain. Your provider's fees are separate from PixelOutreach; the email allowance shown here is the proposed PixelOutreach sending limit." },
  { q: "What happens when I reach my allowance?", a: "These plans are designed around capped monthly allowances rather than surprise automatic overage charges. You can choose the higher plan when you need more capacity. The new allowances still need to be connected to subscription billing before paid launch." },
  { q: "Can I subscribe today?", a: "You can create an account and explore PixelOutreach now. These are the new proposed plans; paid checkout and enforcement of these specific allowances are not yet enabled." },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 h-18 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 font-semibold"><span className="size-8 bg-primary text-primary-foreground rounded-md flex items-center justify-center"><Zap className="size-4" /></span>PixelOutreach</Link>
          <nav className="flex items-center gap-4 sm:gap-7 text-sm"><Link to="/" className="hidden sm:block text-muted-foreground hover:text-foreground">Overview</Link><span className="hidden sm:block font-medium">Pricing</span><Button variant="outline" asChild size="sm"><Link to="/auth">Sign in<ArrowRight /></Link></Button></nav>
        </div>
      </header>
      <main>
        <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-14 sm:pt-20 pb-16">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
            <p className="text-primary text-xs font-semibold uppercase">PixelOutreach pricing</p>
            <h1 className="mt-4 text-4xl sm:text-5xl font-semibold leading-tight">Get more users for<br className="hidden sm:block" /> your white-label.</h1>
            <p className="mt-5 text-muted-foreground text-base sm:text-lg leading-relaxed">Two straightforward plans. One connected growth engine.<br className="hidden sm:block" /> Start focused, then scale your outreach as your platform grows.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><Check className="size-3.5 text-primary" /> Monthly pricing</span><span className="flex items-center gap-1.5"><Check className="size-3.5 text-primary" /> Both plans include platform integration</span></div>
          </div>
          <PricingPlans />
          <p className="mx-auto max-w-3xl text-center mt-7 text-xs text-muted-foreground leading-relaxed">New plan preview — paid checkout and these allowances are not yet activated. Email provider fees and your white-label platform subscription are separate.</p>
        </section>
        <section className="border-y border-border bg-muted/30 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"><div><p className="text-xs font-semibold text-primary uppercase">Included in both plans</p><h2 className="mt-3 text-3xl font-semibold">Your platform. Your growth engine.</h2></div><p className="text-sm text-muted-foreground max-w-xs">The complete workflow, not a collection of add-ons.</p></div>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">{features.map(({ icon: Icon, title, text }) => <div key={title}><Icon className="size-6 text-primary" /><h3 className="mt-5 text-base font-semibold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p></div>)}</div>
            <div className="mt-10 pt-7 border-t border-border flex flex-wrap gap-x-7 gap-y-3 text-sm text-muted-foreground">{["Business knowledge & AI drafting", "Daily Autopilot", "Approval queue & inbox", "Pipeline & forecasting", "Domain health & usage alerts"].map(item => <span key={item} className="flex gap-2 items-center"><Check className="size-4 text-primary" />{item}</span>)}</div>
          </div>
        </section>
        <section className="mx-auto max-w-4xl px-5 sm:px-8 py-16 sm:py-20">
          <div className="text-center mb-9"><p className="text-xs text-primary font-semibold uppercase">The details</p><h2 className="text-3xl mt-3 font-semibold">Good questions. Clear answers.</h2></div>
          {questions.map(({ q, a }) => <details key={q} className="group border-b border-border py-5"><summary className="cursor-pointer flex justify-between items-center gap-5 text-sm sm:text-base font-medium list-none">{q}<Plus className="size-4 shrink-0 text-muted-foreground group-open:rotate-45 transition-transform motion-reduce:transition-none" /></summary><p className="mt-4 pr-6 text-sm text-muted-foreground leading-relaxed">{a}</p></details>)}
        </section>
        <section className="border-t border-border py-14"><div className="mx-auto max-w-6xl px-5 sm:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"><div><h2 className="text-2xl font-semibold">Turn your next prospect into a platform user.</h2><p className="mt-2 text-sm text-muted-foreground">Connect your white-label. Build your next growth campaign.</p></div><Button asChild size="lg"><Link to="/auth">Create your account<ArrowRight /></Link></Button></div></section>
      </main>
      <footer className="border-t border-border px-5 sm:px-8 py-7"><div className="max-w-6xl mx-auto flex justify-between flex-wrap gap-4 text-xs text-muted-foreground"><span>© {new Date().getFullYear()} PixelOutreach</span><Link to="/">Back to overview</Link><span className="flex items-center gap-2"><Mail className="size-3.5" /> Built for white-label partners</span></div></footer>
    </div>
  );
}