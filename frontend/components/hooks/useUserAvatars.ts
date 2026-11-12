import { useContext, useMemo } from "react";
import { useAssets, UseAssetsData } from "../hooks/useAssets";
import { noop } from "@utils/js";
import { UserContext } from "@components/context/UserContext";

const sortAssets = (assets, current) => {
    // console.log("CURRENT");
    // console.log(current);
    // console.log(assets);
    return (assets || []).sort((a, b) =>
        a.image_preview_url == current.img ? -1 : 1
    );
};

const mergeAssetsReq = (
    req1: UseAssetsData,
    req2: UseAssetsData
): UseAssetsData => {
    if (req1 == null) return req2;
    if (req2 == null) return req1;

    const state: UseAssetsData["state"] =
        req1.state === "LoadingSuccess" || req2.state === "LoadingSuccess"
            ? "LoadingSuccess"
            : req1.state === "InitialLoading" || req2.state === "InitialLoading"
            ? "InitialLoading"
            : "LoadinError";

    let req: UseAssetsData = {
        state,
        loadMore: noop,
        data: {
            assets: [].concat(req1.data?.assets || [], req2.data?.assets || []),
        },
    };

    return req;
};

export function useUserAvatars() {
    //
    const { user, userData } = useContext(UserContext);

    const ethAssetsReq = useAssets(user.id, "default", "owned", true);
    const polyAssetsReq = useAssets(user.id, "polygon", "owned", true);

    const assetsReq = useMemo(() => {
        const mergedReq = mergeAssetsReq(ethAssetsReq, polyAssetsReq);
        if (mergedReq?.data?.assets) {
            mergedReq.data.assets = sortAssets(
                // formatVerifiedCollections(
                mergedReq.data.assets,
                // )
                {
                    img: userData?.avatar,
                    verified: userData?.avatarVerified,
                }
            );
        }
        return mergedReq;
    }, [
        ethAssetsReq,
        polyAssetsReq,
        userData?.avatar,
        userData?.avatarVerified,
    ]);

    return assetsReq;
}
