import jwt from "jsonwebtoken";

// Extracts and verifies the bearer token, then attaches the decoded
// payload as req.user for downstream handlers.
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRETS);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token." });
  }
};

export { authMiddleware };
