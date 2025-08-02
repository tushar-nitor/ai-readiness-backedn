const fs = require("fs");
const path = require("path");
const Document = require("../models/document_schema");
const { s3, PutObjectCommand, DeleteObjectCommand } = require("../config/s3");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const llm = require("../config/gemini");

// Helper to extract text
async function extractText(filePath, mimetype) {
  if (mimetype === "application/pdf") {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text;
  } else if (
    mimetype ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value;
  }
  return "";
}

// Gemini context extraction
async function extractContextLLM(text) {
  if (!text || text.trim().length === 0) return null;
  const prompt = `Summarize and extract the main ideas from this document:\n${text}`;
  const response = await llm.invoke(prompt);
  return response.content;
}

// ---- CONTROLLER FUNCTIONS ----

exports.uploadDocuments = async (req, res) => {
  const projectId = req.body.projectId || req.query.projectId;
  if (!projectId)
    return res.status(400).json({ error: "Project ID is required" });
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: "No files uploaded" });

  try {
    const savedDocs = [];

    for (const file of req.files) {
      const timestamp = Date.now();
      const safeFileName = file.originalname.replace(/\s+/g, "_");
      const uniqueKey = `${timestamp}_${safeFileName}`;

      // S3 Upload
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: uniqueKey,
          Body: fs.createReadStream(path.resolve(file.path)),
          ContentType: file.mimetype,
        })
      );

      // Extract text (PDF/DOCX)
      let extractedText = "";
      try {
        extractedText = await extractText(file.path, file.mimetype);
      } catch (ex) {
        console.warn("Text extraction failed:", ex);
      }

      // Send to Gemini LLM if text is present
      let context = null;
      try {
        if (extractedText) context = await extractContextLLM(extractedText);
      } catch (llmErr) {
        console.warn("LLM summarization error for", file.originalname, llmErr);
      }

      // Save in MongoDB
      const doc = await Document.create({
        projectId,
        originalName: file.originalname,
        storageName: uniqueKey,
        size: file.size,
        status: "uploaded",
        context,
      });
      savedDocs.push(doc);

      // Remove temp file
      fs.unlink(file.path, (err) => {
        if (err) console.warn("Failed to delete local file: " + file.path, err);
      });
    }

    res.json({
      status: "success",
      message: `${savedDocs.length} file(s) uploaded successfully.`,
      files: savedDocs,
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({
      error: "Upload failed",
      details: error.message || error.toString(),
    });
  }
};

exports.getDocumentsByProject = async (req, res) => {
  const { projectId } = req.params;
  try {
    const docs = await Document.find({ projectId }).sort({ uploadedAt: -1 });
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch documents for project" });
  }
};

exports.deleteDocument = async (req, res) => {
  const docId = req.params.id;
  try {
    const doc = await Document.findById(docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    // Delete file on S3/B2
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: doc.storageName,
      })
    );

    // Delete DB record
    await Document.findByIdAndDelete(docId);

    res.json({ success: true, message: "File and DB record deleted" });
  } catch (err) {
    console.error("File delete error:", err);
    res.status(500).json({ error: `Failed to delete file: ${err}` });
  }
};
