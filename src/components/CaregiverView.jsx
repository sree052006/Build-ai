import { useState, useEffect } from 'react';
import { db, ref, onValue, update, set } from '../firebase';
import { ActivitySquare, AlertTriangle, CheckCircle, ShieldUser, Users, Phone, Mail, Edit2, Play, Save, Brain, Clock, X } from 'lucide-react';

export default function CaregiverView() {
  const [activeAlert, setActiveAlert] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [contacts, setContacts] = useState({
    caretaker: { phone: '', email: '' },
    family: { phone: '', email: '' }
  });

  useEffect(() => {
    // Load Settings
    const settingsRef = ref(db, 'caregiver/settings');
    const unsubscribeSettings = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setContacts(data);
    });

    // Load Alert State
    const alertRef = ref(db, 'guardian/active_alert');
    const unsubscribeAlert = onValue(alertRef, (snapshot) => {
      setActiveAlert(snapshot.val());
    });

    return () => {
      unsubscribeSettings();
      unsubscribeAlert();
    };
  }, []);

  // Built-in Escalation Tracker (Bypasses Node.js backend for absolute demo reliability)
  useEffect(() => {
    if (activeAlert && activeAlert.status !== 'Resolved' && !activeAlert.escalated_to_emergency) {
      // 5-minute production escalation (compressed to 30 seconds for hackathon demo)
      const escalationTimer = setTimeout(async () => {
         const bothAttended = activeAlert.caretaker_answered && activeAlert.family_answered;
         const bothSeen = activeAlert.caretaker_seen && activeAlert.family_seen;
         
         if (!(bothAttended && bothSeen)) {
            console.warn("ESCALATING TO EMERGENCY HELPLINE DISPATCH...");
            await update(ref(db, 'guardian/active_alert'), { escalated_to_emergency: true });
         }
      }, 30000);
      
      return () => clearTimeout(escalationTimer);
    }
  }, [activeAlert]);

  const handleSaveContacts = async () => {
    await set(ref(db, 'caregiver/settings'), contacts);
    setEditMode(false);
    alert("Emergency Contacts saved successfully!");
  };

  const handleDismissAlert = async () => {
    if (window.confirm('Dismiss and clear this emergency alert?')) {
      await set(ref(db, 'guardian/active_alert'), null);
    }
  };

  const handleAttendCall = async (role) => {
    if (!activeAlert) return;
    const updates = {};
    if (role === 'caretaker') updates['caretaker_answered'] = true;
    if (role === 'family') updates['family_answered'] = true;
    await update(ref(db, 'guardian/active_alert'), updates);
  };

  const handleAcknowledge = async (role) => {
    if (!activeAlert) return;
    const updates = {};
    if (role === 'caretaker') updates['caretaker_seen'] = true;
    if (role === 'family') updates['family_seen'] = true;
    
    const willCaretakerBeTrue = role === 'caretaker' ? true : activeAlert.caretaker_seen;
    const willFamilyBeTrue = role === 'family' ? true : activeAlert.family_seen;
    
    if (willCaretakerBeTrue && willFamilyBeTrue) {
       updates['status'] = 'Resolved';
    } else {
       updates['status'] = 'Acknowledged by ' + role;
    }
    await update(ref(db, 'guardian/active_alert'), updates);
  };

  return (
    <>
    {!showPanel ? (
      <button
        onClick={() => setShowPanel(true)}
        style={{ position: 'fixed', bottom: '2rem', left: '2rem', background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '12px', padding: '0.6rem 1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', backdropFilter: 'blur(8px)' }}>
        <ActivitySquare size={16} /> Reopen Dispatch Panel
      </button>
    ) : (
    <div className="glass-panel" style={{ maxWidth: '800px', width: '100%', margin: '0 auto', textAlign: 'left', position: 'relative' }}>

      {/* Panel X Close Button */}
      <button
        onClick={() => setShowPanel(false)}
        title="Close Panel"
        style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.3)'}
        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
        <X size={16} />
      </button>

      <h1 className="card-title" style={{ justifyContent: 'flex-start' }}>
        <ActivitySquare size={28} /> Response & Dispatch Team
      </h1>

      {/* EMERGENCY CONTACT SETTINGS */}
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', marginTop: '1rem' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)' }}>Emergency Contacts Database</h3>
            {editMode ? (
               <button className="btn btn-success" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={handleSaveContacts}>
                  <Save size={16} /> Save Contacts
               </button>
            ) : (
               <button className="btn" style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => setEditMode(true)}>
                  <Edit2 size={16} /> Edit
               </button>
            )}
         </div>

         <div style={{ display: 'flex', gap: '1rem' }}>
            {/* Caretaker Form */}
            <div style={{ flex: 1 }}>
               <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '5px' }}><ShieldUser size={16} /> Caretaker</h4>
               <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', color: 'gray' }} />
                    <input type="tel" disabled={!editMode} className="input-field" style={{ paddingLeft: '32px', padding: '0.5rem 0.5rem 0.5rem 32px', fontSize: '0.9rem' }} placeholder="Phone Number" 
                           value={contacts.caretaker.phone} onChange={e => setContacts({...contacts, caretaker: {...contacts.caretaker, phone: e.target.value}})} />
                  </div>
               </div>
               <div className="input-group">
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', color: 'gray' }} />
                    <input type="email" disabled={!editMode} className="input-field" style={{ paddingLeft: '32px', padding: '0.5rem 0.5rem 0.5rem 32px', fontSize: '0.9rem' }} placeholder="Email (Gmail)" 
                           value={contacts.caretaker.email} onChange={e => setContacts({...contacts, caretaker: {...contacts.caretaker, email: e.target.value}})} />
                  </div>
               </div>
            </div>

            {/* Family Form */}
            <div style={{ flex: 1 }}>
               <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Users size={16} /> Family Member</h4>
               <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', color: 'gray' }} />
                    <input type="tel" disabled={!editMode} className="input-field" style={{ paddingLeft: '32px', padding: '0.5rem 0.5rem 0.5rem 32px', fontSize: '0.9rem' }} placeholder="Phone Number" 
                           value={contacts.family.phone} onChange={e => setContacts({...contacts, family: {...contacts.family, phone: e.target.value}})} />
                  </div>
               </div>
               <div className="input-group">
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', color: 'gray' }} />
                    <input type="email" disabled={!editMode} className="input-field" style={{ paddingLeft: '32px', padding: '0.5rem 0.5rem 0.5rem 32px', fontSize: '0.9rem' }} placeholder="Email (Gmail)" 
                           value={contacts.family.email} onChange={e => setContacts({...contacts, family: {...contacts.family, email: e.target.value}})} />
                  </div>
               </div>
            </div>
         </div>
      </div>
      
      {/* ALERT SECTION */}
      {!activeAlert || activeAlert.status === 'Resolved' ? (
        <div style={{ padding: '3rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success-color)', borderRadius: '16px', marginTop: '2rem', textAlign: 'center' }}>
             <CheckCircle color="var(--success-color)" size={48} style={{ margin: '0 auto', display: 'block', marginBottom: '1rem' }} />
             <h2 style={{ color: 'var(--success-color)', fontSize: '1.5rem', textAlign: 'center' }}>All Systems Clear</h2>
             <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.5rem' }}>No active falls or distress detected right now.</p>
        </div>
      ) : (
        <div style={{ 
            position: 'relative',
            background: 'rgba(239, 68, 68, 0.2)', 
            border: '2px solid var(--danger-color)',
            padding: '2rem', 
            borderRadius: '16px', 
            marginTop: '2rem',
            animation: 'pulse-red 2s infinite'
        }}>
          {/* X Dismiss Button */}
          <button
            onClick={handleDismissAlert}
            title="Dismiss Alert"
            style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
            <X size={16} />
          </button>
          <h2 style={{ fontSize: '1.5rem', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '1rem' }}>
            <AlertTriangle color="var(--danger-color)" size={32} /> EMERGENCY FALL ALERT
          </h2>
          
          <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--danger-color)', fontSize: '1.1rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                {activeAlert.reason}
            </p>
            <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '10px' }}>
                Time: {new Date(activeAlert.timestamp).toLocaleTimeString()}
            </small>
            
            {activeAlert.escalated_to_emergency && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#991b1b', color: 'white', fontWeight: 'bold', borderRadius: '4px', textAlign: 'center' }}>
                     🚨 5 MIN TIMEOUT REACHED 🚨<br/>
                     FALL ESCALATED TO EMERGENCY HELPLINE DISPATCH
                </div>
            )}
          </div>

          <p style={{ color: 'var(--text-primary)', marginBottom: '1rem', textAlign: 'center' }}>Dispatch Status: Waiting for remote users to answer and acknowledge via their mobile devices.</p>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
             
             {/* Caretaker Panel */}
             <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
                 <ShieldUser size={32} style={{ margin: '0 auto', marginBottom: '0.5rem', color: activeAlert.caretaker_seen ? 'var(--success-color)' : 'white' }} />
                 <h3 style={{ marginBottom: '1rem' }}>Caretaker's Phone</h3>
                 
                 {!activeAlert.caretaker_answered ? (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                         <span style={{ color: 'var(--danger-color)', fontSize: '0.85rem', fontWeight: 'bold', animation: 'pulse-red 1s infinite' }}>📱 RINGING...</span>
                         <span style={{ color: 'gray', fontSize: '0.8rem' }}>Waiting for answer...</span>
                     </div>
                 ) : activeAlert.caretaker_seen ? (
                     <div style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>✓ SEEN & VERIFIED</div>
                 ) : (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                         <span style={{ color: 'orange', fontSize: '0.85rem', fontWeight: 'bold' }}>CALL ANSWERED</span>
                         <span style={{ color: 'gray', fontSize: '0.8rem' }}>Waiting for user to click 'SEEN' on phone...</span>
                     </div>
                 )}
             </div>

             {/* Family Panel */}
             <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
                 <Users size={32} style={{ margin: '0 auto', marginBottom: '0.5rem', color: activeAlert.family_seen ? 'var(--success-color)' : 'white' }} />
                 <h3 style={{ marginBottom: '1rem' }}>Family Member's Phone</h3>
                 
                 {!activeAlert.family_answered ? (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                         <span style={{ color: 'var(--danger-color)', fontSize: '0.85rem', fontWeight: 'bold', animation: 'pulse-red 1s infinite' }}>📱 RINGING...</span>
                         <span style={{ color: 'gray', fontSize: '0.8rem' }}>Waiting for answer...</span>
                     </div>
                 ) : activeAlert.family_seen ? (
                     <div style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>✓ SEEN & VERIFIED</div>
                 ) : (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                         <span style={{ color: 'orange', fontSize: '0.85rem', fontWeight: 'bold' }}>CALL ANSWERED</span>
                         <span style={{ color: 'gray', fontSize: '0.8rem' }}>Waiting for user to click 'SEEN' on phone...</span>
                     </div>
                 )}
             </div>

          </div>

          {/* EMOTIONAL HEALTH PANEL */}
          {activeAlert.emotional_health && (
            <div style={{ marginTop: '1.5rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid #6366f1', borderRadius: '12px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Brain size={22} color="#818cf8" />
                <h3 style={{ margin: 0, color: '#818cf8' }}>Vocal Sentiment Analysis</h3>
              </div>

              {(() => {
                const eh = activeAlert.emotional_health;
                const colors = { 'Calm & Clear': '#10b981', 'Confused': '#f59e0b', 'Distressed': '#ef4444', 'No Response': '#6b7280', 'Possibly Declining': '#f97316', 'Error': '#6b7280' };
                const color = colors[eh.sentiment] || '#fff';
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ background: color + '22', border: `1px solid ${color}`, borderRadius: '8px', padding: '0.5rem 1rem' }}>
                        <span style={{ color, fontWeight: 'bold', fontSize: '1rem' }}>{eh.sentiment}</span>
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Wellness Score: <b style={{ color: 'white' }}>{eh.score}/10</b></div>
                      {eh.latency_flag && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fb923c', fontSize: '0.8rem', background: '#451a03', padding: '4px 8px', borderRadius: '6px' }}>
                          <Clock size={12} /> HIGH LATENCY DETECTED
                        </div>
                      )}
                    </div>
                    <p style={{ color: '#d1d5db', fontSize: '0.9rem', margin: 0 }}>{eh.summary}</p>
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '0.85rem' }}>→ Recommended Action:</span>
                      <span style={{ color: 'white', fontSize: '0.85rem' }}>{eh.action}</span>
                    </div>
                    {eh.transcript && (
                      <p style={{ color: '#6b7280', fontSize: '0.8rem', fontStyle: 'italic', margin: 0 }}>Elder's words: "{eh.transcript}"</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      )}
    </div>
    )}
    </>
  );
}
