// HACKATHON OFFLINE MOCK - REALTIME DATABASE REPLACEMENT
// This perfectly simulates Firebase Realtime Database across browser tabs using LocalStorage.
// This guarantees your demo works even without a configured Google Cloud account!

export const db = {};

export function ref(db, path) {
  return path;
}

export function serverTimestamp() {
  return Date.now();
}

export async function set(path, data) {
  localStorage.setItem(path, JSON.stringify(data));
  window.dispatchEvent(new Event('local-firebase-update'));
}

export async function update(path, updates) {
  const current = JSON.parse(localStorage.getItem(path) || 'null') || {};
  const merged = { ...current, ...updates };
  localStorage.setItem(path, JSON.stringify(merged));
  window.dispatchEvent(new Event('local-firebase-update'));
}

export function onValue(path, callback) {
  const notify = () => {
     let val = null;
     try { val = JSON.parse(localStorage.getItem(path)); } catch(e) {}
     callback({ val: () => val });
  };
  
  notify(); // Initial payload
  
  const listener = () => notify();
  window.addEventListener('local-firebase-update', listener);
  
  const storageListener = (e) => {
     if (e.key === path) notify();
  };
  window.addEventListener('storage', storageListener);
  
  return () => {
      window.removeEventListener('local-firebase-update', listener);
      window.removeEventListener('storage', storageListener);
  };
}
