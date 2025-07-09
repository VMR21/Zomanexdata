import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const SELF_URL = "https://zomanexdata.onrender.com/leaderboard/top14";
const API_KEY = "TFGofJfFumRfz2xg5PmG4bUSTFcnhr1T";

let cachedCurrent = [];
let cachedPrevious = [];

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

function getDateRangeFrom9To8(monthOffset = 0) {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 9));

  const start = new Date(base);
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 9));
  end.setSeconds(end.getSeconds() - 1); // make it end at 8th 23:59:59

  return {
    startStr: start.toISOString().slice(0, 10),
    endStr: end.toISOString().slice(0, 10),
  };
}

async function fetchLeaderboardData(monthOffset = 0) {
  const { startStr, endStr } = getDateRangeFrom9To8(monthOffset);
  const url = `https://services.rainbet.com/v1/external/affiliates?start_at=${startStr}&end_at=${endStr}&key=${API_KEY}`;

  const response = await fetch(url);
  const json = await response.json();
  if (!json.affiliates) throw new Error("No data");

  const sorted = json.affiliates
    .filter((a) => a.username && a.wagered_amount)
    .sort((a, b) => parseFloat(b.wagered_amount) - parseFloat(a.wagered_amount))
    .slice(0, 10);

  // ⛓ Swap top 2
  if (sorted.length >= 2) {
    [sorted[0], sorted[1]] = [sorted[1], sorted[0]];
  }

  return sorted.map((entry) => ({
    username: maskUsername(entry.username),
    wagered: Math.round(parseFloat(entry.wagered_amount)),
    weightedWager: Math.round(parseFloat(entry.wagered_amount)),
  }));
}

async function fetchAndCacheData() {
  try {
    cachedCurrent = await fetchLeaderboardData(0);   // current 9→8
    cachedPrevious = await fetchLeaderboardData(-1); // previous 9→8
    console.log("[✅] Leaderboard (current + previous) updated");
  } catch (err) {
    console.error("[❌] Fetch failed:", err.message);
  }
}

fetchAndCacheData();
setInterval(fetchAndCacheData, 5 * 60 * 1000); // every 5 mins

app.get("/leaderboard/top14", (req, res) => {
  res.json(cachedCurrent);
});

app.get("/leaderboard/prev", (req, res) => {
  res.json(cachedPrevious);
});

setInterval(() => {
  fetch(SELF_URL)
    .then(() => console.log(`[🔁] Self-pinged ${SELF_URL}`))
    .catch(err => console.error("[⚠️] Self-ping failed:", err.message));
}, 270000); // every 4.5 mins

app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));
