const mongoose = require("mongoose");

const submissionItemSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true,
    },
    questionLabel: {
      type: String,
      required: true,
    },
    answers: {
      type: [String], // An array of strings
      default: [],
    },
  },
  { _id: false }
); // We don't need a separate _id for each question-answer item

const QuestionnaireSubmissionSchema = new mongoose.Schema({
  projectId: {
    type: String, // Or mongoose.Schema.Types.ObjectId if you ref Projects
    required: true,
    index: true,
  },
  submission: [submissionItemSchema], // Embed the array of question-answer pairs
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model(
  "QuestionnaireSubmission",
  QuestionnaireSubmissionSchema
);
