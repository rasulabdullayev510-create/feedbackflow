// ============================================================
// FeedbackFlow Backend — server.js
// SMS ONLY VERSION — Twilio + SQLite + Express
// ============================================================

const express = require("express");
const Database = require("better-sqlite3");
const twilio = require("twilio");
const crypto = require("crypto");
const path = require("path");
const cron = require("node-cron");

require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist")));

// ─── Config ────────────────────────────────────────────────
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  BASE_URL,
  PORT = 3001,
} = process.env;

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// ─── Database ───────────────────────────────────────────────
const db = new Database("feedbackflow.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,
    service_at  DATETIME NOT NULL,
    token       TEXT UNIQUE NOT NULL,
    notified_at DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS responses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    token        TEXT NOT NULL,
    rating       INTEGER NOT NULL,
    feedback     TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ─── Helpers ────────────────────────────────────────────────
function generateToken() {
  return crypto.randomBytes(16).toString("hex");
}

function getSurveyUrl(token) {
  return `${BASE_URL}/survey?token=${token}`;
}

async function sendSMS(to, customerName, surveyUrl) {
  return twilioClient.messages.create({
    body: `Hi ${customerName}! Thanks for visiting us. How'd we do? Quick 30-sec survey: ${surveyUrl}`,
    from: TWILIO_PHONE_NUMBER,
    to,
  });
}

// ─── Routes ─────────────────────────────────────────────────

// POST /api/customers — add a customer after their service
app.post("/api/customers", (req, res) => {
  const { name, phone, service_at } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: "name and phone are required" });
  }

  const token = generateToken();
  const serviceAt = service_at || new Date().toISOString();

  db.prepare(
    "INSERT INTO customers (name, phone, service_at, token) VALUES (?, ?, ?, ?)"
  ).run(name, phone, serviceAt, token);

  res.json({ success: true, token, survey_url: getSurveyUrl(token) });
});

// POST /api/submit-feedback — called by the survey page
app.post("/api/submit-feedback", (req, res) => {
  const { token, rating, feedback } = req.body;

  if (!token || !rating) {
    return res.status(400).json({ error: "token and rating required" });
  }

  db.prepare(
    "INSERT INTO responses (token, rating, feedback) VALUES (?, ?, ?)"
  ).run(token, rating, feedback || null);

  res.json({ success: true });
});

// GET /api/responses — view all negative feedback
app.get("/api/responses", (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, c.name, c.phone, c.service_at
    FROM responses r
    LEFT JOIN customers c ON c.token = r.token
    ORDER BY r.submitted_at DESC
  `).all();
  res.json(rows);
});

// GET /api/stats
app.get("/api/stats", (req, res) => {
  const total = db.prepare("SELECT COUNT(*) as count FROM responses").get();
  const avg = db.prepare("SELECT AVG(rating) as avg FROM responses").get();
  const dist = db.prepare(
    "SELECT rating, COUNT(*) as count FROM responses GROUP BY rating"
  ).all();
  res.json({ total: total.count, average: avg.avg?.toFixed(2), distribution: dist });
});

// Catch-all → serve React app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ─── 24hr SMS Cron ──────────────────────────────────────────
cron.schedule("*/5 * * * *", async () => {
  const pending = db.prepare(`
    SELECT * FROM customers
    WHERE notified_at IS NULL
      AND service_at <= datetime('now', '-24 hours')
      AND service_at >= datetime('now', '-25 hours')
  `).all();

  for (const customer of pending) {
    const url = getSurveyUrl(customer.token);
    try {
      await sendSMS(customer.phone, customer.name, url);
      console.log(`📱 SMS sent to ${customer.name} (${customer.phone})`);
      db.prepare("UPDATE customers SET notified_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(customer.id);
    } catch (err) {
      console.error(`Failed to text ${customer.name}:`, err.message);
    }
  }
});

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`FeedbackFlow running on http://localhost:${PORT}`);
});
