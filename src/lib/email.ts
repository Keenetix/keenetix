export type EmailMessage = { to: string; subject: string; text: string };

const RESEND_API_URL = "https://api.resend.com/emails";

export async function sendEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[email:unsent] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`);
    return;
  }
  const from = process.env.RESEND_FROM_EMAIL ?? "Keenetix <onboarding@resend.dev>";
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: message.to, subject: message.subject, text: message.text }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[email:failed] to=${message.to} status=${response.status} ${body}`);
  }
}
