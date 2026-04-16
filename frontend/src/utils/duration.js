export const DURATION_HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => (
  String(index).padStart(2, '0')
));

export const DURATION_MINUTE_OPTIONS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

// Array.from({ length: 60 }, (_, index) => (
//   String(index).padStart(2, '0')
// ));

export function formatMinutesAsHHMM(minutes) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function parseHHMMToMinutes(text) {
  if (text == null || String(text).trim() === '') return null;
  const match = String(text).trim().match(/^(\d+):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) {
    return null;
  }

  return Math.max(0, hours * 60 + minutes);
}

export function splitMinutesToDurationParts(minutes) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  return {
    hours: String(Math.floor(safeMinutes / 60)).padStart(2, '0'),
    minutes: String(safeMinutes % 60).padStart(2, '0'),
  };
}

export function sanitizeDurationPart(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 2);
}

export function parseDurationPartsToMinutes(hoursText, minutesText) {
  const hours = Number(sanitizeDurationPart(hoursText) || 0);
  const minutes = Number(sanitizeDurationPart(minutesText) || 0);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) {
    return null;
  }

  return Math.max(0, hours * 60 + minutes);
}
