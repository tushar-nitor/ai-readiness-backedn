// models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  // Common fields
  email: {
    // User's email (often required, but consider if it can be null for some providers/privacy)
    type: String,
    required: true,
    unique: true, // Ensures no two users share the same email
    lowercase: true, // Store emails in lowercase for consistency
    trim: true, // Remove whitespace
  },
  displayName: {
    // User's name from any provider
    type: String,
    required: true,
  },
  profilePicture: {
    // URL to user's profile picture from any provider
    type: String,
  },
  provider: {
    // 'google' or 'microsoft' - indicates the primary login method
    type: String,
    required: true,
    enum: ["google", "microsoft"], // Restrict to these values
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // Provider-specific IDs (optional, but unique per provider)
  googleId: {
    type: String,
    unique: true, // Must be unique across users
    sparse: true, // Allows multiple documents to have a null value for this field
  },
  microsoftId: {
    type: String,
    unique: true,
    sparse: true,
  },

  // You might want to add more fields for your application's needs
  // For example, an array for linked accounts if a user can connect both Google and Microsoft
  // linkedAccounts: [{
  //   provider: { type: String, enum: ['google', 'microsoft'] },
  //   providerId: { type: String }
  // }]
});

module.exports = mongoose.model("User", UserSchema);
