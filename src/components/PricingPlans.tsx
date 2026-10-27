import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pricingPlans } from "@/lib/pricing";

export function PricingPlans() {
  return (
    <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto text-left">
      {pricingPlans.map((plan, index) => (
        <article key={plan.name} className={`relative rounded-lg border bg-card p-7 sm:p-9 flex flex-col ${index === 1 ? "border-primary shadow-brand" : "border-border"}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">{plan.name}</h2>
            {index === 1 && <span className="flex items-center gap-1.5 text-xs font-medium text-primary"><Zap className="size-3.5" /> More room to grow</span>}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground min-h-10">{plan.description}</p>
          <div className="my-7 flex items-baseline gap-2"><span className="text-5xl font-semibold">${plan.price}</span><span className="text-sm text-muted-foreground">USD / month</span></div>
          <Button asChild variant={index === 1 ? "default" : "outline"} size="lg" className="w-full h-11"><Link to="/auth">Get started with {plan.name}<ArrowRight /></Link></Button>
          <div className="mt-7 border-t border-border pt-6">
            <p className="text-xs font-medium text-muted-foreground mb-4">YOUR MONTHLY ALLOWANCE</p>
            <ul className="space-y-4 text-sm">
              {[
                `${plan.leads.toLocaleString()} leads to discover, enrich & draft`,
                `${plan.emails.toLocaleString()} outreach emails`,
                `${plan.audiences} saved audiences`,
                `Autopilot: up to ${plan.dailyLeads} new leads per day`,
              ].map((item) => <li key={item} className="flex gap-3 items-start"><Check className="size-4 text-primary shrink-0 mt-0.5" /><span>{item}</span></li>)}
            </ul>
            <p className="text-xs text-muted-foreground mt-5 leading-relaxed">Daily Autopilot runs count toward your monthly lead allowance.</p>
          </div>
          <p className="mt-6 pt-5 border-t border-border text-sm font-medium">All core features. No per-demo fee.</p>
        </article>
      ))}
    </div>
  );
}