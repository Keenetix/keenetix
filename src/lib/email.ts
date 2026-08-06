export type EmailMessage = { to: string; subject: string; text: string };

// No email provider is wired up yet (see AGENTS.md-adjacent roadmap notes). Until one is,
// transactional email is logged instead of sent so verification/reset/invite links are still
// reachable in development. Swap this function's body for a real provider call (Resend, SES, etc.)
// to start actually sending mail — every caller in this codebase goes through here.
export async function sendEmail(message: EmailMessage) {
  console.info(`[email:unsent] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`);
}
