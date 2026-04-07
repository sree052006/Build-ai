import { useState, useEffect, useCallback } from 'react';
import { Brain, AlertTriangle, Activity, TrendingUp, TrendingDown, Minus, FileText, DatabaseZap, RefreshCw, CheckCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { getAllEvents, getThisWeekEvents, getBaseline, getAnomalies, acknowledgeEvent, onTwinUpdate, seedDemoData } from '../twinStore';
import { generateWeeklyReport } from '../gemini';

const SEVERITY_COLOR = (s) => s >= 9 ? '#ef4444' : s >= 7 ? '#f97316' : s >= 5 ? '#f59e0b' : '#10b981';
const SEVERITY_LABEL = (s) => s >= 9 ? 'Critical' : s >= 7 ? 'High' : s >= 5 ? 'Medium' : 'Low';
const TYPE_BADGE = (t) => t === 'fall' ? { label: 'FALL', color: '#ef4444' } : { label: 'NEAR-FALL', color: '#f97316' };

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function markdownToJSX(text) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) return <h3 key={i} style={{ color: '#818cf8', margin: '1rem 0 0.3rem', fontSize: '1rem' }}>{line.slice(3)}</h3>;
    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} style={{ fontWeight: 'bold', color: 'white' }}>{line.slice(2, -2)}</p>;
    if (line.startsWith('- ')) return <p key={i} style={{ color: '#d1d5db', paddingLeft: '1rem', fontSize: '0.9rem' }}>• {line.slice(2)}</p>;
    if (line.startsWith('*') && line.endsWith('*')) return <p key={i} style={{ color: '#6b7280', fontSize: '0.8rem', fontStyle: 'italic' }}>{line.slice(1, -1)}</p>;
    return line ? <p key={i} style={{ color: '#d1d5db', fontSize: '0.9rem', marginBottom: '0.2rem' }}>{line}</p> : <br key={i} />;
  });
}

export default function DigitalTwinView() {
  const [events, setEvents] = useState([]);
  const [baseline, setBaseline] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [report, setReport] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [expandedEventId, setExpandedEventId] = useState(null);

  const refresh = useCallback(() => {
    setEvents(getAllEvents());
    setBaseline(getBaseline());
    setAnomalies(getAnomalies());
  }, []);

  useEffect(() => {
    const unsubscribe = onTwinUpdate(refresh);
    return unsubscribe;
  }, [refresh]);

  const handleGenerateReport = async () => {
    setReportLoading(true);
    const weekEvents = getThisWeekEvents();
    const result = await generateWeeklyReport({ events: weekEvents, baseline, anomalies });
    setReport(result);
    setReportLoading(false);
  };

  const handleAcknowledge = (id) => {
    acknowledgeEvent(id);
    refresh();
  };

  const weekEvents = events.filter(e => e.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fallCount = weekEvents.filter(e => e.type === 'fall').length;
  const nearFallCount = weekEvents.filter(e => e.type === 'near_fall').length;
  const criticalAnomaly = anomalies.some(a => a.severity >= 9);

  return (
    <>
    {!showPanel ? (
      <button onClick={() => setShowPanel(true)}
        style={{ position: 'fixed', bottom: '2rem', left: '2rem', background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '12px', padding: '0.6rem 1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', backdropFilter: 'blur(8px)' }}>
        <DatabaseZap size={16} /> Reopen Twin Dashboard
      </button>
    ) : (
    <div className="glass-panel" style={{ maxWidth: '900px', width: '100%', margin: '0 auto', textAlign: 'left', position: 'relative' }}>

      {/* X Button */}
      <button onClick={() => setShowPanel(false)} title="Close"
        style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.3)'}
        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
        <X size={16} />
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <DatabaseZap size={28} color="#818cf8" />
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Mini Digital Twin</h1>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Movement pattern tracking + AI weekly caregiver report</p>
        </div>
        <button onClick={seedDemoData}
          style={{ marginLeft: 'auto', background: 'rgba(99,102,241,0.15)', border: '1px solid #6366f1', color: '#818cf8', borderRadius: '8px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: '2.5rem' }}>
          <RefreshCw size={13} /> Load Demo Week
        </button>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Falls This Week', value: fallCount, color: '#ef4444', icon: <AlertTriangle size={18} /> },
          { label: 'Near-Falls', value: nearFallCount, color: '#f97316', icon: <Activity size={18} /> },
          { label: 'Anomalies', value: anomalies.length, color: criticalAnomaly ? '#ef4444' : '#f59e0b', icon: <Brain size={18} /> },
          { label: 'Avg Severity', value: baseline?.avgSeverity ? `${baseline.avgSeverity}/10` : 'N/A', color: '#818cf8', icon: <TrendingUp size={18} /> },
        ].map(card => (
          <div key={card.label} style={{ background: card.color + '18', border: `1px solid ${card.color}55`, borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
            <div style={{ color: card.color, display: 'flex', justifyContent: 'center', marginBottom: '0.4rem' }}>{card.icon}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── BASELINE ── */}
      {baseline && (
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid #4f46e555', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#818cf8', fontSize: '0.9rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Activity size={14} /> Movement Baseline</h3>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#d1d5db' }}>
            <span>📍 Most incidents: <b style={{ color: 'white' }}>{baseline.mostCommonLocation}</b></span>
            <span>🕐 Peak time: <b style={{ color: 'white' }}>{baseline.mostCommonTimeOfDay}</b></span>
            <span>📊 Total logged: <b style={{ color: 'white' }}>{baseline.totalEvents}</b></span>
          </div>
        </div>
      )}

      {/* ── ANOMALIES ── */}
      {anomalies.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#f97316', fontSize: '0.9rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><AlertTriangle size={14} /> Detected Pattern Anomalies</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {anomalies.slice(0, 3).map(a => (
              <div key={a.id} style={{ background: '#451a0322', border: '1px solid #f9741655', borderRadius: '8px', padding: '0.7rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ color: '#fb923c', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap', marginTop: '2px' }}>{a.type.replace(/_/g, ' ')}</span>
                <span style={{ color: '#d1d5db', fontSize: '0.85rem' }}>{a.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FALL EVENT LOG ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FileText size={14} /> Historical Fall Log ({events.length} events)</h3>

        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', border: '1px dashed #374151', borderRadius: '8px' }}>
            No events recorded yet. Click <b style={{ color: '#818cf8' }}>"Load Demo Week"</b> to populate test data, or trigger a fall on the CCTV page.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {events.map(event => {
              const badge = TYPE_BADGE(event.type);
              const isExpanded = expandedEventId === event.id;
              return (
                <div key={event.id}
                  style={{ background: event.acknowledged ? 'rgba(16,185,129,0.06)' : 'rgba(0,0,0,0.3)', border: `1px solid ${event.acknowledged ? '#10b98144' : SEVERITY_COLOR(event.severity) + '44'}`, borderRadius: '8px', overflow: 'hidden' }}>
                  <div
                    onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                    style={{ padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <span style={{ background: badge.color + '22', color: badge.color, fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>{badge.label}</span>
                    <span style={{ flex: 1, color: '#d1d5db', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.reason}</span>
                    <span style={{ color: SEVERITY_COLOR(event.severity), fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{SEVERITY_LABEL(event.severity)}</span>
                    <span style={{ color: '#6b7280', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{formatTime(event.timestamp)}</span>
                    {event.acknowledged ? <CheckCircle size={14} color="#10b981" /> : isExpanded ? <ChevronUp size={14} color="#6b7280" /> : <ChevronDown size={14} color="#6b7280" />}
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '0 1rem 0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }}>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                        <span>📍 Location: <b style={{ color: 'white' }}>{event.location}</b></span>
                        <span>🕐 Time of day: <b style={{ color: 'white' }}>{event.timeOfDay}</b></span>
                        <span>⚠️ Severity: <b style={{ color: SEVERITY_COLOR(event.severity) }}>{event.severity}/10</b></span>
                      </div>
                      {!event.acknowledged && (
                        <button onClick={() => handleAcknowledge(event.id)}
                          style={{ background: '#10b98122', border: '1px solid #10b981', color: '#10b981', borderRadius: '6px', padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                          ✓ Acknowledge
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── WEEKLY REPORT ── */}
      <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid #6366f133', borderRadius: '12px', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ color: '#818cf8', fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Brain size={16} /> AI Weekly Caregiver Report</h3>
          <button onClick={handleGenerateReport} disabled={reportLoading}
            style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', cursor: reportLoading ? 'default' : 'pointer', fontSize: '0.85rem', opacity: reportLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {reportLoading ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : <><FileText size={14} /> Generate Report</>}
          </button>
        </div>

        {report ? (
          <div style={{ lineHeight: 1.7 }}>{markdownToJSX(report)}</div>
        ) : (
          <p style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
            Click "Generate Report" to get an AI-powered summary of this week's incidents, patterns, and recommendations.
          </p>
        )}
      </div>

    </div>
    )}
    </>
  );
}
