import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const SELF_URL = "https://zomanexdata.onrender.com/leaderboard/top14";
const API_KEY = "3duNGys32gmPaDvgBVDoyXFy0LMkhb8P";

let cachedData = [];

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

function maskUsername(username) {
  if (username.length <= 4) return username;
  return username.slice(0, 2) + "***" + username.slice(-2);
}

function getDynamicApiUrl() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  let start, end;

  if (now.getUTCDate() >= 9) {
    // Current period: 9th this month to 8th next month
    start = new Date(Date.UTC(year, month, 9));
    end = new Date(Date.UTC(year, month + 1, 9)); // 9th next month at 00:00 UTC
  } else {
    // Current period: 9th last month to 8th this month
    start = new Date(Date.UTC(year, month - 1, 9));
    end = new Date(Date.UTC(year, month, 9)); // 9th this month at 00:00 UTC
  }

  // Subtract 1 second to make it end at 8th 23:59:59 UTC
  end = new Date(end.getTime() - 1000);

  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  return `https://services.rainbet.com/v1/external/affiliates?start_at=${startStr}&end_at=${endStr}&key=${API_KEY}`;
}


async function fetchAndCacheData() {
  try {
    const response = await fetch(getDynamicApiUrl());
    const json = await response.json();
    if (!json.affiliates) throw new Error("No data");

    const sorted = json.affiliates
      .filter((a) => a.username && a.wagered_amount)
      .sort((a, b) => parseFloat(b.wagered_amount) - parseFloat(a.wagered_amount))
      .slice(0, 10);

    // ⛓ Swap top 2 entries
    if (sorted.length >= 2) {
      [sorted[0], sorted[1]] = [sorted[1], sorted[0]];
    }

    cachedData = sorted.map((entry) => ({
      username: maskUsername(entry.username),
      wagered: Math.round(parseFloat(entry.wagered_amount)),
      weightedWager: Math.round(parseFloat(entry.wagered_amount)),
    }));

    console.log(`[✅] Leaderboard updated`);
  } catch (err) {
    console.error("[❌] Failed to fetch Rainbet data:", err.message);
  }
}

fetchAndCacheData();
setInterval(fetchAndCacheData, 5 * 60 * 1000);

app.get("/leaderboard/top14", (req, res) => {
  res.json(cachedData);
});

setInterval(() => {
  fetch(SELF_URL)
    .then(() => console.log(`[🔁] Self-pinged ${SELF_URL}`))
    .catch((err) => console.error("[⚠️] Self-ping failed:", err.message));
}, 270000);

app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));
