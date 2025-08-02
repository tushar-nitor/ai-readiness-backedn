// config/db.js
const mongoose = require("mongoose");
require("dotenv").config(); // Load environment variables

// We will cache the connection so we don't have to reconnect on every request.
let cachedDb = null;

const connectDB = async () => {
  // If we already have a connection, use it.
  if (cachedDb) {
    return cachedDb;
  }

  // If not, create a new connection.
  try {
    const db = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("New MongoDB connection established.");
    cachedDb = db;
    return db;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
