const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Simulated Cloud Function for Hackathon Escallation Workflow
exports.dispatchEmergencyWorkflow = functions.database
  .ref('/guardian/active_alert')
  .onWrite(async (change, context) => {
    const alertData = change.after.val();

    if (!alertData || alertData.status === 'Resolved' || alertData.escalated_to_emergency) {
      return null;
    }

    // Step 1: Simulated Initial SMS dispatch
    // In production, Twilio code goes here to text Caretaker & Family Member
    console.log(`[ALERT] Dispatching Fall Notification to Caretaker & Family Member for Alert ID: ${alertData.id}`);

    // Step 2: 5-Minute Wait for Escalation Check
    // (For real prod we use Google Cloud Tasks or 300,000ms. For the live Hackathon Demo, we compress 5 minutes into 30 seconds!)
    const DEMO_TIMEOUT_MS = 30000; // Represents 5 mins

    return new Promise((resolve) => {
        setTimeout(async () => {
            // Re-fetch the alert to check if they BOTH attended the call and clicked SEEN
            const snapshot = await admin.database().ref('/guardian/active_alert').once('value');
            const currentAlert = snapshot.val();
            
            if (currentAlert && currentAlert.id === alertData.id) {
                // To safely dismiss, both must have answered the call AND marked as seen
                const bothAttended = currentAlert.caretaker_answered && currentAlert.family_answered;
                const bothSeen = currentAlert.caretaker_seen && currentAlert.family_seen;
                
                if (!(bothAttended && bothSeen) && currentAlert.status !== 'Resolved') {
                    console.log(`[ESCALATION] 5 Minutes passed! Both parties did not attend or acknowledge. Dispatching EMERGENCY HELPLINE...`);
                    
                    // Trigger emergency flag in Firebase to update UI
                    await admin.database().ref('/guardian/active_alert').update({
                       escalated_to_emergency: true
                    });
                } else {
                    console.log(`[SAFE] Alert was acknowledged within the 5-minute time limit.`);
                }
            }
            resolve();
        }, DEMO_TIMEOUT_MS);
    });
  });
