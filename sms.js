require('dotenv').config();

const axios = require('axios');

const SEMAPHORE_API_KEY  = process.env.SEMAPHORE_API_KEY;
const SEMAPHORE_SENDER   = process.env.SEMAPHORE_SENDER_NAME || 'MedQueue';
const SEMAPHORE_ENDPOINT = 'https://api.semaphore.co/api/v4/messages';

// ── Send a raw SMS ──
async function sendSMS(mobile, message) {
  if (!SEMAPHORE_API_KEY) {
    console.warn('SMS skipped — SEMAPHORE_API_KEY not set in .env');
    return;
  }

  try {
    const res = await axios.post(SEMAPHORE_ENDPOINT, {
      apikey:      SEMAPHORE_API_KEY,
      number:      mobile,
      message,
      sendername:  SEMAPHORE_SENDER,
    });
    console.log(`SMS sent to ${mobile}:`, res.data);
    return res.data;
  } catch (err) {
    console.error(`SMS failed to ${mobile}:`, err.response?.data || err.message);
    throw err;
  }
}

// ── SMS 1 — Patient is 2 patients away ──
// Triggered when Call Next is clicked and this patient is now 2nd in line
async function sendSMSAlmostTurn({ name, mobile, counter, department, queueNumber }) {
  const message =
    `Hi ${name}! You are 2 patients away. ` +
    `Please proceed to ${counter}, ${department}. ` +
    `Your Queue Number: ${queueNumber} ` +
    `— MedQueue`;

  return sendSMS(mobile, message);
}

// ── SMS 2 — It is exactly the patient's turn ──
// Triggered when Call Next makes this patient Now Serving
async function sendSMSYourTurn({ name, mobile, counter, department, queueNumber }) {
  const message =
    `Hi ${name}! It is your turn now! ` +
    `Please go to ${counter}, ${department} immediately. ` +
    `Queue Number: ${queueNumber} ` +
    `— MedQueue`;

  return sendSMS(mobile, message);
}

module.exports = {
  sendSMSAlmostTurn,
  sendSMSYourTurn,
};