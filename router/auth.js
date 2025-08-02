const express = require("express");
const router = express.Router();
const passport = require("../services/passport");

//Initiate Google Login
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth Callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: true,
  }),
  (req, res) => {
    res.redirect("http://localhost:4200/dashboard");
  }
);
router.get("/test-db", async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ db_connected: true, user_count: count });
  } catch (err) {
    res.status(500).json({ db_connected: false, error: err.message });
  }
});

router.get("/check-session", (req, res) => {
  console.log("Check-session route hit"); // Add this line
  console.log("Session User:", req.user);
  console.log("Is Authenticated:", req.isAuthenticated());
  if (req.isAuthenticated()) {
    return res.json({
      authenticated: true,
      user: {
        id: req.user._id,
        name: req.user.displayName,
        email: req.user.email,
        picture: req.user.profilePicture,
      },
    });
  }
  res.status(401).json({ authenticated: false });
});

router.post("/logout", (req, res) => {
  req.logout(() => {
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

module.exports = router;
