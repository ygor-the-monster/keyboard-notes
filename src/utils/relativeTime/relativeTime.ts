// Locale-aware "2 days ago" / "just now" for the Library card meta line. Uses Intl.RelativeTimeFormat
// so it speaks every locale we ship with no extra strings. `now` is a parameter (not Date.now inside)
// so it's deterministically unit-testable.
const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

export function formatRelativeTime(then: number, now: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let delta = (then - now) / 1000; // seconds, negative for the past
  for (const { amount, unit } of DIVISIONS) {
    if (Math.abs(delta) < amount) return rtf.format(Math.round(delta), unit);
    delta /= amount;
  }
  return rtf.format(Math.round(delta), "year");
}
