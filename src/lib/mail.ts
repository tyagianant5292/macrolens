/// Brevo's transactional REST API, not SMTP.
///
/// Both work, but the REST API takes the same `BREVO_API_KEY` you already have, whereas SMTP
/// needs a separate SMTP key — one fewer secret to manage, and one fewer thing to get wrong.
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

type SendArgs = { to: string; subject: string; html: string; text: string };

export async function sendMail({ to, subject, html, text }: SendArgs): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("BREVO_API_KEY and MAIL_FROM must be set to send sign-in links.");
  }

  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: from, name: process.env.MAIL_FROM_NAME ?? "MacroLens" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    // Surface Brevo's actual complaint. The usual one is an unverified sender address, and
    // "failed to send email" would send you hunting in entirely the wrong place.
    const body = await res.text();
    throw new Error(`Brevo rejected the email (${res.status}): ${body.slice(0, 300)}`);
  }
}

/// Derived from the provider's maxAge rather than written out, because the two drifted apart
/// immediately: the email promised 15 minutes while the link actually lived for two hours.
/// A link that says it's dead while it's still live gets people requesting a second one —
/// which invalidates the first, and now neither of the links in their inbox is the right one.
function humanise(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} minutes`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? "an hour" : `${hours} hours`;
}

export function signInEmail(url: string, host: string, maxAgeSeconds: number) {
  const lifetime = humanise(maxAgeSeconds);

  return {
    subject: `Sign in to MacroLens`,
    text: `Sign in to MacroLens\n\n${url}\n\nThis link works once and expires in ${lifetime}. If you didn't ask for it, ignore this email.`,
    html: `
<div style="background:#0b0d10;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:420px;margin:0 auto;background:#14171c;border:1px solid #272c35;border-radius:12px;padding:32px">
    <h1 style="margin:0 0 8px;color:#e8eaed;font-size:18px">Sign in to MacroLens</h1>
    <p style="margin:0 0 24px;color:#8b929e;font-size:14px;line-height:1.5">
      Tap the button below to open your food log. The link works once and expires in ${lifetime}.
    </p>
    <a href="${url}"
       style="display:block;background:#e8eaed;color:#0b0d10;text-decoration:none;text-align:center;padding:12px;border-radius:8px;font-size:14px;font-weight:600">
      Open MacroLens
    </a>
    <p style="margin:24px 0 0;color:#8b929e;font-size:12px;line-height:1.5">
      If you didn't request this, you can ignore it — nobody can sign in without this link.
    </p>
    <p style="margin:16px 0 0;color:#4a515c;font-size:11px">${host}</p>
  </div>
</div>`.trim(),
  };
}
