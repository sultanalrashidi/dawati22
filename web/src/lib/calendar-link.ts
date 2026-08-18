/** Google Calendar "add event" link — no backend, no file generation needed. */
export function buildGoogleCalendarUrl(params: {
  title: string;
  start: Date;
  durationMinutes?: number;
  location?: string;
  details?: string;
}) {
  const { title, start, durationMinutes = 180, location, details } = params;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const toUtcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const search = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
  });
  if (location) search.set("location", location);
  if (details) search.set("details", details);

  return `https://calendar.google.com/calendar/render?${search.toString()}`;
}
