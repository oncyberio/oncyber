/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { UserContext } from "@components/context/UserContext";
import MintProvider, { useMint } from "./MintProvider";
import MintArtworkInfoBulle from "../ArtworkInfoBulle/shared/MintArtworkInfoBulle";

jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext(null),
    USER_LOGIN: "USER_LOGIN",
}));
jest.mock("@components/_3DExhibit-v2/three/constants", () => ({
    IS_MOBILE: false,
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@ui/components/Spinner", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("./mint/manifold/metadata", () => ({
    fetchManifoldMetadata: jest.fn((...args: any[]) =>
        mockConstructMint(...args)
    ),
}));
jest.mock("./mint/sound/metadata", () => ({ fetchSoundMetadata: jest.fn() }));

const mockConstructMint = jest.fn((..._args: any[]) => mockMint);
const mockMint = {
    mintId: "test-mint",
    metadata: { name: "Sample mint", eligibleQuantity: 1, mintedQuantity: 0 },
    handleLiveInterval: jest.fn(),
    handleCheckSupplyInterval: jest.fn(),
    handleTimeLeftInterval: jest.fn(),
    dispose: jest.fn(),
    onIsLive: null as null | ((opts: any) => void),
};
const artwork = {
    mintable: true,
    contractType: "manifold",
    contractAddress: "test-contract",
    campaignSlug: "test-mint",
};
const exhibit = {
    id: "test-rift",
    info: { room: "animation_test_008", customLink: "rift-mark-2" },
    artworks: { mint: { data: artwork } },
};
let mintContext: ReturnType<typeof useMint>;
function Inspect() {
    mintContext = useMint();
    return null;
}
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let toggleAuth: jest.Mock;
let exitPointerLock: jest.Mock;
let walletConnection: any;
const props = {
    isPlaying: false,
    showArtworkInfo: false,
    artwork: null as any,
};
async function render(next: Partial<typeof props> = {}) {
    Object.assign(props, next);
    await act(async () => {
        root.render(
            <UserContext.Provider
                value={
                    { token: "", walletConnection, dispatch: jest.fn() } as any
                }
            >
                <MintProvider
                    {...props}
                    exhibit={exhibit}
                    isMintExperience={true}
                    isArtworkInfoShowing={props.showArtworkInfo}
                    toggleAuth={toggleAuth}
                >
                    <Inspect />
                    {props.showArtworkInfo && (
                        <MintArtworkInfoBulle artwork={artwork} />
                    )}
                </MintProvider>
            </UserContext.Provider>
        );
    });
}
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    walletConnection = null;
    Object.assign(props, {
        isPlaying: false,
        showArtworkInfo: false,
        artwork: null,
    });
    toggleAuth = jest.fn();
    exitPointerLock = jest.fn();
    Object.defineProperty(document, "exitPointerLock", {
        configurable: true,
        value: exitPointerLock,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
});

test("guest entry, resume and inspecting a mint item never open authentication or release the pointer", async () => {
    await render();
    await render({ isPlaying: true });
    await render({ isPlaying: false });
    await render({ isPlaying: true });
    await render({ showArtworkInfo: true, artwork });
    await render({ showArtworkInfo: false, artwork: null });
    await render({ showArtworkInfo: true, artwork });
    expect(toggleAuth).not.toHaveBeenCalled();
    expect(exitPointerLock).not.toHaveBeenCalled();
    expect(mockConstructMint).not.toHaveBeenCalled();
    expect(mintContext.mints).toEqual({});
    expect(container.textContent).toContain("login");
});

test("the mint detail’s explicit login control still opens voluntary authentication", async () => {
    await render({ isPlaying: true, showArtworkInfo: true, artwork });
    expect(toggleAuth).not.toHaveBeenCalled();
    const login = [...container.querySelectorAll("span")].find(
        (element) => element.textContent === "login"
    );
    expect(login).toBeDefined();
    act(() => Simulate.click(login));
    expect(toggleAuth).toHaveBeenCalledTimes(1);
    expect(mockConstructMint).not.toHaveBeenCalled();
});

// The in-world mint was removed (card 14): a connected wallet no longer
// starts a mint, and no contract code is loaded.
test("connecting a wallet no longer initializes an in-world mint", async () => {
    await render({ isPlaying: true, showArtworkInfo: true, artwork });
    const ethers = {
        listAccounts: jest.fn().mockResolvedValue(["test-wallet"]),
        getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
    };
    walletConnection = { ethers };
    await render();
    await render({ isPlaying: false });
    await render({ isPlaying: true });
    expect(ethers.listAccounts).not.toHaveBeenCalled();
    expect(ethers.getNetwork).not.toHaveBeenCalled();
    expect(mockConstructMint).not.toHaveBeenCalled();
    expect(mintContext.isMintExperience).toBe(false);
    expect(mintContext.mints).toEqual({});
    expect(mintContext.mintProviders).toEqual({});
    expect(mintContext.currentMint).toBeNull();
    expect(container.textContent).toContain("login");
    expect(toggleAuth).not.toHaveBeenCalled();
});

test("the mint module no longer loads web3, the Sound SDK or contract files", () => {
    const fs = require("fs");
    const path = require("path");
    const source = fs.readFileSync(
        path.join(__dirname, "MintProvider.tsx"),
        "utf8"
    );
    const imports = source.match(/^import .*$/gm) || [];
    expect(imports).toEqual([
        'import React, { useContext, useMemo } from "react";',
    ]);
});
