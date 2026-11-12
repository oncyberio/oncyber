import VrmApi from "@api/vrm/_api";

import VRMS from "./vrms.json"

/*
* Get avatar metadata
* @param {import("@uitypes/user").User} userData -
* @return {object} - Avatar metadata
*/
export async function getAvatarMetadata({
    userData = {},
    isFetchedFromDB = true,
    exhibit
}) {

    let vrmId = userData?.settings?.vrm;

    // default vrms
    if (!vrmId) {
        return VRMS[userData?.avatarContractAddress ? "check" : "square"];
    }

    switch (vrmId) {
        case "check":
        case "square":
            if (!userData?.avatarContractAddress || userData?.avatarContractAddress === "0xnotanaddress") {
                vrmId = "square"
            } else {
                vrmId = "check"
            }
            break;
    }

    let avatar = VRMS[vrmId];


    // Fallback to default avatar in case of invalid avatar id
    if (!avatar) {

        if(isFetchedFromDB) {

            try {

                const response = await VrmApi.getVrm({id: vrmId});

                if (response && response?.url) {
                    return response;
                }

            } catch (err) {
                console.error(err);
            }

        }

        avatar = VRMS[userData?.avatarContractAddress ? "check" : "square"];
    }

    return avatar;
}
