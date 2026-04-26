import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export function issueJwt(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET || "dev",
    { expiresIn: "7d" }
  );
}

export async function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "unauthenticated" });
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev");
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: "unauthenticated" });
    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ error: "bad token" });
  }
}
