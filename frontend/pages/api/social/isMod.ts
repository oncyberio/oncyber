import { Experience } from "@uitypes/experience";
import { auth } from "@utils/middlewares/authMiddleware";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import { getExhibitByCustomLink } from "../exhibit";
import { isAdminCurator } from "../overwriteAsset";

export const ADMINS = [
    "0xf02cb30a8963e6fe8cc7650a6169e603357650ad",
    "0xfd22004806a6846ea67ad883356be810f0428793",
    "0x76db02500f7631d57bc2dcdca9d4cf782b99e119",
    "0xd40b63bf04a44e43fbfe5784bcf22acaab34a180",
    "0x04173063c0c491470b735954790f94ed307aae9d",
    "0x911765e6cbf6f1dfc7c1bacc01be7e32612aa541",
    "0x6ce28936ee5f6c2dcf33b731df675bdbd60b5593",
    "0x07387f22320e879959bbfc38400e69bbdd638c19",
    "0x9c360296bd72c940080f168e5cb0b4ce5f7e8036",
    "0xdbeb624f6a8c6ff6e66182da3de04d525ddbad6f",
    "0x814739d616e3efda89ab5e52884035541da25025",
];

export async function isMod(userId: string, spaceId: string): Promise<boolean> {
    //

    if (ADMINS.includes(userId?.toLowerCase?.())) {
        return true;
    }

    const exhibit = await getExhibitByCustomLink(spaceId);

    if (exhibit == null) {
        throw new Error("Exhibit not found " + spaceId);
    }

    userId = userId?.toLowerCase?.();

    if (exhibit.owner?.toLowerCase?.() === userId) {
        return true;
    }

    if (!(exhibit.editors || []).find((it) => it.toLowerCase() === userId)) {
        return false;
    }

    return true;
    // return isAdminCurator(userId, spaceId);
}

export default async (req, res) => {
    try {
        const { exhibitId, slug } = req.query;

        let userId = await auth(req);

        await corsMiddleware(req, res);

        return res.json({
            success: true,
            isMod: await isMod(userId, exhibitId || slug),
        });
    } catch (err) {
        return res.json({
            success: false,
            error: err?.message || "Server error",
        });
    }
};
