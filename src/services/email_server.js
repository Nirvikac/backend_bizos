const RESEND_ENDPOINT = "https://api.resend.com/emails";

const sendVerificationEmail = async (email, verificationToken) => {
  // Fallback keeps the sender valid even if RESEND_FROM is not set on the
  // host (Resend sandbox address only delivers to the account owner).
  const fromEmail = process.env.RESEND_FROM || "onboarding@resend.dev";
  const verificationLink =
    `${process.env.BACKEND_URL || "https://backend-bizos.onrender.com"}/api/auth/verify-email?token=${verificationToken}`;

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      from: `Bizos <${fromEmail}>`,

      to: [email],

      subject: "Verify your Bizos account",

      html: `
        <h2>Welcome to Bizos 👋</h2>

        <p>
          Thanks for creating your account.
          Please verify your email address.
        </p>

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

        <p>
          This link will expire in 15 minutes.
        </p>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.text();

    console.error("Email failed:", error);

    throw new Error(error);
  }

  const data = await response.json();

  console.log("Email sent successfully:", data.id);
};

export { sendVerificationEmail };