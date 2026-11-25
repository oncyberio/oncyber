import { useCallback, useEffect, useState } from "react";
import { findGame } from "@features/games/catalog";
import { formatPrice, TEST_FUNDS } from "@features/games/gamePurchases";

interface WalletState {
    mode: "off" | "test" | "wallet";
    cents: number;
    /** With the visitor's own wallet: where, and in what, they pay. */
    network?: string;
    token?: string;
    /** Their account's wallet, when the account is one. */
    address?: string;
}
interface Purchase {
    order: string;
    game: string;
    name: string;
    cents: number;
    at: number;
}

/**
 * The purchases client, loaded when the profile is the visitor's own. It
 * is handed back inside an object: the client answers any property as a
 * server method, so returned bare from a promise it would be asked for
 * `then` and call the server with that.
 */
const service = async () => ({
    purchases: (await import("@api/gamePurchases/_api")).default,
});

/**
 * The visitor's wallet, on their own profile: what they can spend in games
 * and a way to add to it (docs/games/purchases.md). Shows nothing where
 * purchases are off.
 *
 * With play money, topping up is one press. With their own wallet, the
 * balance is read from the chain and topping up is sending the token to
 * their address, which is shown to copy.
 */
export default function ProfileWallet() {
    const [wallet, setWallet] = useState<WalletState | null>(null);
    const [busy, setBusy] = useState(false);
    const [topUp, setTopUp] = useState(false);
    const [note, setNote] = useState("");
    // What they bought, read when they ask to see it.
    const [history, setHistory] = useState<Purchase[] | "loading" | null>(null);

    const load = useCallback(async () => {
        try {
            setWallet(await (await service()).purchases.wallet({}));
        } catch {
            setWallet({ mode: "off", cents: 0 });
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);

    if (!wallet || wallet.mode === "off") return null;
    const test = wallet.mode === "test";
    const full = test && wallet.cents >= TEST_FUNDS.maxCents;
    const addTestFunds = async () => {
        if (busy) return;
        setBusy(true);
        setNote("");
        try {
            const { cents } = await (
                await service()
            ).purchases.addTestFunds({});
            setWallet({ mode: "test", cents });
        } catch {
            setNote("Couldn’t add funds. Try again.");
        } finally {
            setBusy(false);
        }
    };
    const refresh = async () => {
        if (busy) return;
        setBusy(true);
        await load();
        setBusy(false);
    };
    const togglePurchases = async () => {
        if (history) return setHistory(null);
        setHistory("loading");
        try {
            setHistory(
                (await (await service()).purchases.history({})).purchases
            );
        } catch {
            setHistory([]);
            setNote("Couldn’t load your purchases. Try again.");
        }
    };
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(wallet.address);
            setNote("Address copied.");
        } catch {
            setNote("Couldn’t copy. Select the address instead.");
        }
    };

    return (
        <section className="profile-wallet" aria-label="Your wallet">
            <div className="wallet-row">
                <span className="wallet-held">
                    <small>
                        {test
                            ? "Test balance"
                            : wallet.address
                            ? `${wallet.token} on ${wallet.network}`
                            : "Wallet"}
                    </small>
                    {test || wallet.address ? (
                        <strong>{formatPrice(wallet.cents)}</strong>
                    ) : (
                        <strong className="wallet-plain">
                            {wallet.token} on {wallet.network}
                        </strong>
                    )}
                </span>
                {test ? (
                    <button
                        type="button"
                        className="primary"
                        disabled={busy || full}
                        onClick={() => void addTestFunds()}
                    >
                        {full
                            ? "Balance is full"
                            : `Top up ${formatPrice(TEST_FUNDS.stepCents)}`}
                    </button>
                ) : (
                    wallet.address && (
                        <button
                            type="button"
                            className="primary"
                            aria-expanded={topUp}
                            onClick={() => setTopUp((open) => !open)}
                        >
                            Top up
                        </button>
                    )
                )}
            </div>
            {test && <p>No real money is used.</p>}
            {!test && !wallet.address && (
                <p>
                    Purchases in games are paid from a wallet you choose when
                    you buy.
                </p>
            )}
            {!test && wallet.address && topUp && (
                <div className="wallet-topup">
                    <p>
                        Send {wallet.token} on {wallet.network} to your wallet.
                        It shows here once it arrives.
                    </p>
                    <code>{wallet.address}</code>
                    <div className="profile-actions">
                        <button type="button" onClick={() => void copy()}>
                            Copy address
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void refresh()}
                        >
                            {busy ? "Checking…" : "Check balance"}
                        </button>
                    </div>
                </div>
            )}
            <button
                type="button"
                className="wallet-purchases-toggle"
                aria-expanded={!!history}
                onClick={() => void togglePurchases()}
            >
                Purchases
            </button>
            {history === "loading" && <p role="status">Loading…</p>}
            {Array.isArray(history) && !history.length && (
                <p>Nothing bought yet.</p>
            )}
            {Array.isArray(history) && history.length > 0 && (
                <ul className="wallet-purchases">
                    {history.map((item) => (
                        <li key={item.order}>
                            <span>
                                {item.name}
                                <small>
                                    {findGame(item.game)?.title ?? item.game} ·{" "}
                                    {new Date(item.at).toLocaleDateString()}
                                </small>
                            </span>
                            <span className="mono">
                                {formatPrice(item.cents)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {note && (
                <p role="status" className="wallet-note">
                    {note}
                </p>
            )}
        </section>
    );
}
