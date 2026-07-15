export type EmailGoal =
  | "book_meeting"
  | "free_trial"
  | "demo"
  | "reply"
  | "signup"
  | "case_study";

export const EMAIL_GOAL_LABELS: Record<EmailGoal, string> = {
  book_meeting: "Book a discovery call",
  free_trial: "Start a free trial",
  demo: "Book a live demo",
  reply: "Get a reply",
  signup: "Create a free account",
  case_study: "Share a case study & nurture",
};

export function goalFraming(goal: string | null | undefined): string {
  const g = (goal ?? "book_meeting") as EmailGoal;
  switch (g) {
    case "free_trial":
      return `GOAL: get them to start a free trial.
- CTA: invite them to spin up a free trial (no credit card). Make setup sound < 5 minutes.
- Emails 2-3 should share a quick "getting started" tip or ROI proof.
- Final email: last chance / soft break-up with the trial link.`;
    case "demo":
      return `GOAL: book a live demo (screen share, 20 min).
- CTA: propose a specific short demo (e.g. "a 20-min tailored walkthrough").
- Emails 2-3: tease specific things you would show given what you found on their site.
- Final email: offer a recorded demo as fallback.`;
    case "reply":
      return `GOAL: just get a reply and start a conversation.
- CTA: end with a single low-friction question (yes/no or 1-word answer).
- No links, no calendars — pure conversational.
- Follow-ups escalate curiosity, not pressure.`;
    case "signup":
      return `GOAL: get them to create a free account.
- CTA: link to sign up; emphasize free tier and instant value.
- Emails 2-3: one concrete use-case they could try in the free tier.
- Final email: last-chance nudge.`;
    case "case_study":
      return `GOAL: nurture — share a relevant case study and stay top of mind.
- CTA: link to a case study of a similar business (name the vertical).
- Emails 2-3: bite-sized takeaways from the case study, no ask.
- Final email: soft ask for a call IF they found it useful.`;
    case "book_meeting":
    default:
      return `GOAL: book a discovery call (15-20 min).
- CTA: propose a call with a clear, short duration and value ("15 min to show you X").
- Emails 2-3: add proof (result, client type) and reduce friction.
- Final email: soft break-up — "should I close the loop?".`;
  }
}
