const express = require("express");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const twilio = require("twilio");
const crypto = require("crypto");
const path = require("path");
const cron = require("node-cron");

require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist")));

const adapter = new FileSync("db.json");
const db = low(adapter);
db.defaults({ customers: [], responses: [] }).write();

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, BASE_URL, PORT = 3001 } = process.env;
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

function generateToken() { return crypto.randomBytes(16).toString("hex"); }
function getSurveyUrl(token) { return `${BASE_URL}/survey?token=${token}`; }

async function sendSMS(to, customerName, surveyUrl) {
  return twilioClient.messages.create({
    body: `Hi ${customerName}! Thanks for choosing Ski Doc Calgary! Take a 30-second survey and drop us a review to get $10 off your next tuneup! ${surveyUrl}`,
    from: TWILIO_PHONE_NUMBER,
    to,
  });
}

app.post("/api/customers", (req, res) => {
  const { name, phone, service_at } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "name and phone are required" });
  const customer = {
    id: Date.now(), name, phone,
    service_at: service_at || new Date().toISOString(),
    token: generateToken(), notified_at: null,
    created_at: new Date().toISOString(),
  };
  db.get("customers").push(customer).write();
  res.json({ success: true, token: customer.token, survey_url: getSurveyUrl(customer.token) });
});

app.post("/api/submit-feedback", (req, res) => {
  const { token, rating, feedback } = req.body;
  if (!token || !rating) return res.status(400).json({ error: "token and rating required" });
  db.get("responses").push({ id: Date.now(), token, rating, feedback: feedback || null, submitted_at: new Date().toISOString() }).write();
  res.json({ success: true });
});

app.get("/api/responses", (req, res) => {
  const responses = db.get("responses").value();
  const customers = db.get("customers").value();
  const result = responses.map(r => {
    const c = customers.find(c => c.token === r.token) || {};
    return { ...r, name: c.name, phone: c.phone, service_at: c.service_at };
  }).reverse();
  res.json(result);
});

app.get("/api/stats", (req, res) => {
  const responses = db.get("responses").value();
  const total = responses.length;
  const avg = total ? (responses.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(2) : null;
  const distribution = [1,2,3,4,5].map(rating => ({ rating, count: responses.filter(r => r.rating === rating).length }));
  res.json({ total, average: avg, distribution });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

cron.schedule("*/5 * * * *", async () => {
  const now = new Date();
  const pending = db.get("customers").filter(c => {
    if (c.notified_at) return false;
    const hoursAgo = (now - new Date(c.service_at)) / (1000 * 60 * 60);
    return hoursAgo >= 0 && hoursAgo < 1;
  }).value();
  for (const customer of pending) {
    try {
      await sendSMS(customer.phone, customer.name, getSurveyUrl(customer.token));
      console.log(`SMS sent to ${customer.name}`);
      db.get("customers").find({ id: customer.id }).assign({ notified_at: new Date().toISOString() }).write();
    } catch (err) {
      console.error(`Failed to text ${customer.name}:`, err.message);
    }
  }
});

app.listen(PORT, () => console.log(`FeedbackFlow running on http://localhost:${PORT}`));
