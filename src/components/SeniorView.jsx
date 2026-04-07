import { useState, useEffect, useRef } from 'react';
import { db, ref, set, serverTimestamp } from '../firebase';
import { analyzeSensorDataWithGemini } from '../gemini';
import { makeEmergencyPhoneCall } from '../twilio';
import { logFallEvent } from '../twinStore';
import { Camera, ShieldCheck, ShieldAlert, Activity, PlaySquare, X } from 'lucide-react';

export default function SeniorView() {
  const [status, setStatus] = useState('Standby');
  const [alertReason, setAlertReason] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const playLoopRef = useRef(null);

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file && videoRef.current) {
       const url = URL.createObjectURL(file);
       videoRef.current.src = url;
       setStatus('Ready to monitor CCTV');
    }
  };

  const startAnalysisLoop = () => {
    if (!videoRef.current || !videoRef.current.src) {
        alert("Please upload a demo CCTV video first!");
        return;
    }
    
    if (playLoopRef.current) clearInterval(playLoopRef.current);
    videoRef.current.play();
    setStatus('Monitoring');
    
    // Check frames every 8 seconds to respect free tier rate limit
    playLoopRef.current = setInterval(() => {
        analyzeCurrentFrame();
    }, 8000);
  };

  const stopAnalysis = () => {
     if (playLoopRef.current) clearInterval(playLoopRef.current);
     if (videoRef.current) videoRef.current.pause();
     setStatus('Standby');
  };

  const analyzeCurrentFrame = async () => {
    let base64Image = null;
    if (videoRef.current && canvasRef.current && videoRef.current.videoWidth > 0) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        // Scale down to max 640 width to save massive API payload sizes
        const targetWidth = 640;
        const scale = targetWidth / video.videoWidth;
        canvas.width = targetWidth;
        canvas.height = video.videoHeight * scale;
        
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        base64Image = canvas.toDataURL('image/jpeg', 0.8);
    }

    if (!base64Image) return;

    try {
        console.log("Sending CCTV frame to Gemini...");
        const result = await analyzeSensorDataWithGemini(null, base64Image);
        console.log("CCTV Analysis:", result);
        
        if (result && result.level >= 8) {
            triggerFallAlert(result.reasoning);
        } else {
            console.log("Normal behavior detected.");
            if(status !== 'Distress') {
                setAlertReason(result.reasoning || "Routine activity detected");
            }
        }
    } catch(err) {
        console.error("Frame analysis error:", err);
    }
  };

  const triggerFallAlert = (reason) => {
     stopAnalysis();
     setStatus('Distress');
     setAlertReason(`ALERT! Fall Detected: ${reason}`);
     setShowAlert(true);

     // Log to Digital Twin store for weekly report tracking
     logFallEvent({ reason, severity: 9, location: 'monitored area' });

     // Write to Firebase - Escalation Logic Payload
     // Both caretake and family member must acknowledge
     const alertId = Date.now().toString();
     set(ref(db, 'guardian/active_alert'), {
        id: alertId,
        timestamp: serverTimestamp(),
        reason: reason,
        caretaker_answered: false,
        family_answered: false,
        caretaker_seen: false,
        family_seen: false,
        escalated_to_emergency: false,
        status: 'Triggered'
     });

     // DISPATCH ACTUAL TWILIO PHONE CALLS
     try {
         const settings = JSON.parse(localStorage.getItem('caregiver/settings') || '{}');
         const caretakerPhone = settings.caretaker ? settings.caretaker.phone : null;
         const familyPhone = settings.family ? settings.family.phone : null;
         
         // Always dispatch. If local storage is empty, the Twilio script will automatically use your hardcoded TO_NUMBER override.
         makeEmergencyPhoneCall(caretakerPhone, 'Caretaker');
         
         if (familyPhone) {
            makeEmergencyPhoneCall(familyPhone, 'Family');
         }
     } catch (e) {
         console.warn("Failed to trigger Twilio dispatcher", e);
     }
     
     // Trigger loud buzzer locally on the edge device
     const alarm = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
     alarm.play().catch(console.error);
  };

  useEffect(() => {
      return () => {
          if (playLoopRef.current) clearInterval(playLoopRef.current);
      };
  }, []);

  return (
    <>
    {!showPanel ? (
      <button
        onClick={() => setShowPanel(true)}
        style={{ position: 'fixed', bottom: '2rem', left: '2rem', background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '12px', padding: '0.6rem 1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', backdropFilter: 'blur(8px)' }}>
        <Camera size={16} /> Reopen CCTV Panel
      </button>
    ) : (
    <div className="glass-panel" style={{ textAlign: 'center', transition: 'all 0.5s', maxWidth: '800px', position: 'relative',
          border: status === 'Distress' ? '2px solid var(--danger-color)' : '1px solid rgba(255,255,255,0.1)' }}>
      
      {/* Panel X Close Button */}
      <button
        onClick={() => { stopAnalysis(); setStatus('Standby'); setAlertReason(null); setShowAlert(false); setShowPanel(false); }}
        title="Close Panel"
        style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.3)'}
        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
        <X size={16} />
      </button>

      <h1 className="card-title" style={{ fontSize: '2rem' }}>
        <Camera size={36} color="var(--success-color)" /> CCTV Edge Node Simulator
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Upload a demo video of a person sitting, sleeping, or falling.</p>

      {/* Hidden canvas for extracting image frames */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={{ position: 'relative', width: '100%', maxHeight: '400px', background: '#000', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
          <video 
            ref={videoRef} 
            controls
            loop
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
          />
      </div>

      {/* Distress Alert Modal Card */}
      {showAlert && status === 'Distress' && (
        <div style={{
          position: 'relative',
          background: 'rgba(239,68,68,0.15)',
          border: '2px solid var(--danger-color)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1rem',
          textAlign: 'left'
        }}>
          {/* X Close Button */}
          <button
            onClick={() => { setShowAlert(false); setStatus('Standby'); setAlertReason(null); }}
            style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            title="Dismiss Alert">
            <X size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ShieldAlert color="var(--danger-color)" size={20} />
            <span style={{ color: 'var(--danger-color)', fontWeight: 'bold', fontSize: '0.9rem' }}>FALL DETECTED</span>
          </div>
          <p style={{ color: '#fca5a5', fontSize: '0.9rem', fontFamily: 'monospace', margin: 0 }}>{alertReason}</p>
        </div>
      )}

      <div className="status-text" style={{ fontSize: '1.5rem', color: status === 'Distress' ? 'var(--danger-color)' : 'white' }}>
        System Status: {status}
      </div>
      
      {!showAlert && (
        <div className="status-subtext" style={{ color: 'var(--text-secondary)', minHeight: '3rem' }}>
          {alertReason || "Upload a video and start monitoring. Frames are analyzed automatically every 5 seconds."}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
        <input 
            type="file" 
            accept="video/*" 
            onChange={handleVideoUpload} 
            style={{ 
               padding: '0.75rem', 
               background: 'rgba(255,255,255,0.1)', 
               borderRadius: '8px',
               color: 'white'
            }} 
        />
        
        {status !== 'Monitoring' && status !== 'Distress' && (
          <button className="btn btn-success" onClick={startAnalysisLoop}>
             <PlaySquare size={20} /> Start CCTV AI 
          </button>
        )}
        
        {status === 'Monitoring' && (
          <button className="btn btn-danger" onClick={stopAnalysis}>
             Stop AI
          </button>
        )}
      </div>

      <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
         {status === 'Monitoring' && (
           <button 
             className="btn" 
             style={{ background: 'transparent', border: '1px dashed var(--danger-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }} 
             onClick={() => triggerFallAlert('Simulated Manual Demo Override')}>
              Test Escalation Layer (Bypass AI)
           </button>
         )}
      </div>
    </div>
    )}
    </>
  );
}
