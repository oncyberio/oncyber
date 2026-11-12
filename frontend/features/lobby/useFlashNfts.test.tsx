/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { fetchOwnedAssets } from "@utils/fetchAssets";
import useFlashNfts, {
    flashArtworkFromAsset,
    flashWallets,
} from "./useFlashNfts";

jest.mock("@utils/fetchAssets", () => ({ fetchOwnedAssets: jest.fn() }));
jest.mock("@utils/urlUtils", () => ({
    resize: (url: string) => url,
    relay: (url: string) => `/api/proxyv2?url=${encodeURIComponent(url)}`,
}));
const firstWallet = "0x1111111111111111111111111111111111111111";
const secondWallet = "0x2222222222222222222222222222222222222222";
const asset = {
    name: "Blue sky",
    token_id: "1",
    asset_contract: { address: "0xArt" },
    image_url: "https://images.example/art.png",
    source: { blockchain: "ethereum" },
};
let collection: ReturnType<typeof useFlashNfts>;
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
function Harness({ wallet = firstWallet, enabled = true }) {
    collection = useFlashNfts(wallet, enabled);
    return <div>{collection.items.map((item) => item.title).join(",")}</div>;
}
async function render(wallet = firstWallet, enabled = true) {
    await act(async () => {
        root.render(<Harness wallet={wallet} enabled={enabled} />);
    });
}
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    (fetchOwnedAssets as jest.Mock).mockResolvedValue({
        assets: [asset],
        hasMore: false,
    });
});
afterEach(() => {
    act(() => root.unmount());
    host.remove();
    jest.clearAllMocks();
    jest.useRealTimers();
});

test("loads only the actual account wallet and paginates cursor results on request", async () => {
    (fetchOwnedAssets as jest.Mock)
        .mockResolvedValueOnce({ assets: [asset], hasMore: "next-page" })
        .mockResolvedValueOnce({
            assets: [asset, { ...asset, token_id: "2", name: "Sun" }],
            hasMore: false,
        });
    await render();
    expect(fetchOwnedAssets).toHaveBeenCalledTimes(1);
    expect(fetchOwnedAssets).toHaveBeenCalledWith(firstWallet, 0);
    expect(collection.items).toHaveLength(1);
    expect(collection.hasMore).toBe(true);
    await act(async () => {
        collection.loadMore();
        collection.loadMore();
    });
    expect(fetchOwnedAssets).toHaveBeenCalledTimes(2);
    expect(fetchOwnedAssets).toHaveBeenLastCalledWith(firstWallet, "next-page");
    expect(collection.items.map((item) => item.title)).toEqual([
        "Blue sky",
        "Sun",
    ]);
    expect(collection.hasMore).toBe(false);
});

test("signed-out or walletless views never load a collection", async () => {
    await render(firstWallet, false);
    await render("");
    expect(fetchOwnedAssets).not.toHaveBeenCalled();
    expect(collection.items).toEqual([]);
});

test("late wallet responses never replace the newly selected account or survive sign-out", async () => {
    let resolveFirst: (value: any) => void;
    (fetchOwnedAssets as jest.Mock).mockImplementation((wallet) =>
        wallet === firstWallet
            ? new Promise((resolve) => {
                  resolveFirst = resolve;
              })
            : Promise.resolve({
                  assets: [{ ...asset, name: "Second wallet" }],
                  hasMore: false,
              })
    );
    await render();
    expect(collection.loading).toBe(true);
    await render(secondWallet);
    expect(collection.items[0].title).toBe("Second wallet");
    await act(async () => resolveFirst({ assets: [asset], hasMore: false }));
    expect(collection.items[0].title).toBe("Second wallet");
    await render(secondWallet, false);
    expect(collection.items).toEqual([]);
});

test("provider errors can retry without inventing an empty successful collection", async () => {
    (fetchOwnedAssets as jest.Mock).mockResolvedValueOnce({ hasError: true });
    await render();
    expect(collection.error).toContain("couldn’t load");
    expect(collection.items).toEqual([]);
    await act(async () => collection.retry());
    expect(collection.error).toBe("");
    expect(collection.items[0].title).toBe("Blue sky");
});

test("numeric pagination retains earlier NFTs and retries the failed page", async () => {
    (fetchOwnedAssets as jest.Mock)
        .mockResolvedValueOnce({ assets: [asset], hasMore: true })
        .mockResolvedValueOnce({ hasError: true })
        .mockResolvedValueOnce({
            assets: [{ ...asset, token_id: "2" }],
            hasMore: false,
        });
    await render();
    await act(async () => collection.loadMore());
    expect(collection.items).toHaveLength(1);
    expect(collection.error).toBeTruthy();
    await act(async () => collection.retry());
    expect(fetchOwnedAssets).toHaveBeenLastCalledWith(firstWallet, 1);
    expect(collection.items).toHaveLength(2);
});

test("normalizes actual image and video posters into bounded relayed artwork", () => {
    const artwork = flashArtworkFromAsset({
        ...asset,
        display_image_url: "ipfs://ipfs/QmArtwork/poster.png",
        animation_url: "https://images.example/movie.mp4",
        image_width: 800,
        image_height: 400,
    });
    expect(artwork).toEqual({
        id: "ethereum:0xArt:1",
        title: "Blue sky",
        imageUrl: `/api/proxyv2?url=${encodeURIComponent(
            "https://ipfs.io/ipfs/QmArtwork/poster.png"
        )}`,
        aspect: 2,
    });
    expect(
        flashArtworkFromAsset({ ...asset, image_url: "javascript:alert(1)" })
    ).toBeNull();
    expect(
        flashArtworkFromAsset({
            ...asset,
            image_url: "https://images.example/video.mp4",
        })
    ).toBeNull();
    expect(
        flashArtworkFromAsset({
            ...asset,
            image_url: "https://user:secret@example.com/art.png",
        })
    ).toBeNull();
    expect(
        flashArtworkFromAsset({
            animation_url: "https://images.example/video.mp4",
        })
    ).toBeNull();
});

test("wallet options exclude web2 proxy identities and deduplicate only case-insensitive Ethereum addresses", () => {
    expect(
        flashWallets({
            defaultWallet: firstWallet,
            userData: { type: "web2", walletId: firstWallet },
        })
    ).toEqual([]);
    expect(
        flashWallets({
            defaultWallet: firstWallet,
            linkedWallets: [firstWallet, secondWallet],
            userData: { type: "web2" },
        })
    ).toEqual([firstWallet, secondWallet]);
    expect(
        flashWallets({
            defaultWallet: "user@example.com",
            linkedWallets: [firstWallet, "unknown"],
        })
    ).toEqual([firstWallet]);
});

test("a stalled collection times out into a retryable state", async () => {
    jest.useFakeTimers();
    (fetchOwnedAssets as jest.Mock).mockImplementationOnce(
        () => new Promise(() => {})
    );
    await render();
    expect(collection.loading).toBe(true);
    await act(async () => jest.advanceTimersByTime(20000));
    expect(collection.loading).toBe(false);
    expect(collection.error).toBeTruthy();
    await act(async () => collection.retry());
    expect(collection.items[0].title).toBe("Blue sky");
});

test("current identity excludes stale cached wallets from another account", () => {
    const staleContext = {
        defaultWallet: firstWallet,
        linkedWallets: [firstWallet],
    };
    expect(
        flashWallets({
            ...staleContext,
            userData: { id: secondWallet, type: "web3" },
        })
    ).toEqual([secondWallet]);
    expect(
        flashWallets({
            ...staleContext,
            userData: { id: "current-user@example.com", type: "web2" },
        })
    ).toEqual([]);
    expect(
        flashWallets({
            ...staleContext,
            userData: {
                id: "current-user@example.com",
                type: "web2",
                linkedAccounts: [
                    {
                        type: "web3",
                        id: "proxy-account",
                        originalWalletId: secondWallet,
                    },
                    { type: "web2", id: firstWallet },
                ],
            },
        })
    ).toEqual([secondWallet]);
});

test("switching current accounts fetches only the new identity despite stale context wallet props", async () => {
    const staleContext = {
        defaultWallet: firstWallet,
        linkedWallets: [firstWallet],
    };
    function AccountCollection({ id, type = "web3" }) {
        const wallet =
            flashWallets({
                ...staleContext,
                userData: { id, type },
            })[0] || "";
        collection = useFlashNfts(wallet, true);
        return null;
    }
    await act(async () => root.render(<AccountCollection id={firstWallet} />));
    await act(async () => root.render(<AccountCollection id={secondWallet} />));
    expect((fetchOwnedAssets as jest.Mock).mock.calls).toEqual([
        [firstWallet, 0],
        [secondWallet, 0],
    ]);
    await act(async () =>
        root.render(<AccountCollection id="email-user" type="web2" />)
    );
    expect(fetchOwnedAssets).toHaveBeenCalledTimes(2);
    expect(collection.items).toEqual([]);
    expect(collection.loading).toBe(false);
});

 test("Flash prefers the existing processed image used by Studio", () => {
    const processed = "https://cyber.mypinata.cloud/ipfs/processed";
    expect(flashArtworkFromAsset({ ...asset, dcompressed_image_url: processed }).imageUrl)
        .toBe(`/api/proxyv2?url=${encodeURIComponent(processed)}`);
 });
