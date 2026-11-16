import type { Experience } from "@uitypes/experience";
import { SHARE_IMAGE_PATH } from "@components/layouts/headers";
import { siteUrl } from "@utils/siteUrl";
import { cloudinary } from "@utils/urlUtils";

/**
 * The image link previews show for a space: its hero image, else its room's,
 * else the site's share card. Images on the old Cloudinary accounts no longer
 * load anywhere, so they are skipped.
 */
export function spaceShareImage(
    experience: Experience,
    destination?: { image?: string } | null
): string {
    const candidates = [
        experience?.info?.heroImg,
        experience?.info?.cHeroImg,
        destination?.image,
    ];
    return (
        candidates.find(
            (url) =>
                typeof url === "string" &&
                url.length > 0 &&
                !cloudinary.isBrokenCloudinaryUrl(url)
        ) || siteUrl(SHARE_IMAGE_PATH)
    );
}
