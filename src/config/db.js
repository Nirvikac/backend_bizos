import mongoose from "mongoose";

// Single entry point for the Mongo connection. The app refuses to start
// without a database — every route depends on it, so there is nothing
// useful we could do in a degraded state.
async function dbConnect() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database connected");
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
}

export default dbConnect;
