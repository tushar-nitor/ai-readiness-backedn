// config/passport.js
const Passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
// const MicrosoftStrategy = require("passport-microsoft-oauth2").Strategy;
const User = require("../models/user_schema"); //
require("dotenv").config();

module.exports = function (passport) {
  // --- Google Strategy ---
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/callback", // Full URL
      },
      async (accessToken, refreshToken, profile, done) => {
        console.log("--- Google Strategy Callback Started ---");
        const email =
          profile.emails && profile.emails.length > 0
            ? profile.emails[0].value
            : null;
        console.log("Extracted Email:", email);

        const newUserProfile = {
          /* ... */ googleId: profile.id,
          displayName: profile.displayName,
          email: profile.emails[0].value, // Ensure email exists
          profilePicture: profile.photos?.[0]?.value, // Optional: profile picture
          provider: "google",
        };

        try {
          // Attempt to find by googleId
          let user = await User.findOne({ googleId: newUserProfile.googleId });
          if (user) {
            console.log("User found by googleId:", user.email);
            return done(null, user);
          }

          // Attempt to find by email
          if (newUserProfile.email) {
            user = await User.findOne({ email: newUserProfile.email });
            if (user) {
              console.log(
                "User found by email (possible linking):",
                user.email,
                "Provider:",
                user.provider
              );
              if (user.provider === "microsoft" && !user.googleId) {
                user.googleId = newUserProfile.googleId;
                await user.save();
                console.log("User linked Google ID successfully.");
                return done(null, user);
              } else if (user.provider === "google") {
                // This scenario should be rare if findOne by googleId worked
                console.warn(
                  "Duplicate Google ID check. User already exists via Google:",
                  user.email
                );
                return done(null, user); // Still log in
              }
              // Handle conflict if email exists but not linked properly
              console.error(
                "Email conflict: Account with this email already exists with a different provider and cannot be linked automatically."
              );
              return done(
                new Error(
                  "An account with this email already exists via a different provider and cannot be linked."
                ),
                null
              );
            }
          }

          // If no user found by googleId or email, create new
          user = await User.create(newUserProfile);
          console.log("New user created successfully:", user.email);
          done(null, user);
        } catch (err) {
          console.error("*** ERROR IN GOOGLE STRATEGY CALLBACK ***");
          console.error(err); // <-- THIS IS CRITICAL
          if (err.code === 11000) {
            // MongoDB duplicate key error code
            console.error(
              "MongoDB Duplicate Key Error - User may already exist with this email/ID."
            );
            return done(
              new Error("Account already exists. Please try logging in."),
              null
            );
          }
          done(err, null); // Pass the error to Passport
        } finally {
          console.log("--- Google Strategy Callback Ended ---");
        }
      }
    )
  );

  // --- Microsoft Strategy (logic is parallel to Google Strategy) ---
  // passport.use(
  //   new MicrosoftStrategy(
  //     {
  //       /* ... config ... */
  //     },
  //     async (accessToken, refreshToken, profile, done) => {
  //       const email =
  //         profile.emails && profile.emails.length > 0
  //           ? profile.emails[0].value
  //           : null;

  //       const newUserProfile = {
  //         // Data to potentially save/update
  //         microsoftId: profile.id,
  //         displayName: profile.displayName,
  //         email: email,
  //         profilePicture:
  //           profile.photos && profile.photos.length > 0
  //             ? profile.photos[0].value
  //             : null,
  //         provider: "microsoft",
  //       };

  //       try {
  //         // MongoDB Interaction Point 1: FIND user by Microsoft ID
  //         let user = await User.findOne({
  //           microsoftId: newUserProfile.microsoftId,
  //         });

  //         if (user) {
  //           return done(null, user);
  //         }

  //         if (newUserProfile.email) {
  //           // MongoDB Interaction Point 2: FIND user by email
  //           user = await User.findOne({ email: newUserProfile.email });
  //           if (user) {
  //             if (user.provider === "google" && !user.microsoftId) {
  //               // MongoDB Interaction Point 3: UPDATE existing user to link Microsoft ID
  //               user.microsoftId = newUserProfile.microsoftId;
  //               await user.save(); // <--- Mongoose method to save changes to an existing document
  //               return done(null, user);
  //             }
  //             return done(
  //               new Error(
  //                 "An account with this email already exists via a different provider."
  //               ),
  //               null
  //             );
  //           }
  //         }

  //         // MongoDB Interaction Point 4: CREATE NEW USER
  //         user = await User.create(newUserProfile); // <--- Mongoose method to create a new document
  //         done(null, user);
  //       } catch (err) {
  //         console.error("Error during Microsoft OAuth:", err);
  //         done(err, null);
  //       }
  //     }
  //   )
  // );

  // --- Serialize/Deserialize User (for session management) ---
  passport.serializeUser((user, done) => {
    // MongoDB Interaction Point 5: Get user ID to store in session
    done(null, user.id); // `user.id` is Mongoose's virtual getter for `_id`
  });

  passport.deserializeUser(async (id, done) => {
    try {
      // MongoDB Interaction Point 6: FIND user by ID from session
      const user = await User.findById(id); // <--- Mongoose method to find by _id
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};
