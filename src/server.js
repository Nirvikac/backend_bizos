// 1. MUST BE FIRST: Load env variables before everything else
import "./config/env.js";

// 2. Now import code that relies on those environment variables
import app from "../src/app.js";
import dbConnect from "./config/db.js";

const PORT = process.env.PORT || 3000;

// Connect to DB first, then start listening
await dbConnect();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
