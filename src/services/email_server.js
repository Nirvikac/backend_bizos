// Resend transactional email via HTTP API (port 443).
// Works from any cloud host (Render included) — unlike Gmail SMTP, which
// Render blocks at the network level (TCP Connection timeout).
//
// Env required:
//   RESEND_API_KEY - Resend API key (re_...) from resend.com > API Keys
//   RESEND_FROM    - sender address.
//                    Sandbox:  onboarding@resend.dev (only delivers to the
//                              email you registered Resend with)
//                    Production: no-reply@yourdomain.com (needs a verified
//                              domain — gmail.com CANNOT be the sender)
//
// Registration, token logic, routes, DB schema and Flutter integration are
// unchanged — only the delivery mechanism is Resend.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

async function sendVerificationEmail(email, verificationToken, req = null) {
  const baseUrl = getVerificationBaseUrl(req);
  const verificationLink = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;

  if (!process.env.RESEND_API_KEY) {
    console.error("[EMAIL FAILED] RESEND_API_KEY is not set");
    throw new Error("RESEND_API_KEY is not set");
  }

  const fromEmail = process.env.RESEND_FROM || "onboarding@resend.dev";

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Bizos <${fromEmail}>`,
      to: [email],
      subject: "Email Verification",
      html: buildVerificationHtml(verificationLink),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(
      `[EMAIL FAILED] verification email NOT sent -> ${email}. Resend API ${response.status}: ${body}`,
    );
    throw new Error(`Resend API ${response.status}: ${body}`);
  }

  const data = await response.json();
  console.log(
    `[EMAIL OK] verification email accepted by Resend -> ${email} (id: ${data.id})`,
  );
}

// Build the public base URL for verification links.
// Prefers BACKEND_URL when it is a real public URL; otherwise falls back to
// the request's own host. Ensure BACKEND_URL points at your deployed backend
// (e.g. https://backend-bizos.onrender.com) or the link will 404.
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

export { sendVerificationEmail };