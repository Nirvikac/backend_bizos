import nodemailer from "nodemailer";

// ─────────────────────────────────────────────────────────────────────────────
// Email sending
//
// Gmail SMTP is blocked/throttled from cloud/datacenter IPs (Render included),
// which shows up as `connect ENETUNREACH <ipv6>` / `Connection timeout` at the
// TCP level. The reliable path is an HTTPS transactional email API (port 443,
// always reachable). This module prefers Resend; Gmail SMTP is kept as an
// automatic fallback.
//
// To enable Resend, set RESEND_API_KEY (and optionally RESEND_FROM) in Render
// env + local .env. Free tier of Resend = 100 emails/day.
// ─────────────────────────────────────────────────────────────────────────────

const gmailTransporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASS,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 40000,
  tls: {
    // Keep cert validation for smtp.gmail.com under STARTTLS.
    servername: "smtp.gmail.com",
  },
});

// Send through Resend's HTTPS API (works from any cloud host).
async function sendViaResend({ from, to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend API ${response.status}: ${body}`);
  }

  const data = await response.json();
  return { messageId: data.id };
}

// Send through Gmail SMTP (fallback).
async function sendViaGmail({ to, subject, html }) {
  const info = await gmailTransporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
  });

  return { messageId: info.messageId };
}

// Build the public base URL for verification links.
// Prefers BACKEND_URL when it is a real public URL; otherwise falls back to
// the request's own host. Never emits a LAN/localhost link, because those
// are unreachable for users when the server is deployed (e.g. on Render).
const getVerificationBaseUrl = (req) => {
  const isLanUrl = (url) =>
    /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
      url,
    );

  const configured = (process.env.BACKEND_URL || "").trim();
  if (configured && !isLanUrl(configured)) {
    return configured.replace(/\/+$/, "");
  }

  const host = req?.get?.("host") || req?.headers?.host;
  if (host) {
    const protocol = isLanUrl(`http://${host}`) ? "http" : "https";
    return `${protocol}://${host}`;
  }

  return "https://backend-bizos.onrender.com";
};

const buildVerificationHtml = (verificationLink) => `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: auto;
        padding: 30px;
      ">
        <h2>Welcome to Bizos 👋</h2>

        <p>
          Thanks for creating your account.
          Please verify your email address to continue.
        </p>

        <a
          href="${verificationLink}"
          style="
            display: inline-block;
            padding: 12px 24px;
            background: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 8px;
          "
        >
          Verify Email
        </a>

        <p style="margin-top: 20px; color: #666;">
          This verification link will expire in 15 minutes.
        </p>
      </div>
    `;

// Send the verification email. Tries Resend (HTTPS API) first, then falls
// back to Gmail SMTP. Either way registration is never blocked.
const sendVerificationEmail = async (email, verificationToken, req = null) => {
  const baseUrl = getVerificationBaseUrl(req);
  const verificationLink = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
  const subject = "Email Verification";
  const html = buildVerificationHtml(verificationLink);
  const from = process.env.RESEND_FROM || process.env.EMAIL_USER;

  if (process.env.RESEND_API_KEY) {
    try {
      const info = await sendViaResend({ from, to: email, subject, html });
      console.log(
        `[EMAIL OK] verification email sent via Resend -> ${email} (id: ${info.messageId})`,
      );
      return;
    } catch (error) {
      console.error(
        `[EMAIL WARN] Resend failed (${error.message}), falling back to Gmail SMTP -> ${email}`,
      );
    }
  }

  try {
    const info = await sendViaGmail({ to: email, subject, html });
    console.log(
      `[EMAIL OK] verification email accepted by Gmail -> ${email} (messageId: ${info.messageId})`,
    );
  } catch (error) {
    console.error(
      `[EMAIL FAILED] verification email NOT sent -> ${email}. Reason: ${error.message}`,
    );
    if (error.responseCode) {
      console.error(`[EMAIL FAILED] SMTP response code: ${error.responseCode}`);
    }
    throw error;
  }
};

export { sendVerificationEmail };