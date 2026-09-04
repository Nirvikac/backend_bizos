import mongoose from "mongoose";

async function dbConnect() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database connected");
  } catch (error) {
    console.log("Connection Failed" + error);
    process.exit(1); // Optional: Stop app if database connection fails
  }
}

export default dbConnect;
