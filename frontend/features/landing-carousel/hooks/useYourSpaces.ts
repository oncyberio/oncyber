import { useCallback, useContext, useState } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { UserContext } from "@components/context/UserContext";
import { preloadStudio } from "@features/studio/loadStudio";
import { prepareNavigation } from "@utils/navigationSaves";

const swrOptions = { revalidateOnFocus: false, refreshInterval: 0 };

// The account helpers are large; the landing loads them only to open a space.
const accountApi = () => import("@utils/saveToDb");

/**
 * The signed-in visitor's spaces for Create, owned and shared, and a way to
 * reopen one in Studio. Studio opens the account's current space, so opening
 * one makes it current first, as creating a space does.
 */
export default function useYourSpaces(enabled: boolean) {
    const { token, user, userData, isAnonymous, authenticated } =
        useContext(UserContext);
    const router = useRouter();
    const signedIn = !!(authenticated && token && user?.id && !isAnonymous);
    // Light summaries (no artworks), fetched once while the landing is idle
    // so Create has them before it opens.
    const query = useSWR(
        enabled && signedIn ? `/your-spaces/${user.id}` : null,
        async () => (await import("@api/exhibit/_api")).default.listMine({}),
        swrOptions
    );
    const currentId =
        query.data?.currentId || (userData?.currentExhibitId as string);
    const [openingId, setOpeningId] = useState<string>(null);
    const [error, setError] = useState("");
    const open = useCallback(
        async (spaceId: string) => {
            if (openingId) return;
            setOpeningId(spaceId);
            setError("");
            try {
                await Promise.all([
                    preloadStudio().catch(() => {}),
                    prepareNavigation(),
                    spaceId === currentId
                        ? null
                        : accountApi()
                              .then(({ updateUser }) =>
                                  updateUser(
                                      token,
                                      { currentExhibitId: spaceId },
                                      user?.id
                                  )
                              )
                              .then((result) => {
                                  if (!result?.success)
                                      throw new Error(
                                          "Couldn't open this space. Please try again."
                                      );
                              }),
                ]);
                if (!(await router.push("/studio")))
                    throw new Error(
                        "Navigation was cancelled. Try opening the space again."
                    );
            } catch (failure) {
                setOpeningId(null);
                setError(
                    failure?.message ||
                        "Couldn't open this space. Please try again."
                );
            }
        },
        [openingId, router, token, user?.id, currentId]
    );
    return {
        signedIn,
        spaces: query.data?.spaces,
        loading: signedIn && enabled && !query.data && !query.error,
        currentId,
        openingId,
        error,
        open,
    };
}
