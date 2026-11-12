import { Experience, KitBashData, Stylekit } from "@uitypes/experience";
import { updateUser, createExhibit, createStylekit } from "@utils/saveToDb";
import ExhibitService from "@api/exhibit/_api";
import { getDefaultAnonExhibit } from "@utils/anon";

export const createNewSpace = async (
    userId: string,
    token: string,
    room: string
) => {
    // if no token then it's an anon user
    if (!token) return getDefaultAnonExhibit(room);

    const data = await createExhibit(userId, token, room);

    if (!data.success) {
        throw new Error(data.message || "Failed to create exhibit");
    }

    const result = await updateUser(
        token,
        {
            currentExhibitId: data.exhibit?.id,
            walletId: userId?.toLowerCase(),
        },
        userId
    );

    if (!result.success) {
        throw new Error(result.message || "Failed to update user data");
    }

    return data.exhibit;
};

export async function createEmptySpace(
    userId: string,
    token: string,
    kit?: string
): Promise<Experience> {
    //
    if (!token) return getDefaultAnonExhibit(kit, true);

    const data = await ExhibitService.createEmpty({ userId, kit });

    if (data.success === false) {
        throw new Error(data.error || "Failed to create exhibit");
    }

    const result = await updateUser(
        token,
        {
            currentExhibitId: data.value?.id,
            walletId: userId?.toLowerCase(),
        },
        userId
    );

    if (!result.success) {
        throw new Error(result.message || "Failed to update user data");
    }

    return data?.value;
}

export async function createDefaultStylekit(
    room: string,
    kitbash: Record<string, KitBashData>,
    kitbashImgs: Record<string, string>,
    userId: string,
    token: string
): Promise<Stylekit> {
    //

    const stylekitId = room;

    const res = await createStylekit(
        userId,
        token,
        stylekitId,
        room,
        kitbash,
        kitbashImgs
    );

    if (res.success) return res.stylekit;

    throw new Error("Failed to create stylekit");
}
