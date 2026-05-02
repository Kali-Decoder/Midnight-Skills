import { readFileSync } from "fs";
import { join } from "path";
import { getCollection, hashIp } from "./_lib/db.js";

const VALID_SKILLS = [
  "scaffold",
  "addresses",
  "wallet",
  "wallet-integration",
  "vercel-deploy",
  "tooling-and-infra",
  "decryption",
  "private-token",
  "vesting-wallet",
  "erc20-wrapper",
  "erc7984-standard",
  "confidential-payroll",
];

export default async function handler(req, res) {
  const skill = req.query.name;

  if (!skill || !VALID_SKILLS.includes(skill)) {
    return res.status(404).send("Skill not found");
  }

  let content;
  try {
    const filePath = skill === "monskill"
      ? join(process.cwd(), "SKILL.md")
      : join(process.cwd(), skill, "SKILL.md");
    content = readFileSync(filePath, "utf-8");
  } catch {
    return res.status(404).send("Skill not found");
  }

  // Fire-and-forget: log the download to MongoDB
  if (process.env.MONGODB_URI) {
    const rawIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      "unknown";
    const ipHash = hashIp(rawIp);

    try {
      const collection = await getCollection();
      await collection.insertOne({
        skill_name: skill,
        ip_hash: ipHash,
        downloaded_at: new Date(),
      });
    } catch (e) {
      console.error("Failed to log download:", e);
    }
  }

  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.status(200).send(content);
}
