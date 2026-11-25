// Extracted from app/page.tsx — behavior unchanged.

export function addMinutesToSchedule(schedule: string, minutes: number) {
  const match = schedule.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i);
  if (!match) return minutes === 0 ? schedule : `${schedule} + ${minutes} min`;
  const meridiem = match[3].replaceAll(".", "").toLowerCase();
  const hour = Number(match[1]) % 12 + (meridiem === "pm" ? 12 : 0);
  const date = new Date(2000, 0, 1, hour, Number(match[2] || 0) + minutes);
  return date.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

export function clockToMinutes(value: string) {
  const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i);
  if (!match) return null;
  const meridiem = match[3].replaceAll(".", "").toLowerCase();
  return Number(match[1]) % 12 * 60 + (meridiem === "pm" ? 720 : 0) + Number(match[2] || 0);
}
