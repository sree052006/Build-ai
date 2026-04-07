import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const ACCOUNT_SID = "AC29a554145647da09dbaf99df499e7532";
const AUTH_TOKEN = "0d903786817067c5b2174dbaf41fb673";
const FROM_NUMBER = "+17125258963";
// const FROM_NUMBER = "+919539162654";


app.post('/call', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Missing "to" phone number' });

  const twiml = `
    <Response>
      <Pause length="1"/>
      <Say voice="alice" language="en-US">
        CRITICAL EMERGENCY ALERT from Guardian A I. A sudden fall has been detected.
        Please open your caregiver application immediately to acknowledge this alarm.
        This is not a test.
      </Say>
    </Response>
  `;

  const body = new URLSearchParams();
  body.append('To', to);
  body.append('From', FROM_NUMBER);
  body.append('Twiml', twiml);

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('Twilio Error:', data);
      return res.status(response.status).json({ error: data.message, code: data.code });
    }

    console.log(`✅ Call dispatched to ${to} | SID: ${data.sid}`);
    res.json({ success: true, sid: data.sid });

  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log('🚨 Guardian AI Phone Server running on http://localhost:3001');
});
