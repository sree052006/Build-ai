const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export async function analyzeSensorDataWithGemini(base64Audio, base64Image) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = "Analyze this CCTV camera frame. Determine the person's current physical state (e.g., sitting, sleeping normally in bed, fallen on the floor, walking). Is the person in distress or have they fallen down? Evaluate the distress level on a scale from 1-10 (a fall is level 8-10, normal sleeping/sitting is 1). Return a JSON object ONLY with 'status' (calm, sitting, sleeping, fallen), 'level' (1-10), and 'reasoning' (a short explanation of what you see). Do not use markdown blocks for the JSON.";

  const parts = [{ text: prompt }];

  if (base64Audio) {
    parts.push({
      inlineData: {
        mimeType: "audio/webm",
        data: base64Audio
      }
    });
  }

  if (base64Image) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "")
      }
    });
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;

    // Clean up standard markdown wrapping if Gemini returns it despite instructions
    let cleanJSON = rawText.trim();
    if (cleanJSON.startsWith("```json")) {
      cleanJSON = cleanJSON.substring(7, cleanJSON.length - 3).trim();
    } else if (cleanJSON.startsWith("```")) {
      cleanJSON = cleanJSON.substring(3, cleanJSON.length - 3).trim();
    }

    return JSON.parse(cleanJSON);
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return {
      status: "error",
      level: 0,
      reasoning: "API Error: " + error.message
    };
  }
}

/**
 * Analyzes the emotional sentiment of an elder's verbal response to an "Are you okay?" prompt.
 * Also factors in response latency as an indicator of cognitive state.
 */
export async function analyzeSpeechSentiment(transcript, pauseDurationMs) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const pauseSeconds = (pauseDurationMs / 1000).toFixed(1);
  const latencyNote = pauseDurationMs > 3000
    ? `The elder took ${pauseSeconds} seconds before responding, which indicates HIGH LATENCY and possible confusion or disorientation.`
    : `The elder responded after ${pauseSeconds} seconds (normal latency).`;

  const prompt = `You are a medical AI assistant analyzing an elderly person's verbal response to an emergency wellness check call ("Are you okay?").

Transcribed response: "${transcript}"

Response latency context: ${latencyNote}

Analyze the emotional state and cognitive clarity of this response. Return a JSON object ONLY with:
- "sentiment": one of ["Calm & Clear", "Confused", "Distressed", "No Response", "Possibly Declining"]
- "score": a wellness score from 1-10 (10 = perfectly calm and coherent, 1 = severe distress or no response)
- "latency_flag": true or false (true if response took more than 3 seconds)
- "summary": one sentence explaining your assessment for the caregiver
- "action": recommended caregiver action, e.g. "Monitor closely", "Dispatch help immediately", "Follow up in 30 minutes"

Do not use markdown blocks for the JSON.`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let rawText = data.candidates[0].content.parts[0].text.trim();
    if (rawText.startsWith("```json")) rawText = rawText.substring(7, rawText.length - 3).trim();
    else if (rawText.startsWith("```")) rawText = rawText.substring(3, rawText.length - 3).trim();

    return JSON.parse(rawText);
  } catch (error) {
    console.error("Sentiment analysis failed:", error);
    return {
      sentiment: "Error",
      score: 0,
      latency_flag: pauseDurationMs > 3000,
      summary: "Gemini sentiment analysis failed: " + error.message,
      action: "Manually check on elder"
    };
  }
}
