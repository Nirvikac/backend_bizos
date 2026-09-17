const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Fallback keeps the sender valid even if RESEND_FROM is not set on the
// host (the Resend sandbox address only delivers to the account owner).
const FROM_EMAIL = process.env.RESEND_FROM || "onboarding@resend.dev";

const buildVerificationHtml = (verificationLink) => `
  <h2>Welcome to Bizos 👋</h2>
  <p>Thanks for creating your account. Please verify your email address.</p>
  <a
    href="${verificationLink}"
    style="
      display:inline-block;
      padding:12px 24px;
      background:#2563eb;
      color:white;
      text-decoration:none;
      border-radius:8px;
    "
  >
    Verify Email
  </a>
  <p>This link will expire in 15 minutes.</p>
`;

const sendVerificationEmail = async (email, verificationToken) => {
  const baseUrl = process.env.BACKEND_URL || "https://backend-bizos.onrender.com";
  const verificationLink = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Bizos <${FROM_EMAIL}>`,
      to: [email],
      subject: "Verify your Bizos account",
      html: buildVerificationHtml(verificationLink),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Verification email failed:", body);
    throw new Error(`Resend responded with ${response.status}`);
  }

  const { id } = await response.json();
  console.log("Verification email sent:", id);
};

export { sendVerificationEmail };
