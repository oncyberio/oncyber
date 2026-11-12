import { GatingData, GatingType } from "./types";

//
export function isSpaceGatingEnabled(gating: GatingData) {
    if (gating == null) return false;
    return (
        gating.date?.start ||
        gating.date?.end ||
        gating.nftOwnership?.length ||
        gating.whitelist?.length ||
        gating.roomCapacity != null ||
        gating.noAnonymous ||
        gating.password
    );
}

export function isGatingRuleEnabled(rule: GatingType, gating: GatingData) {
    if (gating == null) return false;

    if (rule === "date") {
        return gating.date?.start || gating.date?.end;
    }

    if (rule === "nftOwnership") {
        return gating.nftOwnership?.length;
    }

    if (rule === "whitelist") {
        return gating.whitelist?.length;
    }

    if (rule === "roomCapacity") {
        return gating.roomCapacity != null;
    }

    if (rule === "password") {
        return gating.password != null;
    }

    if (rule === "noAnonymous") {
        return gating.noAnonymous;
    }
}

const gatingRules: GatingType[] = [
    "date",
    "nftOwnership",
    "whitelist",
    "roomCapacity",
    "noAnonymous",
];

export function isGatingRule(key: string): key is GatingType {
    return gatingRules.includes(key as any);
}
