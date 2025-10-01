// config/DB.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function db() {
  try {
    await mongoose.connect(process.env.MONGOOSEURL);
    console.log("✅ Db is connected");
  } catch (error) {
    console.error("❌ Db connection failed:", error.message);
  }
}

export default db;
