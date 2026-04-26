import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import mongoose from "mongoose";

import "./services/passport.js";
import authRoutes from "./routes/auth.js";
import channelRoutes from "./routes/channels.js";
import tradeRoutes from "./routes/trades.js";
import milestoneRoutes from "./routes/milestones.js";
import analyticsRoutes from "./routes/analytics.js";
import ipfsRoutes from "./routes/ipfs.js";
import forecastRoutes from "./routes/forecast.js";
import platformRoutes from "./routes/platforms.js";
import { startMilestoneResolver } from "./jobs/milestoneResolver.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/", (_req, res) => res.json({ ok: true, service: "ytbc-backend" }));

app.use("/auth", authRoutes);
app.use("/channels", channelRoutes);
app.use("/trades", tradeRoutes);
app.use("/milestones", milestoneRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/ipfs", ipfsRoutes);
app.use("/forecast", forecastRoutes);
app.use("/platforms", platformRoutes);

(async () => {
  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("MongoDB connected");
    } else {
      console.warn("MONGO_URI not set — running without Mongo");
    }
    startMilestoneResolver();
    app.listen(PORT, () => console.log(`listening on ${PORT}`));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
