/**
 * MINI DIGITAL TWIN — Data Store
 * Uses LocalStorage as offline-first database.
 * Schema mirrors Firebase Realtime DB — swap import to go live.
 */

const KEYS = {
  EVENTS: 'twin/events',
  BASELINE: 'twin/baseline',
  ANOMALIES: 'twin/anomalies',
};

// ─── Helpers ────────────────────────────────────────────
function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
}
function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new Event('twin-update'));
}

// ─── EVENT LOGGING ───────────────────────────────────────
export function logFallEvent({ reason = '', severity = 8, location = 'unknown' }) {
  const events = load(KEYS.EVENTS) || [];
  const now = Date.now();
  const hour = new Date(now).getHours();

  const event = {
    id: now.toString(),
    timestamp: now,
    type: severity >= 8 ? 'fall' : 'near_fall',
    severity,
    location,
    reason,
    timeOfDay: hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening',
    acknowledged: false,
  };

  events.push(event);
  save(KEYS.EVENTS, events);
  updateBaseline(events);
  detectAnomalies(events);
  return event;
}

export function acknowledgeEvent(id) {
  const events = load(KEYS.EVENTS) || [];
  const updated = events.map(e => e.id === id ? { ...e, acknowledged: true } : e);
  save(KEYS.EVENTS, updated);
}

export function getAllEvents() {
  return (load(KEYS.EVENTS) || []).sort((a, b) => b.timestamp - a.timestamp);
}

export function getThisWeekEvents() {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return getAllEvents().filter(e => e.timestamp > weekAgo);
}

// ─── BASELINE TRACKING ───────────────────────────────────
function updateBaseline(events) {
  if (!events.length) return;

  const weekEvents = events.filter(e => e.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000);
  const hourCounts = Array(24).fill(0);
  weekEvents.forEach(e => {
    const h = new Date(e.timestamp).getHours();
    hourCounts[h]++;
  });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const fallCount = weekEvents.filter(e => e.type === 'fall').length;

  const baseline = {
    totalEvents: events.length,
    weeklyFallCount: fallCount,
    peakActivityHour: peakHour,
    avgSeverity: weekEvents.length
      ? (weekEvents.reduce((s, e) => s + e.severity, 0) / weekEvents.length).toFixed(1)
      : 0,
    mostCommonLocation: getMostCommon(weekEvents.map(e => e.location)),
    mostCommonTimeOfDay: getMostCommon(weekEvents.map(e => e.timeOfDay)),
    lastUpdated: Date.now(),
  };

  save(KEYS.BASELINE, baseline);
}

function getMostCommon(arr) {
  if (!arr.length) return 'unknown';
  const freq = {};
  arr.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}

export function getBaseline() {
  return load(KEYS.BASELINE);
}

// ─── ANOMALY DETECTION ───────────────────────────────────
function detectAnomalies(events) {
  const anomalies = load(KEYS.ANOMALIES) || [];
  const weekEvents = events.filter(e => e.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newAnomalies = [];

  // Rule 1: Multiple falls in 24 hours
  const last24h = events.filter(e => e.timestamp > Date.now() - 24 * 60 * 60 * 1000);
  if (last24h.filter(e => e.type === 'fall').length >= 2) {
    newAnomalies.push({
      id: `anomaly_${Date.now()}_freq`,
      timestamp: Date.now(),
      type: 'HIGH_FREQUENCY',
      description: 'Multiple falls detected within 24 hours — elevated risk.',
      severity: 9,
    });
  }

  // Rule 2: Night-time falls (high risk for isolation)
  const nightFalls = weekEvents.filter(e => e.type === 'fall' && e.timeOfDay === 'night');
  if (nightFalls.length >= 1) {
    newAnomalies.push({
      id: `anomaly_${Date.now()}_night`,
      timestamp: Date.now(),
      type: 'NIGHT_FALL',
      description: 'Night-time fall detected. Elder may need bed rails or night lighting.',
      severity: 8,
    });
  }

  // Rule 3: Increasing severity trend
  if (weekEvents.length >= 3) {
    const recent3 = [...weekEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);
    const isIncreasing = recent3[0].severity >= recent3[1].severity && recent3[1].severity >= recent3[2].severity;
    if (isIncreasing && recent3[0].severity > 7) {
      newAnomalies.push({
        id: `anomaly_${Date.now()}_trend`,
        timestamp: Date.now(),
        type: 'WORSENING_TREND',
        description: 'Severity of fall events is increasing. Immediate medical review recommended.',
        severity: 10,
      });
    }
  }

  // Merge, avoiding duplicates by type within last hour
  const recentTypes = anomalies
    .filter(a => a.timestamp > Date.now() - 60 * 60 * 1000)
    .map(a => a.type);

  const fresh = newAnomalies.filter(a => !recentTypes.includes(a.type));
  if (fresh.length) save(KEYS.ANOMALIES, [...anomalies, ...fresh]);
}

export function getAnomalies() {
  return (load(KEYS.ANOMALIES) || []).sort((a, b) => b.timestamp - a.timestamp);
}

// ─── SAMPLE TEST DATA (for demo) ─────────────────────────
export function seedDemoData() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const events = [
    { reason: 'Person lying flat on kitchen floor', severity: 9, location: 'kitchen', timestamp: now - 6 * day },
    { reason: 'Unsteady gait, caught self on counter', severity: 5, location: 'kitchen', timestamp: now - 5 * day },
    { reason: 'Fell near bathroom door', severity: 8, location: 'bathroom', timestamp: now - 4 * day },
    { reason: 'Slipped getting out of bed, high latency response', severity: 7, location: 'bedroom', timestamp: now - 3 * day },
    { reason: 'Hard fall detected, no verbal response', severity: 10, location: 'living room', timestamp: now - 2 * day - 3 * 60 * 60 * 1000 },
    { reason: 'Near-fall, grabbed chair for support', severity: 4, location: 'living room', timestamp: now - 1 * day },
    { reason: 'Fall at night, confused vocal response', severity: 9, location: 'bedroom', timestamp: now - 6 * 60 * 60 * 1000 },
  ];

  // Clear and reseed
  localStorage.removeItem('twin/events');
  localStorage.removeItem('twin/baseline');
  localStorage.removeItem('twin/anomalies');

  events.forEach(e => {
    const allEvents = load(KEYS.EVENTS) || [];
    const hour = new Date(e.timestamp).getHours();
    allEvents.push({
      id: e.timestamp.toString(),
      timestamp: e.timestamp,
      type: e.severity >= 8 ? 'fall' : 'near_fall',
      severity: e.severity,
      location: e.location,
      reason: e.reason,
      timeOfDay: hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening',
      acknowledged: false,
    });
    save(KEYS.EVENTS, allEvents);
  });

  updateBaseline(load(KEYS.EVENTS) || []);
  detectAnomalies(load(KEYS.EVENTS) || []);
  window.dispatchEvent(new Event('twin-update'));
}

// ─── REALTIME LISTENER (mirrors Firebase onValue API) ────
export function onTwinUpdate(callback) {
  callback(); // immediate
  window.addEventListener('twin-update', callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener('twin-update', callback);
    window.removeEventListener('storage', callback);
  };
}
