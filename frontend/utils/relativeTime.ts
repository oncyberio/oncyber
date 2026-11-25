/**
 * How long until or since a moment, in words and without "in" or "ago":
 * "a few seconds", "3 hours", "a month". The same words, at the same
 * thresholds and with the same count of calendar months, as the date
 * library these panels used to load for this one call (176 KB of it): the
 * test beside this file checks them against it.
 */
const DAY = 86_400_000;
/** 400 years of days over 400 years of months. */
const DAYS_PER_MONTH = 146_097 / 4800;

/** `date` moved on by whole months, kept inside the month it lands in. */
function addMonths(date: Date, months: number) {
    const moved = new Date(date.getTime());
    const target = date.getMonth() + months;
    const lastDay = new Date(date.getFullYear(), target + 1, 0).getDate();
    moved.setMonth(target, Math.min(date.getDate(), lastDay));
    return moved;
}

export function relativeTime(date: Date | number | string, now = Date.now()) {
    const then = new Date(date);
    if (Number.isNaN(then.getTime())) return "Invalid date";
    // Whole calendar months from the earlier to the later, then the rest.
    const [from, to] =
        then.getTime() < now ? [then, new Date(now)] : [new Date(now), then];
    let wholeMonths =
        (to.getFullYear() - from.getFullYear()) * 12 +
        to.getMonth() -
        from.getMonth();
    if (addMonths(from, wholeMonths) > to) wholeMonths--;
    const rest = to.getTime() - addMonths(from, wholeMonths).getTime();

    const wholeDays = Math.round(wholeMonths * DAYS_PER_MONTH);
    const seconds = Math.round(wholeDays * 86_400 + rest / 1000);
    const minutes = Math.round(wholeDays * 1440 + rest / 60_000);
    const hours = Math.round(wholeDays * 24 + rest / 3_600_000);
    const days = Math.round(wholeDays + rest / DAY);
    const monthsExact = wholeMonths + rest / DAY / DAYS_PER_MONTH;
    const months = Math.round(monthsExact);
    const years = Math.round(monthsExact / 12);

    if (seconds <= 44) return "a few seconds";
    if (minutes <= 1) return "a minute";
    if (minutes < 45) return `${minutes} minutes`;
    if (hours <= 1) return "an hour";
    if (hours < 22) return `${hours} hours`;
    if (days <= 1) return "a day";
    if (days < 26) return `${days} days`;
    if (months <= 1) return "a month";
    if (months < 11) return `${months} months`;
    if (years <= 1) return "a year";
    return `${years} years`;
}
