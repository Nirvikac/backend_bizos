const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Fallback uses the verified domain (nirvikacharya.com.np) so the sender is
// deliverable to any recipient even if RESEND_FROM is missing on the host.
// The old fallback (onboarding@resend.dev) only delivers to the account owner.
const FROM_EMAIL = process.env.RESEND_FROM || "noreply@nirvikacharya.com.np";

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

const sendVerificationEmail = async (email, verificationToken, frontendBase) => {
  // Same base resolution as the reset email: the link opens the frontend's
  // /verify page (which proxies the token to the backend), not the backend's
  // raw JSON endpoint.
  const base = (frontendBase || "http://localhost:3000").replace(/\/+$/, "");
  const verificationLink = `${base}/verify?token=${verificationToken}`;

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

const buildResetHtml = (resetLink) => `
  <h2>Reset your Bizos password</h2>
  <p>We received a request to reset the password for your Bizos account.</p>
  <a
    href="${resetLink}"
    style="
      display:inline-block;
      padding:12px 24px;
      background:#2563eb;
      color:white;
      text-decoration:none;
      border-radius:8px;
    "
  >
    Reset Password
  </a>
  <p>This link will expire in 15 minutes.</p>
  <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
`;

const sendPasswordResetEmail = async (email, resetToken, frontendBase) => {
  const base = (frontendBase || "http://localhost:3000").replace(/\/+$/, "");
  const resetLink = `${base}/reset-password?token=${resetToken}`;

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Bizos <${FROM_EMAIL}>`,
      to: [email],
      subject: "Reset your Bizos password",
      html: buildResetHtml(resetLink),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Password reset email failed:", body);
    throw new Error(`Resend responded with ${response.status}`);
  }

  const { id } = await response.json();
  console.log("Password reset email sent:", id);
};

export { sendVerificationEmail, sendPasswordResetEmail };
