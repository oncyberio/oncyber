import React, { useContext, useMemo } from "react";

// The in-world mint is gone. It served one space (room "animation_test_008",
// custom link "rift-mark-2") and pulled web3, the Sound SDK, moment and
// every contract JSON in config/ into each world's control panel.
//
// What is left is the context the artwork bubbles and the artwork-info mint
// variants still read (ArtworkInfoBulle/*, modals/ArtworkInfo/C and D).
// They now always see "no mint": no mint data, no mint providers, and the
// same "log in to see the mint info" state a guest saw before. The creator
// mint flows (pages/mints/**, the uploader's Mint modals) do not use this
// file.

export type MintStates =
    | "mint-not-live"
    | "mint-ended"
    | "mint-live"
    | "whitelisted"
    | "not-whitelisted"
    | "sold-out"
    | "minting"
    | "minted"
    | "mint-fail";

interface MintArtwork {
    date: {
        start: any;
        end: any;
    };
    supply: number;
    supplyLimit: number;
    id: number;
    name: string;
    state: MintStates;
    eligibleQuantity: number;
    mintedQuantity: number;
}

interface MintContextState {
    handleMint: any;
    isNotificationShowing: boolean;
    currentMint: MintArtwork;
    mints: {
        [key: string]: MintArtwork;
    };
    mintProviders: {
        [key: string | number]: any;
    };
    deployer: {
        name: string;
        avatar: string;
        description: string;
    };
    isMintExperience: boolean;
    toggleAuth: any;
}

export const MintContext = React.createContext<MintContextState>(null);

const noop = () => {};

// Kept so the control panel's wiring (ControlPanel/index.tsx) keeps working.
// Only `children` and `toggleAuth` are still used.
export default function MintProvider({
    children,
    toggleAuth,
}: {
    children?: React.ReactNode;
    toggleAuth?: any;
    [prop: string]: any;
}) {
    const value = useMemo<MintContextState>(
        () => ({
            mints: {},
            handleMint: noop,
            isNotificationShowing: false,
            mintProviders: {},
            currentMint: null,
            deployer: null,
            isMintExperience: false,
            toggleAuth: toggleAuth || noop,
        }),
        [toggleAuth]
    );

    return (
        <MintContext.Provider value={value}>{children}</MintContext.Provider>
    );
}

export const useMint = () => {
    const context = useContext(MintContext);

    if (!context) {
        return {} as MintContextState;
    }

    return context;
};
