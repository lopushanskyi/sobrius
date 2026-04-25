// Simple synchronous storage layer over localStorage.
// Keeps a similar shape to the artifact's window.storage API
// in case we later swap for IndexedDB or Capacitor Preferences.

const PREFIX = 'sobrius:';

export function getItem(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setItem(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage write failed:', e);
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
}
