import { useState, useEffect, useRef } from 'react';
import { db, ref, onValue, update } from '../firebase';
import { PhoneIncoming, CheckCircle, AlertTriangle, Phone, Mic, Brain, Clock } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { analyzeSpeechSentiment } from '../gemini';

export default function MobileView() {
  const { role } = useParams();
  const [activeAlert, setActiveAlert] = useState(null);
  const [vocalStage, setVocalStage] = useState('idle'); // idle | listening | analyzing | done
  const [listenCountdown, setListenCountdown] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [pauseDuration, setPauseDuration] = useState(0);
  const [sentimentResult, setSentimentResult] = useState(null);
  const listenStartRef = useRef(null);
  const firstWordTimeRef = useRef(null);

  useEffect(() => {
    const alertRef = ref(db, 'guardian/active_alert');
    const unsubscribeAlert = onValue(alertRef, (snapshot) => {
      setActiveAlert(snapshot.val());
    });
    return () => unsubscribeAlert();
  }, []);

  const startVocalSentiment = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API not supported in this browser.");
      return;
    }

    // Step 1: Speak the "Are you okay?" prompt
    const synth = window.speechSynthesis;
    const question = new SpeechSynthesisUtterance("Are you okay? Please describe how you are feeling right now.");
    question.lang = 'en-US';
    question.rate = 0.85;
    question.pitch = 1.1;

    question.onend = () => {
      // Step 2: Start listening after AI finishes speaking
      setVocalStage('listening');
      listenStartRef.current = Date.now();
      firstWordTimeRef.current = null;

      // Visual countdown (10 seconds listening window)
      let count = 10;
      setListenCountdown(count);
      const countInterval = setInterval(() => {
        count--;
        setListenCountdown(count);
        if (count <= 0) clearInterval(countInterval);
      }, 1000);

      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        // Log time of first word (to measure pause latency)
        if (!firstWordTimeRef.current) {
          firstWordTimeRef.current = Date.now();
        }
        const text = Array.from(event.results)
          .map(r => r[0].transcript)
          .join(' ');
        setTranscript(text);
      };

      recognition.onend = async () => {
        clearInterval(countInterval);
        setListenCountdown(null);
        const finalTranscript = transcript || '[No audible response]';
        const pause = firstWordTimeRef.current
          ? firstWordTimeRef.current - listenStartRef.current
          : 9999; // No speech detected = max latency

        setPauseDuration(pause);
        setVocalStage('analyzing');

        // Step 3: Send to Gemini for sentiment analysis
        const result = await analyzeSpeechSentiment(finalTranscript, pause);
        setSentimentResult(result);
        setVocalStage('done');

        // Step 4: Save emotional health result to Firebase for the dashboard
        await update(ref(db, 'guardian/active_alert'), {
          emotional_health: {
            transcript: finalTranscript,
            sentiment: result.sentiment,
            score: result.score,
            latency_flag: result.latency_flag,
            summary: result.summary,
            action: result.action,
            analyzed_at: Date.now()
          }
        });
      };

      recognition.onerror = (e) => {
        console.error("Speech recognition error:", e.error);
        setVocalStage('idle');
      };

      recognition.start();
    };

    synth.speak(question);
  };

  const handleAttendCall = async () => {
    if (!activeAlert) return;
    const updates = {};
    if (role === 'caretaker') updates['caretaker_answered'] = true;
    if (role === 'family') updates['family_answered'] = true;
    await update(ref(db, 'guardian/active_alert'), updates);

    // Auto-start vocal sentiment check after answering
    setTimeout(() => startVocalSentiment(), 500);
  };

  const handleAcknowledge = async () => {
    if (!activeAlert) return;
    const updates = {};
    if (role === 'caretaker') updates['caretaker_seen'] = true;
    if (role === 'family') updates['family_seen'] = true;
    const willCaretakerBeTrue = role === 'caretaker' ? true : activeAlert.caretaker_seen;
    const willFamilyBeTrue = role === 'family' ? true : activeAlert.family_seen;
    if (willCaretakerBeTrue && willFamilyBeTrue) updates['status'] = 'Resolved';
    await update(ref(db, 'guardian/active_alert'), updates);
  };

  const displayRole = role === 'caretaker' ? 'Caretaker' : 'Family Member';
  const isAnswered = activeAlert ? (role === 'caretaker' ? activeAlert.caretaker_answered : activeAlert.family_answered) : false;
  const isSeen = activeAlert ? (role === 'caretaker' ? activeAlert.caretaker_seen : activeAlert.family_seen) : false;

  const sentimentColor = (s) => ({ 'Calm & Clear': '#10b981', 'Confused': '#f59e0b', 'Distressed': '#ef4444', 'No Response': '#6b7280', 'Possibly Declining': '#f97316', 'Error': '#6b7280' }[s] || '#fff');

  return (
    <div style={{ background: '#000', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>

      {!activeAlert || activeAlert.status === 'Resolved' ? (
        <div>
          <CheckCircle color="#10b981" size={64} style={{ margin: '0 auto', marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.5rem', color: '#9ca3af' }}>{displayRole} App</h2>
          <p>No active emergencies. Standing by.</p>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Incoming Call Screen */}
          {!isAnswered && (
            <div style={{ background: '#991b1b', padding: '2rem', borderRadius: '24px' }}>
              <PhoneIncoming color="white" size={64} style={{ margin: '0 auto', marginBottom: '1rem' }} />
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>INCOMING CALL...</h2>
              <p style={{ marginBottom: '2rem' }}>Guardian AI Emergency Alert System</p>
              <button onClick={handleAttendCall}
                style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '50px', width: '80px', height: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto', cursor: 'pointer', boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)' }}>
                <Phone size={32} />
              </button>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Tap to Answer</p>
            </div>
          )}

          {/* Vocal Sentiment Layer — shows after call is answered */}
          {isAnswered && !isSeen && (
            <div style={{ border: '2px solid #374151', borderRadius: '16px', overflow: 'hidden' }}>

              {/* Vocal Analysis Panel */}
              <div style={{ background: '#111827', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'center' }}>
                  <Brain size={20} color="#818cf8" />
                  <span style={{ color: '#818cf8', fontWeight: 'bold', fontSize: '0.9rem' }}>VOCAL SENTIMENT ENGINE</span>
                </div>

                {vocalStage === 'idle' && (
                  <div>
                    <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '1rem' }}>AI will ask "Are you okay?" and analyze the response for emotional distress.</p>
                    <button onClick={startVocalSentiment} style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', padding: '0.6rem 1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto' }}>
                      <Mic size={16} /> Start Wellness Check
                    </button>
                  </div>
                )}

                {vocalStage === 'listening' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '0.5rem' }}>
                      <Mic size={20} style={{ animation: 'pulse 1s infinite' }} />
                      <span style={{ fontWeight: 'bold' }}>LISTENING...</span>
                    </div>
                    {listenCountdown !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: '#6b7280', fontSize: '0.8rem' }}>
                        <Clock size={14} /> {listenCountdown}s remaining
                      </div>
                    )}
                    {transcript && <p style={{ marginTop: '0.8rem', color: '#d1d5db', fontStyle: 'italic', fontSize: '0.9rem' }}>"{transcript}"</p>}
                  </div>
                )}

                {vocalStage === 'analyzing' && (
                  <div style={{ color: '#f59e0b' }}>
                    <Brain size={24} style={{ margin: '0 auto', marginBottom: '0.5rem' }} />
                    <p style={{ fontSize: '0.85rem' }}>Gemini AI analyzing emotional state...</p>
                  </div>
                )}

                {vocalStage === 'done' && sentimentResult && (
                  <div>
                    <div style={{ background: sentimentColor(sentimentResult.sentiment) + '22', border: `1px solid ${sentimentColor(sentimentResult.sentiment)}`, borderRadius: '8px', padding: '0.8rem', marginBottom: '0.8rem' }}>
                      <div style={{ color: sentimentColor(sentimentResult.sentiment), fontWeight: 'bold', fontSize: '1rem' }}>{sentimentResult.sentiment}</div>
                      <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Wellness Score: {sentimentResult.score}/10</div>
                    </div>
                    {sentimentResult.latency_flag && (
                      <div style={{ background: '#451a03', border: '1px solid #f97316', borderRadius: '6px', padding: '0.5rem', marginBottom: '0.8rem', fontSize: '0.8rem', color: '#fb923c' }}>
                        ⚠️ HIGH LATENCY: Responded after {(pauseDuration / 1000).toFixed(1)}s — possible confusion
                      </div>
                    )}
                    <p style={{ color: '#d1d5db', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{sentimentResult.summary}</p>
                    <p style={{ color: '#60a5fa', fontSize: '0.8rem', fontWeight: 'bold' }}>→ {sentimentResult.action}</p>
                    {transcript && <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.5rem', fontStyle: 'italic' }}>"{transcript}"</p>}
                  </div>
                )}
              </div>

              {/* Alert Info + MARK AS SEEN */}
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1.5rem', borderTop: '1px solid #374151' }}>
                <AlertTriangle color="#ef4444" size={32} style={{ margin: '0 auto', marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.9rem', marginBottom: '1rem', fontFamily: 'monospace', color: '#fca5a5' }}>{activeAlert.reason}</p>
                <button onClick={handleAcknowledge}
                  style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '12px', padding: '0.9rem 2rem', fontSize: '1.1rem', fontWeight: 'bold', width: '100%', cursor: 'pointer' }}>
                  MARK AS SEEN
                </button>
              </div>
            </div>
          )}

          {/* Acknowledged state */}
          {isSeen && (
            <div style={{ padding: '2rem' }}>
              <CheckCircle color="#10b981" size={64} style={{ margin: '0 auto', marginBottom: '1rem' }} />
              <h2 style={{ fontSize: '1.5rem', color: '#10b981' }}>Alert Acknowledged</h2>
              <p style={{ color: 'gray' }}>Waiting for all parties to verify before alarm clears.</p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
