const express = require("express");
const session = require("express-session");
const passport = require("./services/passport");
const authRoutes = require("./router/auth"); // Ensure this path is correct
const cors = require("cors");
const connectDB = require("./config/db");
const documentRoutes = require("./router/documents");
const projectRoutes = require("./router/projects");
const questionnaireRoutes = require("./router/questionare");
const assessmentRoutes = require("./router/assessment"); // Ensure this path is correct
const app = express();

// connectDB();
const allowedOrigins = [
  "http://localhost:4200",
  "https://ai-readiness-indol.vercel.app/",
  "https://ai-readiness-tushar-nitors-projects.vercel.app/",
];

// Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "FETCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Session configuration
app.use(
  session({
    secret: "strong-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // false for localhost over HTTP
      httpOnly: true,
      sameSite: "lax", // Or "none" if you are testing on different domains/ports with HTTPS only
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

app.use("/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/questionnaire", questionnaireRoutes);
app.use("/api/assessment", assessmentRoutes);
app.get("/", (req, res) => res.send("Express on Vercel"));

// Test endpoint
app.get("/test", (req, res) => {
  res.send("Server is working!");
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
console.log("Server running ");

// module.exports = app;
