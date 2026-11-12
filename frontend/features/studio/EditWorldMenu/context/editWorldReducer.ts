import {
    AssetOption,
    NftOpt,
    PlacedAssetsOpt,
    PortalOpt,
    TextOpt,
    UploadOpt,
} from "../AddAsset/shared/AssetTypes";
import { EditableMesh, isPortal, Placeholder } from "../utils";

export type EditWorldState =
    | { type: "IDLE" }
    | { type: "UNFOLDED" }
    | { type: "ADD"; option: AssetOption };

export type EditWorldEvent =
    // UNFOLDED -> IDLE, IDLE -> UNFOLDED
    | { type: "toggle-fold" }
    // * -> ADD
    | { type: "opt-on"; option: AssetOption }
    // ADD -> IDLE
    | { type: "opt-off" }

    // EDIT -> IDLE
    | { type: "placeholder"; mesh: Placeholder; isNFTDisabled?: boolean };

export function currentOpt(state: EditWorldState) {
    //
    if (state.type === "ADD") {
        //
        return state.option;
    }

    return null;
}

export function editWorldReducer(
    state: EditWorldState,
    event: EditWorldEvent
): EditWorldState {
    //

    // mesh event applies in all states
    if (event.type === "opt-on") {
        //
        return { type: "ADD", option: event.option };
        //
    } else if (event.type === "placeholder") {
        //
        if (isPortal(event.mesh)) {
            //
            return { type: "ADD", option: PortalOpt };
            //
        } else if (state.type === "ADD" && state.option !== PlacedAssetsOpt) {
        } else {
            return {
                type: "ADD",
                option: !event.isNFTDisabled ? NftOpt : UploadOpt,
            };
        }
    }

    switch (state.type) {
        //
        case "IDLE":
            //
            if (event.type === "toggle-fold") {
                return { type: "UNFOLDED" };
            }
            break;

        case "UNFOLDED":
            //
            if (event.type === "toggle-fold") {
                return { type: "IDLE" };
            }
            break;

        case "ADD":
            //
            if (event.type === "opt-off") {
                return { type: "IDLE" };
            }
            break;
        default:
    }

    return state;
}
