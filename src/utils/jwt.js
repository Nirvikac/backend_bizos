import jwt from "jsonwebtoken";

// 30 days bounds how long an *inactive* session survives. The web app
// silently exchanges a valid token for a fresh one on every load (sliding
// session via /api/auth/refresh), so an active owner never hits this TTL —
// it only kicks in when the app hasn't been opened for a month.
const TOKEN_TTL = "30d";

const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRETS, {
    expiresIn: TOKEN_TTL,
  });

export default generateToken;
