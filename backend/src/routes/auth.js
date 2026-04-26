import { Router } from "express";
import passport from "passport";
import { issueJwt, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get(
  "/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/failure" }),
  (req, res) => {
    const token = issueJwt(req.user);
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 3600 * 1000,
    });
    res.redirect(process.env.FRONTEND_URL + "/dashboard");
  }
);

router.get("/failure", (_req, res) => res.status(401).send("login failed"));

router.get("/me", requireAuth, (req, res) => {
  const { id, email, displayName, wallet, verifiedChannels } = req.user;
  res.json({ id, email, displayName, wallet, verifiedChannels });
});

router.post("/logout", (req, res) => {
  res.clearCookie("token");
  req.logout?.(() => {});
  res.json({ ok: true });
});

export default router;
