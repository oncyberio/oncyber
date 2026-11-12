/**
 * * TODO: New menu
 * TODO: Panel new responsiveness and artwork info

 * TODO: VR
 * TODO: Share should be using https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API
 *  * TODO: Share buttons mobile swipes
 */

export enum ShareType {
    Twitter,
    Facebook,
    Link,
    Embed,
    SHARE,
    BOOKMARK,
}

export function shareTwitter(link: string) {
    const params = new URLSearchParams(location?.search);

    params.set("text", link);

    window.open(`https://twitter.com/intent/tweet?${params}`, "_blank");
}

export function shareFacebook(link: string) {
    const params = new URLSearchParams(location?.search);

    params.set("u", link);

    window.open(
        `https://www.facebook.com/sharer/sharer.php?${params}`,
        "_blank"
    );
}

export async function ShareApi(shareData) {
    try {
        if (!navigator.share) return;
        await navigator.share(shareData);
    } catch (err) {
        console.log(err);
    }
}
