import { Experience } from "@uitypes/experience";
import type { GatingErrorType } from "@utils/checkGatingRules";
import { getHumanDateString } from "@utils/js";

export const TOO_MANY_PASSWORD_ATTEMPTS =
    "Too many tries. Wait a few minutes, then try again.";

/** What the password prompt says when the server refused a typed password. */
export function passwordRefusalMessage(refusal: GatingErrorType | string) {
    return refusal === "too-many-attempts-error"
        ? TOO_MANY_PASSWORD_ATTEMPTS
        : "Incorrect password";
}

export function getGatingErrMessage(
    gatingErr: GatingErrorType,
    exhibit: Experience
) {
    if (gatingErr === "start-time-error") {
        return `This world will be open ${getHumanDateString(
            new Date(exhibit.gating.date.start)
        )}`;
    }
    if (gatingErr === "end-time-error") {
        return `This world is no longer available`;
    }
    if (gatingErr === "no-anonymous-error") {
        return "This world only allows logged-in users to join";
    }
    if (gatingErr === "whitelist-error") {
        return "This world is private";
    }
    if (gatingErr === "room-capacity-error") {
        return "This world has reached maximum allowed capacity";
    }
    if (gatingErr === "nft-owner-error") {
        const nfts = exhibit.gating?.nftOwnership;

        if (nfts.length === 1) {
            const nft = nfts[0];
            return `This world is limited to ${nft.name || nft.slug} holders`;
        }

        return `This world is limited to holders of one of ${nfts
            .map((it) => it.name || it.slug)
            .join(", ")}`;
    }
    if (gatingErr === "password-error") {
        //
        return "This world is protected by a password";
        //
    } else if (gatingErr === "too-many-attempts-error") {
        return TOO_MANY_PASSWORD_ATTEMPTS;
    } else {
        return "Error while checking gating requirements";
    }
}

export function getGatingSuccessMessage(exhibit: Experience) {
    const suffix = "You meet all the Token Gating requirements for this world.";

    if (exhibit.gating?.whitelist?.length) {
        return `This is a private world. ${suffix}`;
    }

    if (exhibit.gating?.nftOwnership?.length) {
        const nfts = exhibit.gating?.nftOwnership;

        if (nfts.length === 1) {
            const nft = nfts[0];
            return `${nft.name || nft.slug} holders only. ${suffix}`;
        }

        return `holders of one of ${nfts
            .map((it) => it.name || it.slug)
            .join(", ")} only. ${suffix}`;
    } else {
        return null;
    }
}
