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

/// The one-time code that proves you own this address. It is NOT a login link — verifying it
/// only earns the right to set a password. That distinction is the whole point: a link in an
/// inbox is a bearer token for the account, which is exactly what we're getting away from.
export function otpEmail(code: string, minutes: number) {
  return {
    subject: `${code} is your MacroLens code`,
    text: `Your MacroLens verification code is ${code}.\n\nIt expires in ${minutes} minutes and can be used once. If you didn't ask for it, ignore this email — nobody can sign in with it alone.`,
    html: `
<div style="background:#0b0d10;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:420px;margin:0 auto;background:#14171c;border:1px solid #272c35;border-radius:12px;padding:32px;text-align:center">
    <h1 style="margin:0 0 6px;color:#e8eaed;font-size:16px;font-weight:600">Verify your email</h1>
    <p style="margin:0 0 24px;color:#8b929e;font-size:13px;line-height:1.5">
      Enter this code in MacroLens to set your password.
    </p>
    <div style="background:#0b0d10;border:1px solid #272c35;border-radius:10px;padding:18px;margin-bottom:24px">
      <span style="color:#e8eaed;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:600;letter-spacing:8px">${code}</span>
    </div>
    <p style="margin:0;color:#8b929e;font-size:12px;line-height:1.6">
      Expires in ${minutes} minutes. Works once.<br>
      Didn't ask for it? Ignore this — the code alone can't sign anyone in.
    </p>
  </div>
</div>`.trim(),
  };
}
