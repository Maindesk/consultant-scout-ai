import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Search,
  Mail,
  ShieldCheck,
  Zap,
  Target,
  Bot,
  Inbox,
  BarChart3,
  Globe,
  Rocket,
  Check,
  ArrowRight,
  Star,
  Layers,
  Workflow,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PixelOutreach — Get more users for your white-label" },
      {
        name: "description",
        content:
          "The AI outbound engine for white-label platform partners. Discover site owners running the stacks you replace, personalize every email, auto-provision demos, and sign up new users to your white-label — on autopilot.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Nav />
      <Hero />
      <LogoStrip />
      <HowItWorks />
      <Features />
      <Outcomes />
      <UseCases />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ----------------------------- NAV ----------------------------- */
function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <LogoMark />
          <span className="font-semibold tracking-tight">PixelOutreach</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#how" className="hover:text-foreground transition">How it works</a>
          <a href="#features" className="hover:text-foreground transition">Features</a>
          <a href="#usecases" className="hover:text-foreground transition">Use cases</a>
          <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="hidden sm:inline-flex">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="shadow-[0_8px_24px_-8px_rgba(255,81,0,0.5)]">
              Start free trial <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center shadow-brand">
      <Zap className="w-4 h-4 text-white" />
    </div>
  );
}

/* ----------------------------- HERO ----------------------------- */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,var(--background)_70%)]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 backdrop-blur px-3 py-1.5 text-xs font-medium text-muted-foreground mb-6">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
          </span>
          Built for platform partners & white-label operators
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] max-w-5xl mx-auto">
          Get more users for your{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            white-label
          </span>{" "}
          — on autopilot.
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          PixelOutreach finds site owners running the exact platforms you replace, writes
          tailored emails from what it reads on their site, and auto-provisions a personalized
          demo on your white-label before they reply. You just approve.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="h-12 px-6 text-base shadow-brand">
              Start 7-day free trial <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <a href="#how">
            <Button size="lg" variant="outline" className="h-12 px-6 text-base">
              See how it works
            </Button>
          </a>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> No credit card required</span>
          <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> Setup in under 10 minutes</span>
          <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> Cancel anytime</span>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="relative mt-16 mx-auto max-w-5xl">
      <div className="absolute -inset-4 bg-brand-gradient opacity-20 blur-3xl rounded-3xl" />
      <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-muted/40">
          <div className="w-3 h-3 rounded-full bg-red-400/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
          <div className="w-3 h-3 rounded-full bg-green-400/70" />
          <div className="ml-4 text-xs text-muted-foreground">pixeloutreach.app / dashboard</div>
        </div>
        <div className="grid md:grid-cols-3 gap-0 divide-x divide-border">
          <PreviewStat label="Leads discovered" value="1,284" trend="+312 this week" icon={Target} />
          <PreviewStat label="Emails sent" value="4,927" trend="38.4% reply rate" icon={Mail} />
          <PreviewStat label="Pipeline value" value="$284k" trend="17 deals won" icon={BarChart3} />
        </div>
        <div className="p-6 bg-muted/20 border-t border-border">
          <div className="text-xs text-muted-foreground mb-3">Latest AI-drafted outreach · awaiting approval</div>
          <div className="rounded-lg bg-background border border-border p-4 text-left text-sm">
            <div className="text-muted-foreground text-xs mb-2">To: hello@northshorecoaching.com · Squarespace detected · Calendly embed</div>
            <p className="leading-relaxed">
              Hey Sarah — noticed North Shore Coaching runs on Squarespace with a Calendly embed
              for booking. Most of our clients moved off that combo because juggling two tools
              slows down mobile bookings and dilutes the brand experience...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewStat({ label, value, trend, icon: Icon }: { label: string; value: string; trend: string; icon: any }) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="w-3.5 h-3.5" />{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-primary font-medium">{trend}</div>
    </div>
  );
}

/* ----------------------------- LOGO STRIP ----------------------------- */
function LogoStrip() {
  const platforms = ["Shopify", "Squarespace", "Wix", "Webflow", "WordPress", "Kajabi", "Ghost", "Framer"];
  return (
    <section className="border-y border-border/60 bg-muted/20 py-10">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-xs uppercase tracking-wider text-muted-foreground mb-6">
          Targets prospects on the platforms you replace
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-4">
          {platforms.map((p) => (
            <span key={p} className="text-lg font-semibold text-muted-foreground/70 hover:text-foreground transition">
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- HOW IT WORKS ----------------------------- */
function HowItWorks() {
  const steps = [
    {
      icon: Layers,
      title: "Connect your platform",
      body: "Enter your white-label domain, client key, and site URL. PixelOutreach syncs seamlessly with Simvoly, Maindesk, and other partner brands.",
    },
    {
      icon: Target,
      title: "Describe your ideal customer",
      body: "Pick target platforms (Shopify, Squarespace, etc.), niches, locations, and buying signals. We build the search queries for you.",
    },
    {
      icon: Bot,
      title: "AI works while you sleep",
      body: "Autopilot discovers new leads daily, enriches each site, drafts personalized emails, and even provisions demo sites for hot prospects.",
    },
    {
      icon: ShieldCheck,
      title: "You approve — we send",
      body: "Every email lands in your approval queue. One click sends the sequence. Replies auto-classify and move deals through your pipeline.",
    },
  ];
  return (
    <section id="how" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          eyebrow="How it works"
          title="From cold URL to signed customer — in four steps"
          subtitle="A complete outbound engine, without hiring an SDR team or stitching together six tools."
        />
        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={s.title} className="relative group">
              <div className="absolute -top-4 -left-2 text-7xl font-bold text-primary/10 group-hover:text-primary/20 transition">
                0{i + 1}
              </div>
              <div className="relative rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition h-full">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <s.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- FEATURES ----------------------------- */
function Features() {
  const features = [
    { icon: Search, title: "Practitioner-intent lead discovery", body: "Not blog posts. Not directories. Real businesses on your target stack — verified by scraping their site fingerprint." },
    { icon: Sparkles, title: "Deep site enrichment", body: "Detects embedded tools, calendars, chat widgets, page speed, brand voice — feeds it all into the email." },
    { icon: Mail, title: "Goal-based sequences", body: "Push a trial, a demo, or a meeting. Each goal has its own framing, tone, and follow-up cadence." },
    { icon: Workflow, title: "Auto-provisioned demo sites", body: "Interested lead? PixelOutreach spins up a personalized demo on your platform and drops a 1-click SSO link into follow-up #3." },
    { icon: Inbox, title: "Unified reply inbox", body: "AI classifies replies — interested, objection, unsubscribe — and drafts a response you can send in one click." },
    { icon: BarChart3, title: "Kanban pipeline + forecasting", body: "Drag deals across stages. See expected revenue based on your average deal value. AI moves stages from replies automatically." },
    { icon: Globe, title: "Revenue attribution webhook", body: "When a prospect subscribes on your platform, we auto-close the deal as Won and track true MRR contribution." },
    { icon: Lock, title: "Encrypted credentials & RLS", body: "Client keys stored with AES-256-GCM. Row-level security isolates every workspace. Enterprise-grade from day one." },
    { icon: Rocket, title: "Daily autopilot", body: "Set a daily discovery quota. Wake up to fresh leads, enriched profiles, and drafted emails waiting for approval." },
  ];
  return (
    <section id="features" className="py-24 md:py-32 bg-muted/20 border-y border-border/60">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          eyebrow="Features"
          title="Everything an outbound team does — done for you"
          subtitle="PixelOutreach replaces the SDR, the copywriter, the researcher, and half your sales ops stack."
        />
        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="w-10 h-10 rounded-lg bg-brand-gradient text-white flex items-center justify-center mb-4 shadow-brand">
                <f.icon className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- OUTCOMES ----------------------------- */
function Outcomes() {
  const stats = [
    { value: "10x", label: "More qualified conversations than manual outbound" },
    { value: "<10min", label: "From signup to first personalized email drafted" },
    { value: "38%", label: "Average reply rate on goal-based sequences" },
    { value: "80%", label: "Reduction in cost-per-meeting vs. hiring an SDR" },
  ];
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="rounded-3xl border border-border bg-brand-gradient-soft p-10 md:p-16 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
          <div className="relative">
            <SectionHeader
              eyebrow="Outcomes"
              title="Built to convert. Priced to compound."
              subtitle="Real numbers from operators running platform-switch campaigns."
              align="left"
            />
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="text-4xl md:text-5xl font-bold bg-brand-gradient bg-clip-text text-transparent">
                    {s.value}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground max-w-[180px]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- USE CASES ----------------------------- */
function UseCases() {
  const cases = [
    {
      tag: "Website platforms",
      title: "Convert Shopify & Squarespace merchants",
      body: "Target businesses on the platforms you replace. AI reads their site, calls out the tools they've duct-taped together, and pitches your all-in-one alternative.",
      quote: "We booked 42 demos in month one. Half were live migrations by month two.",
      author: "Simvoly white-label operator",
    },
    {
      tag: "SaaS founders",
      title: "Land your ideal-fit ICP",
      body: "Feed your site as knowledge. AI learns your value props and matches them to real signals on prospect sites — no more generic 'saw your website' openers.",
      quote: "Finally, cold email that sounds like our best AE wrote it.",
      author: "Vertical SaaS founder",
    },
    {
      tag: "Agencies",
      title: "Fill your services pipeline",
      body: "Target businesses with slow sites, missing pixels, or outdated stacks. Personalize the pitch to what's actually broken.",
      quote: "Replaced a $4k/mo SDR with a $99/mo subscription.",
      author: "Growth agency owner",
    },
  ];
  return (
    <section id="usecases" className="py-24 md:py-32 bg-muted/20 border-y border-border/60">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          eyebrow="Use cases"
          title="One engine. Every outbound motion."
        />
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {cases.map((c) => (
            <div key={c.title} className="rounded-2xl border border-border bg-card p-8 flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">{c.tag}</span>
              <h3 className="text-xl font-semibold">{c.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed flex-1">{c.body}</p>
              <blockquote className="mt-6 pt-6 border-t border-border">
                <p className="text-sm italic">"{c.quote}"</p>
                <footer className="mt-2 text-xs text-muted-foreground">— {c.author}</footer>
              </blockquote>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- PRICING ----------------------------- */
function Pricing() {
  const tiers = [
    { code: "starter", name: "Starter", price: 49, tagline: "Test the waters", leads: 300, ai: 5000, emails: 1200, overage: "$0.20", features: ["1 workspace", "Autopilot discovery", "AI email drafting", "Unified inbox"] },
    { code: "growth", name: "Growth", price: 149, tagline: "Most popular", leads: 1200, ai: 20000, emails: 4800, overage: "$0.15", features: ["Everything in Starter", "Auto-provisioned demos", "SSO link injection", "Pipeline forecasting", "Priority support"], featured: true },
    { code: "scale", name: "Scale", price: 399, tagline: "For serious operators", leads: 3000, ai: 50000, emails: 12000, overage: "$0.12", features: ["Everything in Growth", "Custom integrations", "Dedicated onboarding", "Revenue attribution", "SLA"] },
  ];
  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          eyebrow="Pricing"
          title="Pay for leads worked, not seats."
          subtitle="7-day free trial on every plan. No credit card. Never hard-stopped — go past your allowance and extra leads simply bill per lead."
        />

        <div className="mt-16 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((t) => (
            <div
              key={t.code}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                t.featured
                  ? "border-primary bg-card shadow-brand md:-translate-y-3"
                  : "border-border bg-card"
              }`}
            >
              {t.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-gradient text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most popular
                </div>
              )}
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t.tagline}</div>
              <h3 className="mt-1 text-2xl font-bold">{t.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight">${t.price}</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" /> {t.leads.toLocaleString()} leads/mo</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" /> {t.ai.toLocaleString()} AI credits</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" /> {t.emails.toLocaleString()} emails/mo</li>
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" /> {f}</li>
                ))}
              </ul>
              <Link to="/auth" className="mt-8 block">
                <Button className="w-full" variant={t.featured ? "default" : "outline"} size="lg">
                  Start free trial
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- FAQ ----------------------------- */
function FAQ() {
  const qas = [
    { q: "How is the free trial structured?", a: "7 days, full access to your chosen plan. No credit card required. You keep any leads and drafts generated during the trial." },
    { q: "Do I need my own email domain?", a: "Yes — sending from your own verified domain protects deliverability. We walk you through DNS setup during onboarding." },
    { q: "How does PixelOutreach personalize emails?", a: "It scrapes each lead's website, detects their tech stack, embedded tools, tone, and buying signals, then drafts an email tuned to those specifics and your product." },
    { q: "Can I use my own platform for demos?", a: "Yes. Connect any Simvoly white-label platform (Maindesk, PixelBook, etc.) via API keys. PixelOutreach auto-provisions personalized demo sites for hot leads." },
    { q: "Do I approve every email?", a: "By default, yes — every draft lands in the approval queue. You can flip on full autopilot once you trust the output." },
  ];
  return (
    <section className="py-24 md:py-32 bg-muted/20 border-y border-border/60">
      <div className="max-w-4xl mx-auto px-6">
        <SectionHeader eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-12 space-y-4">
          {qas.map((qa) => (
            <details key={qa.q} className="group rounded-xl border border-border bg-card p-6 open:shadow-md transition">
              <summary className="flex justify-between items-center cursor-pointer font-medium">
                {qa.q}
                <span className="ml-4 text-primary transition group-open:rotate-45 text-2xl leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{qa.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- FINAL CTA ----------------------------- */
function FinalCTA() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-5xl mx-auto px-6">
        <div className="relative rounded-3xl bg-brand-gradient p-10 md:p-16 text-center overflow-hidden shadow-brand">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="relative">
            <div className="flex justify-center gap-1 mb-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="w-5 h-5 fill-white text-white" />
              ))}
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight max-w-3xl mx-auto">
              Your next 100 white-label users are already online. Go get them.
            </h2>
            <p className="mt-4 text-white/90 text-lg max-w-xl mx-auto">
              Set up in 10 minutes. First personalized emails ready before your coffee cools.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" variant="secondary" className="h-12 px-8 text-base bg-white text-primary hover:bg-white/90">
                  Start 7-day free trial <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-white/80">No credit card • Cancel anytime</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- FOOTER ----------------------------- */
function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="font-semibold text-foreground">PixelOutreach</span>
          <span className="ml-2">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex gap-6">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <Link to="/auth" className="hover:text-foreground">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}

/* ----------------------------- SHARED ----------------------------- */
function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "text-center max-w-3xl mx-auto" : "max-w-3xl"}>
      <div className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">{eyebrow}</div>
      <h2 className="mt-3 text-3xl md:text-5xl font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{subtitle}</p>}
    </div>
  );
}
