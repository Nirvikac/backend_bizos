import nodemailer from "nodemailer";

// Gmail SMTP transporter with generous timeouts so sendMail never hangs for
// minutes when Gmail is slow or unreachable (common from cloud hosts).
const transportor = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASS,
  },
  connectionTimeout: 60000,
  greetingTimeout: 60000,
  socketTimeout: 60000,
});

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

// Function to send email
const sendVerificationEmail = async (email, verificationToken, req = null) => {
  const baseUrl = getVerificationBaseUrl(req);
  const verificationLink = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;

  try {
    const info = await transportor.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Email Verification",
      html: `
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
    `,
    });

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