import jwt from "jsonwebtoken";

// Seven days keeps shop owners logged in through a working week without
// being so long that a stolen token stays useful.
const TOKEN_TTL = "7d";

const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRETS, {
    expiresIn: TOKEN_TTL,
  });

export default generateToken;
