import type { providers } from "ethers";

import type { TezosToolkit } from "@taquito/taquito";

// ethers loads only when an Ethereum wallet connects; this module is
// imported by the control panel and sign-in on every world.
async function createEthersProvider(eth): Promise<providers.Web3Provider> {
    const { ethers } = await import("ethers");

    return new ethers.providers.Web3Provider(eth, "any");
}

async function requestAccounts(eth): Promise<string[]> {
    return eth.request({ method: "eth_requestAccounts" });
}

import { nodeEnv } from "@env";
import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { Wallet } from "@solana/wallet-adapter-react";

export type EthereumProvider =
    | "metamask"
    | "coinbase_mobile"
    | "wallet_connect"
    | "fortmatic"
    | "bitski";

export type TezosProvider = "tezos";

export type SolanaProvider = "solana";

export type NiftyProvider = "niftygateway";

export type Provider =
    | EthereumProvider
    | TezosProvider
    | SolanaProvider
    | NiftyProvider;

export interface EthereumConnection {
    type: "ethereum";
    provider: EthereumProvider;
    /** ethers provider over `eth`; use `getSigner()` to send transactions. */
    ethers: providers.Web3Provider;
    eth: any;
    walletId: string;
}

export interface TezosConnection {
    type: "tezos";
    provider: TezosProvider;
    walletId: string;
    publicKey: string;
    tezos: TezosToolkit;
    /** Signs a packed Micheline payload (hex) with the connected account. */
    signPayload?: (payload: string) => Promise<string>;
}

export interface SolanaConnection {
    type: "solana";
    provider: SolanaProvider;
    wallet: SolanaWallet;
    walletId: string;
}

export interface NiftyConnection {
    type: "niftygateway";
    provider: "niftygateway";
    walletId: string;
    token: string;
    name: string;
    profilePicUrl: string;
}

export interface CounterpartyConnection {
    type: "counterparty";
    walletId: string;
}

export type SignedConnection =
    | EthereumConnection
    | TezosConnection
    | SolanaConnection;

export type WalletConnection =
    | SignedConnection
    | NiftyConnection
    | CounterpartyConnection;

/** The ethers provider of an Ethereum wallet connection, or null. */
export function getEthersProvider(
    connection: WalletConnection | null | undefined
): providers.Web3Provider | null {
    return connection?.type === "ethereum" ? connection.ethers : null;
}

//

export type Blockchain = WalletConnection["type"];

async function getEthChainId(eth) {
    //
    let chainId = eth.chainId;

    if (chainId == null) {
        try {
            chainId = await eth.request({ method: "eth_chainId" });
        } catch (err) {
            console.error(err);
        }
    }

    return chainId;
}

export function isEthAbort(err) {
    return (
        err?.code == 4001 ||
        err?.message == "DENIED" ||
        err?.message?.includes?.("User rejected the request")
    );
}

/**
 * An error this file throws itself, with a `code` so the sign-in sheet can
 * say what happened without reading the message. The codes are the rows of
 * `features/auth/signInErrors.ts`. Callers that show `message` are unchanged.
 */
function walletError(code: string, message: string) {
    return Object.assign(new Error(message), { code });
}

const chainIdMap = {
    polygon: "0x89",
    ethereum: "0x1",
};

export async function ensureEthChainId(eth, chain: keyof typeof chainIdMap) {
    //

    try {
        const currentChainId = await getEthChainId(eth);

        if (currentChainId == null)
            throw new Error("Unable to get current chain id");

        const chainId = chainIdMap[chain];

        if (chainId == null) {
            throw new Error("Unknown chain " + chain);
        }

        if (currentChainId == chainId) return;

        try {
            await eth.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId }],
            });
        } catch (err) {
            // This error code indicates that the chain has not been added to MetaMask
            if (err.code === 4902) {
                await eth.request({
                    method: "wallet_addEthereumChain",
                    params: [
                        {
                            chainName: "Polygon Mainnet",
                            chainId,
                            nativeCurrency: {
                                name: "MATIC",
                                decimals: 18,
                                symbol: "MATIC",
                            },
                            rpcUrls: ["https://polygon-rpc.com/"],
                        },
                    ],
                });
            } else {
                throw err;
            }
        }
    } catch (err) {
        console.error(err);
        if (isEthAbort(err)) throw err;
        throw new Error(`Failed to match current network (${chain})`);
    }
}

// EIP-6963: ask every injected wallet to announce itself. Wallets respond
// synchronously to the request event, so we can collect them in the same tick.
function getAnnouncedEthProviders(): Map<string, any> {
    const providers = new Map<string, any>();

    const onAnnounce = (event: any) => {
        const { info, provider } = event?.detail || {};
        if (info?.rdns && provider) {
            providers.set(info.rdns, provider);
        }
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.removeEventListener("eip6963:announceProvider", onAnnounce);

    return providers;
}

// With several wallets installed (Phantom, Rabby, Coinbase, Brave...), the
// last one to load wins window.ethereum, so clicking "MetaMask" could end up
// talking to another wallet — e.g. Phantom with EVM dApp interaction turned
// off fails with "DApp interaction is disabled". Resolve the real MetaMask
// provider via EIP-6963, then legacy fallbacks.
function getMetamaskProvider() {
    const announced = getAnnouncedEthProviders();

    const metamask =
        announced.get("io.metamask") || announced.get("io.metamask.flask");

    if (metamask) return metamask;

    const eth = (window as any).ethereum;

    if (eth == null) return null;

    // Legacy multi-wallet convention: wallets aggregate themselves under
    // ethereum.providers. Other wallets often fake isMetaMask for compat,
    // so exclude the known impersonators.
    if (Array.isArray(eth.providers)) {
        const mm = eth.providers.find(
            (p) =>
                p?.isMetaMask &&
                !p.isPhantom &&
                !p.isRabby &&
                !p.isBraveWallet &&
                !p.isCoinbaseWallet
        );
        if (mm) return mm;
    }

    return eth;
}

export async function connectMetamask(
    chain?: keyof typeof chainIdMap
): Promise<EthereumConnection> {
    let eth = getMetamaskProvider();

    if (eth != null) {
        //
        if (chain != null) {
            await ensureEthChainId(eth, chain);
        }

        let ethersProvider = await createEthersProvider(eth);
        const accounts = await eth.request({
            method: "eth_requestAccounts",
        });
        return {
            type: "ethereum",
            provider: "metamask",
            walletId: accounts[0],
            eth,
            ethers: ethersProvider,
        };
    } else {
        throw walletError(
            "wallet/not-installed",
            "Metamask is not installed. Please have the extension installed and try again."
        );
    }
}

export async function connectCoinbaseMobile(): Promise<EthereumConnection> {
    const WalletLink = await import("walletlink");

    const walletLink = new WalletLink.default({
        appName: "Cyber",
        appLogoUrl: "https://oncyber.io/images/logo-black.png",
        darkMode: false,
    });
    let eth = walletLink.makeWeb3Provider(
        nodeEnv.ETH_RPC,
        1
    );
    let ethersProvider = await createEthersProvider(eth);
    const accounts = await eth.request({
        method: "eth_requestAccounts",
    });
    return {
        type: "ethereum",
        provider: "coinbase_mobile",
        walletId: accounts[0],
        eth,
        ethers: ethersProvider,
    };
}

export async function connectWalletConnect(): Promise<EthereumConnection> {
    //

    const connect = await import("./connectWalletConnect");

    const { walletId, eth } = await connect.default();

    return {
        type: "ethereum",
        provider: "wallet_connect",
        walletId,
        eth,
        ethers: await createEthersProvider(eth),
    };
}

export async function connectFortmatic(): Promise<EthereumConnection> {
    const Fortmatic = await import("fortmatic");

    let fm = new Fortmatic.default("pk_live_F95FEECB1BE324B5");
    let eth = fm.getProvider() as any;
    let ethersProvider = await createEthersProvider(eth);
    const accounts = await requestAccounts(eth);
    return {
        type: "ethereum",
        provider: "fortmatic",
        walletId: accounts[0],
        eth,
        ethers: ethersProvider,
    };
}

export async function connectBitski(): Promise<EthereumConnection> {
    const { Bitski, AuthenticationStatus } = await import("bitski");

    const bitski = new Bitski(
        "50d74aac-30b5-4e81-8de7-a67a50f6368a",
        `${nodeEnv.PUBLIC_API}/bitskiCallback.html`
    );

    const eth = bitski.getProvider() as any;
    // Sign in before loading ethers, so the popup opens as close to the
    // click as before.
    if (bitski.authStatus === AuthenticationStatus.NotConnected) {
        await bitski.signIn();
    }
    let ethersProvider = await createEthersProvider(eth);
    const accounts = await requestAccounts(eth);
    return {
        type: "ethereum",
        provider: "bitski",
        walletId: accounts[0],
        eth,
        ethers: ethersProvider,
    };
}

export async function connectTezos(
    useActiveAccount = false
): Promise<TezosConnection> {
    const [{ TezosToolkit }, { BeaconWallet }] = await Promise.all([
        import("@taquito/taquito"),
        import("@taquito/beacon-wallet"),
    ]);
    // Check if we are connected. If not, do a permission request first.
    // NB: the previous endpoint (mainnet.api.tez.ie) was retired by ECAD and
    // no longer resolves.
    const Tezos = new TezosToolkit("https://rpc.tzkt.io/mainnet");
    const wallet = new BeaconWallet({ name: "oncyber" });

    Tezos.setWalletProvider(wallet);
    const dAppClient = wallet.client;

    let walletId: string;
    let publicKey: string;

    if (useActiveAccount) {
        let account = await dAppClient.getActiveAccount();
        if (account) {
            walletId = account.address;
            publicKey = account.publicKey;
        }
    }

    if (!useActiveAccount) {
        // Ignore active account in case the user want to connect to a different address
        await dAppClient.removeAllAccounts();
    }
    if (walletId == null) {
        let permissions = await dAppClient.requestPermissions();
        walletId = permissions.address;
        publicKey = permissions.publicKey;
    }

    return {
        type: "tezos",
        provider: "tezos",
        walletId,
        publicKey,
        tezos: Tezos,
        signPayload: async (payload: string) =>
            (
                await dAppClient.requestSignPayload({
                    signingType: "micheline" as any,
                    payload,
                })
            ).signature,
    };
}

export async function connectNifty(): Promise<NiftyConnection> {
    return new Promise((resolve, reject) => {
        let queryParams = {
            scope: "profile:read",
            client_id: nodeEnv.NIFTYGATEWAY_CLIENT_ID,
            redirect_uri: nodeEnv.NIFTYGATEWAY_REDIRECT_URI,
            response_type: "code",
            response_mode: "query",
        };
        let queryParamsUrl = Object.keys(queryParams)
            .map((key) => {
                return `${key}=${queryParams[key]}`;
            })
            .join("&");
        let popup = window.open(
            `${nodeEnv.NIFTYGATEWAY_AUTH_URL}/?${queryParamsUrl}`,
            "Connect",
            "popup=yes,location=no"
        );
        if (popup) {
            let onNiftyTabConnect = (ev) => {
                if (ev.key != "nifty-connect") return; // ignore other keys
                var userData = JSON.parse(ev.newValue);
                window.removeEventListener("storage", onNiftyTabConnect);
                popup.close();
                console.log(userData);
                if (!userData.username) {
                    reject(
                        userData.error === "no-token"
                            ? {
                                  message: "Authentication aborted",
                                  code: "wallet/request-rejected",
                              }
                            : { message: "Failed to authenticate" }
                    );
                } else {
                    console.log("[NIFTY!!!]", userData);
                    resolve({
                        type: "niftygateway",
                        provider: "niftygateway",
                        walletId: userData.owner,
                        token: userData.token,
                        name: userData.username,
                        profilePicUrl: userData.profilePicUrl,
                    });
                }
            };
            window.addEventListener("storage", onNiftyTabConnect);
        }
    });
}

interface PhantomWindow extends Window {
    solana?: SolanaWallet;
}

export interface SolanaWallet {
    publicKey?: { toBytes(): Uint8Array };
    isConnected: boolean;
    signMessage(message: Uint8Array, encoding: string): Promise<Uint8Array>;
    connect(): Promise<{ publicKey: {} }>;
    disconnect(): Promise<void>;
}

declare const window: PhantomWindow;

export async function connectSolana(): Promise<SolanaConnection> {
    //
    const [
        { ConnectionProvider, WalletProvider, useConnection, useWallet },
        { WalletAdapterNetwork },
        AdaptersCons,
        { WalletModalProvider, WalletModal, useWalletModal },
        { clusterApiUrl },
    ] = await Promise.all([
        import("@solana/wallet-adapter-react"),
        import("@solana/wallet-adapter-base"),
        import("@solana/wallet-adapter-phantom"),
        import("@solana/wallet-adapter-react-ui"),
        import("@solana/web3.js"),
    ]);

    // Default styles that can be overridden by your app
    require("@solana/wallet-adapter-react-ui/styles.css");

    const wallet: Wallet = await new Promise((resolve, reject) => {
        let container = (window as any)
            .$$oncyber_modal_container as HTMLElement;

        if (container == null) {
            container = document.createElement("div");
            container.id = "$$oncyber_modal_container";
            container.style.cssText = `align-items: center;
                display: flex;
                height: 100%;
                justify-content: center;
                left: 0;
                pointer-events: none;
                position: fixed;
                top: 0;
                user-select: none;
                width: 100%;
                padding: 40px;
                z-index: 99999999999999;`;
        }

        document.body.appendChild(container);

        localStorage.removeItem("solanaWalletName");

        const onFinish = (wallet: Wallet, err?: any) => {
            console.log("onFinish", wallet, err);

            if (err == null) {
                resolve(wallet);
            } else {
                reject(err);
            }

            root.unmount();
            document.body.removeChild(container);
            container.onclick = null;
        };

        const WalletWatchConnection = () => {
            const { visible, setVisible } = useWalletModal();
            const { connection } = useConnection();
            const { wallet, signMessage } = useWallet();
            const mntRef = useRef(false);

            useLayoutEffect(() => {
                if (!mntRef.current) return;

                if (!visible) {
                    onFinish(wallet);
                }
            }, [visible]);

            useEffect(() => {
                setVisible(true);
                mntRef.current = true;
            }, []);

            return null;
        };

        const App = () => {
            // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
            const network = WalletAdapterNetwork.Mainnet;

            // You can also provide a custom RPC endpoint.
            const endpoint = useMemo(() => clusterApiUrl(network), [network]);

            // Wallets that implement the Wallet Standard (Phantom, Solflare,
            // Backpack and most current wallets) are detected automatically;
            // Phantom's adapter covers its older extension versions.
            const wallets = useMemo(
                () => [new AdaptersCons.PhantomWalletAdapter()],
                []
            );

            return (
                <ConnectionProvider endpoint={endpoint}>
                    <WalletProvider
                        wallets={wallets}
                        localStorageKey={"solanaWalletName"}
                    >
                        <WalletModalProvider>
                            <WalletModal />
                            <WalletWatchConnection />
                        </WalletModalProvider>
                    </WalletProvider>
                </ConnectionProvider>
            );
        };

        const root = createRoot(container);

        root.render(<App />);

        container.onclick = () => {
            onFinish(null);
        };
    });

    // The visitor closed the list of wallets without choosing one.
    if (wallet == null)
        throw walletError("wallet/request-rejected", "No wallet was selected");

    await wallet.adapter.connect();

    if (!("signMessage" in wallet.adapter))
        throw walletError(
            "wallet/cannot-sign",
            "Selected wallet doesen't support signing messages"
        );

    let walletId = wallet.adapter.publicKey.toString();

    return {
        type: "solana",
        provider: "solana",
        wallet: wallet.adapter as any,
        walletId,
    };
}

export const connectors: {
    [Key in Provider]: Key extends TezosProvider
        ? () => Promise<TezosConnection>
        : Key extends EthereumProvider
        ? () => Promise<EthereumConnection>
        : Key extends NiftyProvider
        ? () => Promise<NiftyConnection>
        : () => Promise<SolanaConnection>;
} = {
    metamask: connectMetamask,
    coinbase_mobile: connectCoinbaseMobile,
    wallet_connect: connectWalletConnect,
    fortmatic: connectFortmatic,
    bitski: connectBitski,
    tezos: connectTezos,
    solana: connectSolana,
    niftygateway: connectNifty,
};

type BlockchainConnection<B extends Blockchain> = B extends "ethereum"
    ? EthereumConnection
    : B extends "tezos"
    ? TezosConnection
    : B extends "solana"
    ? SolanaConnection
    : B extends "niftygateway"
    ? NiftyConnection
    : never;

export function connectDefault(blockchain: Blockchain) {
    try {
        if (blockchain === "ethereum") return connectMetamask();
        if (blockchain === "tezos") return connectTezos();
        if (blockchain === "solana") return connectSolana();
        if (blockchain === "niftygateway") return connectNifty();
    } catch (err) {
        console.error(err);
        return null;
    }
}
