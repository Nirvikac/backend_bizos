// Environment must load before anything that reads process.env at import
// time (cloudinary config, jwt, …).
import "./config/env.js";

import app from "./app.js";
import dbConnect from "./config/db.js";

const PORT = process.env.PORT || 3000;

await dbConnect();

// 0.0.0.0 so hosting platforms (Render etc.) can reach the server.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
