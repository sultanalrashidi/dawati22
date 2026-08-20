/** Gregorian + Hijri (Umm al-Qura) date strings — no dependency, Intl handles both calendars natively. */
export function formatDualDate(date: Date) {
  const gregorian = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
  const hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" }).format(date);
  return { gregorian, hijri, time };
}
