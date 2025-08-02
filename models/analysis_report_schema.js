// /models/analysis_report.js

const mongoose = require("mongoose");

const AnalysisReportSchema = new mongoose.Schema({
  projectId: {
    type: String, // Or mongoose.Schema.Types.ObjectId if you ref Projects
    required: true,
    unique: true, // Ensures one report per project
    index: true,
  },
  report: {
    type: Object, // This will store the entire analysis JSON
    required: true,
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
});

module.exports = mongoose.model("AnalysisReport", AnalysisReportSchema);
