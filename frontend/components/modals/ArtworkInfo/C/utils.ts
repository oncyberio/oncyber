import { relativeTime } from "@utils/relativeTime";

export function timeLeft(date: Date) {
    if (Date.now() > date.getTime()) {
        return "Expired";
    }
    return relativeTime(date);
}

export function formatUser(user) {
    return {
        avatar: user?.profile_img_url,
        id: user?.address,
        username: user?.user?.username,
    };
}
