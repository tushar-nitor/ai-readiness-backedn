// /controllers/assessmentController.js

const QuestionnaireSubmission = require("../models/questionare_schema");
const llm = require("../config/gemini"); // Assuming you have a utility to interact with the LLM
const DocumentSchema = require("../models/document_schema");
const AnalysisReport = require("../models/analysis_report_schema");
const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Bullet,
} = require("docx");
/**
 * Helper function to extract specific answers from the submission array.
 * @param {Array} submission - The submission array from the database.
 * @param {String} questionId - The ID of the question to find.
 * @returns {Array} The answers for the given questionId.
 */
const getAnswersForQuestion = (submission, questionId) => {
  const item = submission.find((s) => s.questionId === questionId);
  return item ? item.answers : [];
};

// Helper function to safely parse LLM JSON output
const parseLlmResponse = (llmResponse) => {
  try {
    const text = llmResponse.content;

    // Find the starting position of the JSON object or array
    const startIndex = text.indexOf("{");
    const startArrayIndex = text.indexOf("[");

    let finalStartIndex;
    if (
      startIndex > -1 &&
      (startIndex < startArrayIndex || startArrayIndex === -1)
    ) {
      finalStartIndex = startIndex;
    } else {
      finalStartIndex = startArrayIndex;
    }

    if (finalStartIndex === -1) {
      throw new Error(
        "Could not find a starting '{' or '[' in the LLM response."
      );
    }

    // Find the ending position of the JSON object or array
    const endIndex = text.lastIndexOf("}");
    const endArrayIndex = text.lastIndexOf("]");
    const finalEndIndex = Math.max(endIndex, endArrayIndex);

    if (finalEndIndex === -1) {
      throw new Error(
        "Could not find a closing '}' or ']' in the LLM response."
      );
    }

    // Extract the substring that contains only the JSON
    const jsonString = text.substring(finalStartIndex, finalEndIndex + 1);

    // Parse the extracted, clean JSON string
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("LLM JSON parsing failed. The raw response from the AI was:");
    console.error(llmResponse.content);
    console.error("The parsing error is:", e);
    throw new Error("Failed to parse the JSON response from the AI model.");
  }
};

exports.getAnalysisReport = async (req, res) => {
  try {
    const { projectId } = req.params;
    const savedReport = await AnalysisReport.findOne({ projectId });

    if (savedReport) {
      // If a report is found, return it
      res.status(200).json(savedReport);
    } else {
      // If no report is found, return a 404 status
      // This tells the frontend that it needs to generate a new one
      res
        .status(404)
        .json({ message: "No analysis report found for this project." });
    }
  } catch (error) {
    console.error("Error fetching analysis report:", error);
    res.status(500).json({ error: "Failed to fetch analysis report." });
  }
};

/**
 * Main analysis function for the assessment report.
 */
exports.analyzeAssessment = async (req, res) => {
  try {
    const { projectId } = req.params;
    const [submissionDoc, projectDocuments] = await Promise.all([
      QuestionnaireSubmission.findOne({ projectId }),
      DocumentSchema.find({ projectId }),
    ]);

    if (!submissionDoc || !submissionDoc.submission) {
      return res
        .status(404)
        .json({ error: "No assessment submission found for this project." });
    }

    // --- 1. Extract all necessary data from the submission ---
    const userObjectives = getAnswersForQuestion(
      submissionDoc.submission,
      "businessObjectives"
    );
    const documentContext = projectDocuments
      .map((doc) => doc.context)
      .filter(Boolean)
      .join("\n\n---\n\n");
    const userKpis = getAnswersForQuestion(submissionDoc.submission, "kpis");
    const userStakeholders = getAnswersForQuestion(
      submissionDoc.submission,
      "stakeholders"
    );
    const userTechStack = getAnswersForQuestion(
      submissionDoc.submission,
      "techStack"
    ); // NEW
    const userDatasets = getAnswersForQuestion(
      submissionDoc.submission,
      "datasets"
    ); // NEW
    const userGovernance = getAnswersForQuestion(
      submissionDoc.submission,
      "governance"
    ); // NEW

    // --- 2. Create specialized prompts for each analysis ---

    // Prompt for Business Strategy Analysis (as before)
    const businessPrompt = `
      You are an expert AI strategy consultant. Your task is to analyze the user's project based on their questionnaire answers and the context from their uploaded documents. Suggest specific, actionable AI use-cases.

      Return your analysis as a valid JSON array, enclosed in \`\`\`json ... \`\`\`. Each object in the array must correspond to one of the original objectives and contain "objective", "analysis", and "suggestedUseCases" (an array of objects with "useCase" and "explanation").

      CONTEXT FROM UPLOADED DOCUMENTS:
      ---
      ${documentContext}
      ---
      
      USER'S QUESTIONNAIRE ANSWERS:
      - Business Objectives: ${JSON.stringify(userObjectives)}
      - KPIs: ${JSON.stringify(userKpis)}
    `;
    // NEW: Prompt for Team & Skills Analysis
    const teamPrompt = `
      You are an AI project team manager. Based on the user's questionnaire answers about their team and the context from their uploaded documents, assess the team's readiness for a typical AI project.

      Return a valid JSON object, enclosed in \`\`\`json ... \`\`\`, with three keys:
      1. "strengths": A list of key strengths (e.g., "Strong project management presence").
      2. "gaps": A list of potential skill gaps (e.g., "Missing a dedicated ML Engineer").
      3. "recommendations": A list of high-level training or hiring recommendations.
      
      CONTEXT FROM UPLOADED DOCUMENTS:
      ---
      ${documentContext}
      ---
      
      USER'S QUESTIONNAIRE ANSWERS:
      - Team Roles & Stakeholders: ${JSON.stringify(userStakeholders)}
    `;
    const techPrompt = `
      You are a solutions architect specializing in AI/ML infrastructure. Analyze the following technology stack based on user answers and Document context. Assess its compatibility for AI development (data processing, model training, deployment).
      Return a valid JSON object, enclosed in \`\`\`json ... \`\`\`, with three keys:
      1. "analysis": A summary of the stack's strengths and weaknesses for AI.
      2. "bottlenecks": A list of potential bottlenecks or missing components (e.g., "No data warehousing solution").
      3. "recommendations": A list of actionable recommendations for improvement.
      CONTEXT FROM UPLOADED DOCUMENTS:
      ---
      ${documentContext}
      ---
      USER'S QUESTIONNAIRE ANSWERS:
      - Technology Stack: ${JSON.stringify(userTechStack)}
    `;

    // NEW: Prompt for Data Readiness & Governance Analysis
    const dataPrompt = `
      You are a data governance and privacy expert. Review the following list of datasets and governance practices based on user answers and Document context. Assess the potential for using this data in an AI model.
      Return a valid JSON object, enclosed in \`\`\`json ... \`\`\`, with three keys:
      1. "dataSuitability": A summary of how suitable the described data is for AI.
      2. "identifiedRisks": A list of potential risks related to privacy (PII), bias, or compliance.
      3. "governanceRecommendations": A list of concrete steps to improve data governance.
      CONTEXT FROM UPLOADED DOCUMENTS:
      ---
      ${documentContext}
      ---
      USER'S QUESTIONNAIRE ANSWERS:
      - Available Datasets: ${JSON.stringify(userDatasets)}
      - Governance Practices: ${JSON.stringify(userGovernance)}
    `;

    // --- 3. Run both analyses in parallel for efficiency ---
    const [businessResponse, teamResponse, techResponse, dataResponse] =
      await Promise.all([
        llm.invoke(businessPrompt),
        llm.invoke(teamPrompt),
        llm.invoke(techPrompt),
        llm.invoke(dataPrompt),
      ]);

    // --- 4. Parse the results from both analyses ---
    const report = {
      businessStrategyAnalysis: parseLlmResponse(businessResponse),
      teamSkillsAnalysis: parseLlmResponse(teamResponse),
      techStackAnalysis: parseLlmResponse(techResponse), // NEW
      dataGovernanceAnalysis: parseLlmResponse(dataResponse), // NEW
    };
    await AnalysisReport.findOneAndUpdate(
      { projectId: req.params.projectId },
      {
        report: report,
        updatedAt: new Date(),
      },
      { upsert: true, new: true } // Creates if it doesn't exist, updates if it does
    );

    // --- 5. Combine results into a single report and send to the client ---
    res.status(200).json(report);
  } catch (error) {
    console.error("Error during assessment analysis:", error);
    res.status(500).json({
      error: "An unexpected error occurred during analysis.",
      details: error.message,
    });
  }
};

exports.downloadReportAsDocx = async (req, res) => {
  try {
    const { projectId } = req.params;
    const savedReport = await AnalysisReport.findOne({ projectId });

    if (!savedReport || !savedReport.report) {
      return res
        .status(404)
        .json({ error: "No analysis report found to download." });
    }

    const report = savedReport.report;
    const reportDate = new Date(
      savedReport.updatedAt || savedReport.generatedAt
    ).toLocaleDateString();

    // --- Helper functions for consistent styling ---
    const createSectionTitle = (text) =>
      new Paragraph({
        /* ... */
      });
    const createSubHeading = (text) =>
      new Paragraph({
        /* ... */
      });

    const children = [];

    // Main Title
    children.push(
      new Paragraph({
        /* ... */
      })
    );
    children.push(
      new Paragraph({
        /* ... */
      })
    );

    // --- DEFENSIVE CHECKING IS ADDED IN EACH SECTION ---

    // 1. Business Strategy Section
    children.push(
      createSectionTitle("Business Strategy & Suggested Use Cases")
    );
    (report.businessStrategyAnalysis || []).forEach((item) => {
      children.push(
        createSubHeading(item.objective || "No Objective Provided")
      );
      children.push(
        new Paragraph({
          children: [new TextRun({ text: item.analysis || "", italics: true })],
        })
      );
      (item.suggestedUseCases || []).forEach((uc) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${uc.useCase || ""}:`, bold: true }),
              new TextRun(` ${uc.explanation || ""}`),
            ],
            bullet: { level: 0 },
          })
        );
      });
    });

    // 2. Team & Skills Section
    if (report.teamSkillsAnalysis) {
      children.push(createSectionTitle("Team & Skills Assessment"));
      children.push(createSubHeading("Strengths"));
      (report.teamSkillsAnalysis.strengths || []).forEach((s) =>
        children.push(new Paragraph({ text: s, bullet: { level: 0 } }))
      );
      children.push(createSubHeading("Identified Gaps"));
      (report.teamSkillsAnalysis.gaps || []).forEach((g) =>
        children.push(new Paragraph({ text: g, bullet: { level: 0 } }))
      );
      children.push(createSubHeading("Recommendations"));
      (report.teamSkillsAnalysis.recommendations || []).forEach((r) =>
        children.push(new Paragraph({ text: r, bullet: { level: 0 } }))
      );
    }

    // 3. Technology Stack Section
    if (report.techStackAnalysis) {
      children.push(createSectionTitle("Technology Stack Review"));
      children.push(
        new Paragraph({ text: report.techStackAnalysis.analysis || "" })
      );
      children.push(createSubHeading("Potential Bottlenecks"));
      (report.techStackAnalysis.bottlenecks || []).forEach((b) =>
        children.push(new Paragraph({ text: b, bullet: { level: 0 } }))
      );
      children.push(createSubHeading("Recommendations"));
      (report.techStackAnalysis.recommendations || []).forEach((r) =>
        children.push(new Paragraph({ text: r, bullet: { level: 0 } }))
      );
    }

    // 4. Data Readiness & Governance Section
    if (report.dataGovernanceAnalysis) {
      children.push(createSectionTitle("Data Readiness & Governance Analysis"));
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Data Suitability: ", bold: true }),
            new TextRun(report.dataGovernanceAnalysis.dataSuitability || ""),
          ],
        })
      );
      children.push(createSubHeading("Identified Risks"));
      (report.dataGovernanceAnalysis.identifiedRisks || []).forEach(
        (riskCategory) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: riskCategory.category || "Uncategorized Risk",
                  bold: true,
                }),
              ],
              spacing: { before: 200 },
            })
          );
          (riskCategory.risks || []).forEach((riskDetail) => {
            children.push(
              new Paragraph({ text: riskDetail, bullet: { level: 0 } })
            );
          });
        }
      );
      children.push(createSubHeading("Governance Recommendations"));
      (report.dataGovernanceAnalysis.governanceRecommendations || []).forEach(
        (r) => children.push(new Paragraph({ text: r, bullet: { level: 0 } }))
      );
    }

    // Create the document
    const doc = new Document({ sections: [{ children }] });

    // Generate and Send the File
    const buffer = await Packer.toBuffer(doc);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="AI-Readiness-Report-${projectId}.docx"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error generating DOCX report:", error);
    res.status(500).json({ error: "Failed to generate DOCX report." });
  }
};
