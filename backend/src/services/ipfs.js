import axios from "axios";
import FormData from "form-data";

/**
 * Uploads a Buffer to Pinata IPFS, returns ipfs://CID.
 * Requires PINATA_JWT in env. Falls back to "ipfs://demo-<sha256>" in dev
 * so the rest of the flow works without a Pinata key.
 */
export async function uploadToIPFS(filename, buffer, contentType = "application/octet-stream") {
  if (!process.env.PINATA_JWT) {
    const crypto = await import("node:crypto");
    const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
    return { cid: "demo-" + hash, uri: `ipfs://demo-${hash}`, mock: true };
  }
  const form = new FormData();
  form.append("file", buffer, { filename, contentType });
  const res = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    form,
    {
      maxBodyLength: Infinity,
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
        ...form.getHeaders(),
      },
    }
  );
  const cid = res.data.IpfsHash;
  return { cid, uri: `ipfs://${cid}`, mock: false };
}

export async function uploadJSON(obj) {
  const buf = Buffer.from(JSON.stringify(obj));
  return uploadToIPFS("metadata.json", buf, "application/json");
}
