// Public offer only; checkout and enforced workspace quotas are managed separately.
export const pricingPlans = [
  { name: "Base", price: 29, leads: 120, emails: 600, audiences: 2, dailyLeads: 5, description: "Build a steady stream of new users for your white-label." },
  { name: "Pro", price: 59, leads: 350, emails: 1750, audiences: 10, dailyLeads: 15, description: "Reach more audiences and grow your white-label faster." },
] as const;