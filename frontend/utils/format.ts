import { Duration } from "moment";

export function formatWalletAddress(id: string) {
    if (!id) return null;

    const end = id.length;

    return `${id.slice(0, 4)}..${id.slice(end - 4, end)}`;
}

export function formatTime(value: Duration) {
    let time = `${value.hours()}h ${value.minutes()}min ${value.seconds()}s`;
    const days = value.days();
    if (days > 0) {
        time = days + "d " + time;
    }
    const months = value.months();
    if (months > 0) {
        time = months + "m " + time;
    }
    const year = value.years();
    if (year > 0) {
        time = year + "yr " + time;
    }
    return time;
}
