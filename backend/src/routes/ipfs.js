import { Router } from "express";
import multer from "multer";
import { uploadToIPFS, uploadJSON } from "../services/ipfs.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** POST /ipfs/file  (multipart/form-data, field "file") → { cid, uri } */
router.post("/file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "no file" });
    const out = await uploadToIPFS(
      req.file.originalname,
      req.file.buffer,
      req.file.mimetype
    );
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/** POST /ipfs/json  (JSON body) → { cid, uri } */
router.post("/json", async (req, res) => {
  try {
    const out = await uploadJSON(req.body);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
