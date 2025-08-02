const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  projectId: { type: String, required: true },
  originalName: String,
  storageName: String,
  size: Number,
  status: { type: String, default: "processing" },
  uploadedAt: { type: Date, default: Date.now },
  context: String,
});
module.exports = mongoose.model("Document", DocumentSchema);
