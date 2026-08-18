/** Gregorian + Hijri (Umm al-Qura) date strings — no dependency, Intl handles both calendars natively. */
export function formatDualDate(date: Date) {
  const gregorian = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit" }).format(date);
  return { gregorian, hijri, time };
}
