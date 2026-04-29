import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../models/User.js";

export const GOOGLE_SCOPES = [
  "profile",
  "email",
  "https://www.googleapis.com/auth/youtube.readonly",
];
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const u = await User.findById(id);
    done(null, u);
  } catch (e) {
    done(e);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: GOOGLE_SCOPES,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.create({
            googleId: profile.id,
            email,
            displayName: profile.displayName,
          });
        }
        if (refreshToken) user.ytRefreshToken = refreshToken;
        // stash the access token so /channels/verify can call YouTube
        user.ytAccessToken = accessToken;
        await user.save();
        done(null, user);
      } catch (e) {
        done(e);
      }
    }
  )
);
