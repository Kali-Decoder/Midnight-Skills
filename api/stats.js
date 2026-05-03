import { getCollection } from "./_lib/db.js";

const PROJECT = "MIDNIGHT SKILLS";

export default async function handler(req, res) {
  if (!process.env.STATS_SECRET || req.query.key !== process.env.STATS_SECRET) {
    return res.status(401).json({ error: `${PROJECT} stats unauthorized` });
  }

  if (!process.env.MONGODB_URI) {
    return res.status(500).json({ error: `${PROJECT} MONGODB_URI not configured` });
  }

  const collection = await getCollection();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totals, daily, uniqueVisitors] = await Promise.all([
    collection.aggregate([
      { $group: { _id: "$skill_name", downloads: { $sum: 1 } } },
      { $project: { _id: 0, skill_name: "$_id", downloads: 1 } },
      { $sort: { downloads: -1 } },
    ]).toArray(),
    collection.aggregate([
      { $match: { downloaded_at: { $gt: since } } },
      { $group: {
        _id: {
          skill_name: "$skill_name",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$downloaded_at" } },
        },
        downloads: { $sum: 1 },
      } },
      { $project: { _id: 0, skill_name: "$_id.skill_name", date: "$_id.date", downloads: 1 } },
      { $sort: { date: -1, downloads: -1 } },
    ]).toArray(),
    collection.aggregate([
      { $group: { _id: { skill_name: "$skill_name", ip_hash: "$ip_hash" } } },
      { $group: { _id: "$_id.skill_name", unique_visitors: { $sum: 1 } } },
      { $project: { _id: 0, skill_name: "$_id", unique_visitors: 1 } },
      { $sort: { unique_visitors: -1 } },
    ]).toArray(),
  ]);

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.status(200).json({
    project: PROJECT,
    totals,
    unique_visitors: uniqueVisitors,
    daily_last_30_days: daily,
  });
}
