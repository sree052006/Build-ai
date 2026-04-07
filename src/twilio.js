// TWILIO API DIRECT INTEGRATION (HACKATHON EDITION)
// Warning: Exposing Twilio Auth Tokens in frontend code works for hackathons,
// but should be moved to a backend (like Firebase Functions or Node.js) for real production.

export const TWILIO_CONFIG = {
  ACCOUNT_SID: import.meta.env.VITE_TWILIO_ACCOUNT_SID,
  AUTH_TOKEN: import.meta.env.VITE_TWILIO_AUTH_TOKEN,
  FROM_NUMBER: import.meta.env.VITE_TWILIO_FROM_NUMBER,
  TO_NUMBER: import.meta.env.VITE_TWILIO_TO_NUMBER
};

export async function makeEmergencyPhoneCall(toNumber, role) {
  const finalToNumber = toNumber || TWILIO_CONFIG.TO_NUMBER;

  if (!finalToNumber) {
    console.warn(`[Twilio Error] Cannot call ${role}: No phone number provided in settings or TWILIO_CONFIG.`);
    return;
  }

  // Ensure number is properly formatted (assuming US country code for simplicity if they forget it)
  // Wait, if it's an Indian number (+91), we shouldn't force +1!
  let formattedNumber = finalToNumber;
  if (!formattedNumber.startsWith('+')) {
    // If it starts with an country code just without plus, add plus.
    // If it's a 10 digit number, assume +1
    if (formattedNumber.length === 10) {
      formattedNumber = '+1' + formattedNumber;
    } else {
      formattedNumber = '+' + formattedNumber.replace(/[^0-9]/g, '');
    }
  }

  // We target our new local proxy set up in vite.config.js to bypass all Browser CORS blocks!
  const url = `/api/twilio/2010-04-01/Accounts/${TWILIO_CONFIG.ACCOUNT_SID}/Calls.json`;

  // TwiML (The XML script that tells Twilio what the robot voice should speak out loud)
  const twiml = `
    <Response>
      <Pause length="1"/>
      <Say voice="alice" language="en-US">
         CRITICAL EMERGENCY ALERT from Guardian A I. A sudden fall has been detected. 
         Please open your caregiver dispatch application immediately to acknowledge this alarm. 
         This is not a test.
      </Say>
    </Response>
  `;

  try {
    // Call our local Express server (call-server.js) which contacts Twilio safely server-side
    // This eliminates the browser's native "Username/Password" popup completely!
    console.log(`Dispatching call to ${formattedNumber} via Guardian call-server...`);
    const response = await fetch('http://localhost:3001/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: formattedNumber })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Call Server Error:", data);
      alert(`Guardian Call Server Error: ${data.error}`);
    } else {
      console.log(`✅ Call dispatched! Twilio SID: ${data.sid}`);
    }
    return data;
  } catch (error) {
    console.error("Call server unreachable. Is call-server.js running?", error);
    alert("⚠️ Call server offline! Run: node call-server.js in a new terminal.");
  }
}
