import {
    configureChains,
    connect,
    createConfig,
    disconnect,
    getWalletClient,
} from "@wagmi/core";
import { mainnet } from "@wagmi/core/chains";
import { WalletConnectConnector } from "@wagmi/core/connectors/walletConnect";
import { w3mProvider } from "@web3modal/ethereum";
import { delay } from "@utils/js";

const chains = [mainnet];

const projectId = "478197d8092dbaeb2da5c86f872f3be7";

const connectTimeout = 5 * 60 * 1000;
const sessionUpdatePatchKey = "__oncyberSessionUpdatePatch";

let walletConnectConnector: WalletConnectConnector | null = null;

function getChainsFromAccounts(accounts: unknown): string[] {
    if (!Array.isArray(accounts)) return [];

    const chains = new Set<string>();

    accounts.forEach((account) => {
        if (typeof account !== "string") return;

        const [namespace, reference] = account.split(":");

        if (namespace != null && reference != null) {
            chains.add(`${namespace}:${reference}`);
        }
    });

    return Array.from(chains);
}

function getRequiredNamespacesFromSession(namespaces: unknown) {
    const requiredNamespaces = {};

    if (namespaces == null || typeof namespaces !== "object") {
        return requiredNamespaces;
    }

    Object.entries(namespaces).forEach(([key, namespace]: [string, any]) => {
        requiredNamespaces[key] = {
            chains: Array.isArray(namespace?.chains)
                ? namespace.chains
                : getChainsFromAccounts(namespace?.accounts),
            methods: Array.isArray(namespace?.methods) ? namespace.methods : [],
            events: Array.isArray(namespace?.events) ? namespace.events : [],
        };
    });

    return requiredNamespaces;
}

function getWalletConnectConnector() {
    if (walletConnectConnector != null) return walletConnectConnector;

    const { publicClient } = configureChains(chains, [
        w3mProvider({ projectId }),
    ]);

    walletConnectConnector = new WalletConnectConnector({
        chains,
        options: {
            projectId,
            showQrModal: true,
            metadata: {
                name: "oncyber",
                description: "Connect to oncyber",
                url:
                    typeof window !== "undefined"
                        ? window.location.origin
                        : "https://oncyber.io",
                icons: ["https://oncyber.io/images/logo-black.png"],
            },
            qrModalOptions: {
                themeMode: "light",
                themeVariables: {
                    "--wcm-accent-color": "#1a1a1a",
                    "--wcm-background-color": "#1a1a1a",
                    "--wcm-z-index": "99999999999999",
                },
            },
        },
    });

    createConfig({
        autoConnect: false,
        connectors: [walletConnectConnector],
        publicClient,
    });

    return walletConnectConnector;
}

function rejectAfterTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            // `code` is the row of features/auth/signInErrors.ts shown for it.
            reject(
                Object.assign(new Error("WalletConnect request timed out"), {
                    code: "wallet/timeout",
                })
            );
        }, ms);

        promise.then(
            (value) => {
                window.clearTimeout(timeout);
                resolve(value);
            },
            (error) => {
                window.clearTimeout(timeout);
                reject(error);
            }
        );
    });
}

async function resetWalletConnectSession(
    connector: WalletConnectConnector
): Promise<void> {
    // Always start from a new WalletConnect pairing instead of reusing
    // a previous mobile-wallet session.
    try {
        await connector.disconnect();
    } catch (err) {
        console.warn("[connectWalletConnect/reset-connector]", err);
    }

    try {
        await disconnect();
    } catch (err) {
        console.warn("[connectWalletConnect/disconnect]", err);
    }
}

function hydrateMissingRequiredNamespaces(client: any, topic: unknown): void {
    if (typeof topic !== "string") return;

    let session = null;

    try {
        session = client?.session?.get(topic);
    } catch (err) {
        return;
    }

    if (
        session == null ||
        session.requiredNamespaces != null ||
        session.namespaces == null
    ) {
        return;
    }

    const requiredNamespaces = getRequiredNamespacesFromSession(
        session.namespaces
    );
    const optionalNamespaces = session.optionalNamespaces || {};

    session.requiredNamespaces = requiredNamespaces;
    session.optionalNamespaces = optionalNamespaces;

    client?.session
        ?.update?.(topic, { requiredNamespaces, optionalNamespaces })
        ?.catch?.((err) => {
            console.warn("[connectWalletConnect/session-update-hydrate]", err);
        });
}

function isWalletConnectNamespaceUpdateError(err: any) {
    return err?.message === "Cannot convert undefined or null to object";
}

async function patchWalletConnectSessionUpdate(
    connector: WalletConnectConnector
): Promise<void> {
    const provider: any = await connector.getProvider();
    const client = provider?.signer?.client;
    const engine = client?.engine;

    if (engine == null || engine[sessionUpdatePatchKey]) return;

    const originalIsValidUpdate = engine.isValidUpdate?.bind(engine);

    if (typeof originalIsValidUpdate !== "function") return;

    engine.isValidUpdate = (params) => {
        // WalletConnect can emit a session_update after connect with older
        // sessions missing requiredNamespaces, which the SDK rejects async.
        hydrateMissingRequiredNamespaces(client, params?.topic);

        try {
            return Promise.resolve(originalIsValidUpdate(params)).catch(
                (err) => {
                    if (isWalletConnectNamespaceUpdateError(err)) {
                        console.warn(
                            "[connectWalletConnect/session-update]",
                            err
                        );
                        return;
                    }

                    throw err;
                }
            );
        } catch (err) {
            if (isWalletConnectNamespaceUpdateError(err)) {
                console.warn("[connectWalletConnect/session-update]", err);
                return Promise.resolve();
            }

            throw err;
        }
    };

    engine[sessionUpdatePatchKey] = true;
}

/*
// React sandbox solution

let container = document.createElement("div");
container.id = "wc-container";
container.style.cssText = `
    position: fixed;
    z-index: 99999999999999;`;

document.body.appendChild(container);

export async function connectWalletConnect() {
    //

    return new Promise<any>((resolve, reject) => {
        //
        const { provider } = configureChains(chains, [
            walletConnectProvider({
                projectId,
            }),
        ]);

        const wagmiClient = createClient({
            autoConnect: false,
            connectors: modalConnectors({ appName: "web3Modal", chains }),
            provider,
        });

        // Web3Modal and Ethereum Client
        const ethereumClient = new EthereumClient(wagmiClient, chains);

        const Connection = () => {
            //
            const { open, isOpen } = useWeb3Modal();
            const { disconnect } = useDisconnect();
            const [hasModalStarted, setModalStarted] = useState(false);
            const { address, isConnected } = useAccount();

            useLayoutEffect(() => {
                async function start() {
                    disconnect();

                    await open();
                    setModalStarted(true);
                }

                start();
            }, []);

            useEffect(() => {
                //
                async function eff() {
                    if (
                        hasModalStarted &&
                        !isOpen &&
                        isConnected &&
                        address &&
                        provider
                    ) {
                        const signer = await fetchSigner();


                        // await signer.signMessage("gm").then((sig) => {
                        // });

                        resolve({
                            walletId: address,
                            eth: (signer.provider as any).provider,
                        });
                    }
                }
                eff();
            }, [isConnected, address, provider, hasModalStarted, isOpen]);

            return null;
        };

        const App = () => {
            return (
                <>
                    <WagmiConfig client={wagmiClient}>
                        <Connection />
                    </WagmiConfig>

                    <Web3Modal
                        projectId={projectId}
                        ethereumClient={ethereumClient}
                    />
                </>
            );
        };

        const root = createRoot(container);

        root.render(<App />);
    });
}
*/

export default async function connectWalletConnect2(): Promise<{
    walletId: string;
    eth: any;
}> {
    //

    const connector = getWalletConnectConnector();

    await resetWalletConnectSession(connector);
    await patchWalletConnectSessionUpdate(connector);

    const connection = await rejectAfterTimeout(
        connect({ connector }),
        connectTimeout
    );

    const client = await getWalletClient();

    const address = client?.account?.address || connection?.account;

    if (address == null) {
        throw new Error("DENIED");
    }

    // https://github.com/MetaMask/metamask-mobile/issues/6735
    await delay(300);

    return {
        walletId: address,
        eth: client,
    };
}
