import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: "juhan@rokoautomations.com",
    subject: "Welcome to EventsBox — your account is ready",
    text: "Hi Juhan,\n\nWelcome to EventsBox! You can now browse events, purchase tickets, and manage your orders.\n\nThanks for joining us.",
    html: `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:32px 24px;color:#111827">
        <h2 style="color:#1e1b4b;margin-bottom:8px">Welcome to EventsBox</h2>
        <p>Hi Juhan,</p>
        <p>Your account is ready. You can now browse events, purchase tickets, and manage your orders all in one place.</p>
        <a href="http://localhost:3000" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1e1b4b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Go to EventsBox
        </a>
        <p style="margin-top:40px;font-size:13px;color:#6b7280">You're receiving this because you signed up at EventsBox.</p>
      </div>
    `,
  });

  if (result.error) {
    console.error("Failed:", result.error);
    process.exit(1);
  }

  console.log("Email sent successfully:", result.data);
}

main();
