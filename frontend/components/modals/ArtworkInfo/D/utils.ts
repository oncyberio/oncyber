import moment from "moment";

export function timeLeft(date: Date) {
    if (Date.now() > date.getTime()) {
        return "Expired";
    }
    return moment(date).fromNow(true);
}

export function formatUser(user) {
    return {
        avatar: user?.profile_img_url || user?.user?.profile_img_url,
        id: user?.address,
        username: user?.user?.username,
    };
}

export function getPofileImg(profile, url = "") {
    //

    const target = profile?.id ? `/@${profile?.id}` : url;

    const src =
        profile?.avatar ||
        (profile as any)?.profile_img_url ||
        (profile as any)?.user?.profile_img_url ||
        "/images/opensea-black.png";

    return { target, src };
}
