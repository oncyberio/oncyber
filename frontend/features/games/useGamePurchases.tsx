import { useEffect, useRef, useState } from "react";
import GamePurchasesService from "@api/gamePurchases/_api";
import { findGame } from "./catalog";
import { readGameMessage } from "./gameContract";
import { holdGamePause } from "./gamePause";
import {
    formatPrice,
    gameProducts,
    readPurchaseRequest,
    TEST_FUNDS,
    type Product,
    type PurchaseRefusal,
} from "./gamePurchases";

const FONT = "Inter, system-ui, sans-serif";

type Mode = "off" | "test";
interface Wallet {
    mode: Mode;
    cents: number;
}
interface Purchase {
    order: string;
    game: string;
    product: string;
    name: string;
    cents: number;
    at: number;
}
/** The one purchase the visitor is being asked about. */
interface Ask {
    /** The game's id for its request; the answer carries it back. */
    request: string;
    product: Product;
    /** The page's id for this confirmation; a retry reuses it. */
    key: string;
    paying: boolean;
    note: string;
}

/**
 * What the sheet's one main button does, from what the page knows. Guests
 * sign in first; a wallet too small for the price is topped up first.
 */
export function purchaseAction(input: {
    signedIn: boolean;
    wallet: Wallet | null;
    cents: number;
}): "sign-in" | "wait" | "unavailable" | "add-funds" | "buy" {
    if (!input.signedIn) return "sign-in";
    if (!input.wallet) return "wait";
    if (input.wallet.mode === "off") return "unavailable";
    return input.wallet.cents < input.cents ? "add-funds" : "buy";
}

const newKey = () => {
    const bytes = new Uint8Array(12);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const REFUSED: Partial<Record<PurchaseRefusal, string>> = {
    "insufficient-funds": "Your wallet doesn't hold enough for this.",
    "already-owned": "You already own this.",
    "payment-failed": "The payment didn't go through. Try again.",
    unavailable: "Purchases aren't available here.",
    undeclared: "This game doesn't sell that.",
};

/**
 * The page's side of purchases (docs/games/purchases.md). A game asks with
 * `purchase`; the page shows its own sheet with the declared name and
 * price, takes the visitor's answer, pays through the signed-in account's
 * wallet and tells the game with `purchase-result`. The game never draws
 * this sheet and never learns the balance. `owned` is answered with the
 * permanent products the visitor holds.
 *
 * The wallet button and its panel (balance and what was bought) are the
 * page's too, shown for a game that sells something.
 */
export function useGamePurchases(options: {
    game: string;
    title: string;
    /** True for a message that came from this game's frame. */
    fromGame: (event: MessageEvent) => boolean;
    /** GamePage's sender: takes `<id>:kind` and translates it for the game. */
    send: (message: object) => void;
    /** The signed-in account id, or null for a guest. */
    account: () => string | null;
    /** Opens the site's sign-in; calls back once the visitor is signed in. */
    signIn?: (done: () => void) => void;
    /** Called when a sheet or the panel closes, to give the game its focus. */
    onClose?: () => void;
}) {
    const { game } = options;
    const live = useRef(options);
    live.current = options;
    const products = useRef(gameProducts(game));
    const sells = Object.keys(products.current).length > 0;
    const [ask, setAsk] = useState<Ask | null>(null);
    const asking = useRef<Ask | null>(null);
    asking.current = ask;
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [panel, setPanel] = useState(false);
    const [history, setHistory] = useState<Purchase[] | null>(null);
    const [funding, setFunding] = useState(false);
    const signedIn = !!options.account();

    const answer = (
        request: string,
        outcome:
            | { bought: true; order: string }
            | { bought: false; reason: PurchaseRefusal }
    ) =>
        live.current.send({
            type: `${game}:purchase-result`,
            request,
            ...outcome,
        });

    const refreshWallet = async () => {
        if (!live.current.account()) return setWallet(null);
        try {
            setWallet(await GamePurchasesService.wallet({}));
        } catch {
            setWallet({ mode: "off", cents: 0 });
        }
    };

    // The wallet is the account's: read again whenever who is signed in changes.
    const account = options.account();
    useEffect(() => {
        if (sells) void refreshWallet();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [account, sells]);

    useEffect(() => {
        const receive = async (event: MessageEvent) => {
            if (!live.current.fromGame(event)) return;
            const kind = readGameMessage(event.data?.type, game)?.kind;
            if (kind === "owned") {
                const request =
                    typeof event.data.request === "string"
                        ? event.data.request.slice(0, 64)
                        : "";
                let owned: string[] = [];
                if (live.current.account() && sells)
                    try {
                        owned = (await GamePurchasesService.owned({ game }))
                            .products;
                    } catch {
                        /* Nothing is known to be owned. */
                    }
                live.current.send({
                    type: `${game}:owned-result`,
                    request,
                    products: owned,
                });
                return;
            }
            if (kind !== "purchase") return;
            const read = readPurchaseRequest(event.data);
            if (!read) {
                const request = event.data?.request;
                if (typeof request === "string")
                    answer(request.slice(0, 64), {
                        bought: false,
                        reason: "invalid",
                    });
                return;
            }
            const product = products.current[read.product];
            if (!product)
                return answer(read.request, {
                    bought: false,
                    reason: "undeclared",
                });
            // One question at a time: the visitor is never asked twice at once.
            if (asking.current)
                return answer(read.request, { bought: false, reason: "busy" });
            document.exitPointerLock?.();
            const next = {
                request: read.request,
                product,
                key: newKey(),
                paying: false,
                note: "",
            };
            asking.current = next;
            setAsk(next);
            void refreshWallet();
        };
        window.addEventListener("message", receive);
        return () => {
            window.removeEventListener("message", receive);
            // The page is leaving: an open question was never answered yes.
            if (asking.current)
                answer(asking.current.request, {
                    bought: false,
                    reason: "cancelled",
                });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game]);

    const close = (reason: PurchaseRefusal = "cancelled") => {
        const open = asking.current;
        if (!open || open.paying) return;
        asking.current = null;
        setAsk(null);
        answer(open.request, { bought: false, reason });
        live.current.onClose?.();
    };

    const addFunds = async () => {
        if (funding || wallet?.mode !== "test") return;
        setFunding(true);
        try {
            const { cents } = await GamePurchasesService.addTestFunds({});
            setWallet({ mode: "test", cents });
        } catch {
            /* The balance shown stays as it was. */
        } finally {
            setFunding(false);
        }
    };

    const buy = async () => {
        const open = asking.current;
        if (!open || open.paying) return;
        const paying = { ...open, paying: true, note: "" };
        asking.current = paying;
        setAsk(paying);
        let outcome:
            | { bought: true; order: string }
            | { bought: false; reason: PurchaseRefusal };
        // No answer at all: whether it was paid is unknown.
        let unknown = false;
        try {
            outcome = await GamePurchasesService.buy({
                game,
                product: open.product.id,
                key: open.key,
            });
        } catch {
            unknown = true;
            outcome = { bought: false, reason: "payment-failed" };
        }
        if (asking.current?.request !== open.request) return;
        void refreshWallet();
        if (
            outcome.bought === false &&
            (outcome.reason === "payment-failed" ||
                outcome.reason === "insufficient-funds")
        ) {
            // The visitor can top up or try again without the game asking anew.
            const retry = {
                ...open,
                // A refused payment is settled, so trying again is a new
                // confirmation. An unknown one keeps its key: asking again
                // finishes that same payment and never pays twice.
                key: unknown ? open.key : newKey(),
                paying: false,
                note: REFUSED[outcome.reason] ?? "",
            };
            asking.current = retry;
            setAsk(retry);
            return;
        }
        asking.current = null;
        setAsk(null);
        setHistory(null);
        answer(open.request, outcome);
        live.current.onClose?.();
    };

    const openSignIn = () => live.current.signIn?.(() => void refreshWallet());

    // A sheet or panel over the game holds the page's pause, and Escape
    // closes it without also opening the world menu.
    const covering = !!ask || panel;
    useEffect(() => {
        if (!covering) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            if (asking.current) close();
            else {
                setPanel(false);
                live.current.onClose?.();
            }
        };
        window.addEventListener("keydown", onKey, true);
        const resume = holdGamePause();
        return () => {
            window.removeEventListener("keydown", onKey, true);
            resume();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [covering]);

    useEffect(() => {
        if (!panel || !signedIn) return;
        let stale = false;
        void refreshWallet();
        GamePurchasesService.history({})
            .then(({ purchases }) => !stale && setHistory(purchases))
            .catch(() => !stale && setHistory([]));
        return () => {
            stale = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panel, signedIn]);

    const test = wallet?.mode === "test";
    const balance = wallet
        ? `${test ? "Test balance" : "Wallet"}: ${formatPrice(wallet.cents)}`
        : "";
    const button = (primary: boolean) =>
        ({
            border: 0,
            borderRadius: 999,
            padding: "10px 16px",
            font: `500 13px/1 ${FONT}`,
            cursor: "pointer",
            color: primary ? "#0b0d12" : "#fff",
            background: primary ? "#f3f3f1" : "rgba(255,255,255,0.12)",
        } as const);
    const cover = {
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(5, 6, 10, 0.6)",
    } as const;
    const card = {
        width: "min(380px, 100%)",
        boxSizing: "border-box",
        padding: 24,
        borderRadius: 18,
        color: "#fff",
        background: "#15181f",
        border: "1px solid rgba(255,255,255,0.1)",
        font: `400 13px/1.5 ${FONT}`,
    } as const;

    const action = ask
        ? purchaseAction({ signedIn, wallet, cents: ask.product.cents })
        : null;
    const sheet = ask && (
        <div data-game-overlay="purchase" onClick={() => close()} style={cover}>
            <section
                role="dialog"
                aria-modal="true"
                aria-label={`Buy ${ask.product.name}`}
                onClick={(event) => event.stopPropagation()}
                style={card}
            >
                <h2 style={{ margin: 0, font: `500 16px/1.3 ${FONT}` }}>
                    Buy {ask.product.name}?
                </h2>
                <p style={{ margin: "6px 0 0", opacity: 0.7 }}>
                    {live.current.title} · {formatPrice(ask.product.cents)}
                    {ask.product.kind === "permanent" ? " · yours to keep" : ""}
                </p>
                <p
                    role="status"
                    style={{ margin: "14px 0 0", minHeight: 20, opacity: 0.85 }}
                >
                    {ask.note ||
                        (action === "sign-in"
                            ? "Sign in to buy this with your Oncyber wallet."
                            : action === "unavailable"
                            ? REFUSED.unavailable
                            : action === "add-funds"
                            ? `${balance}. Add funds to buy this.`
                            : balance)}
                    {test && !ask.note ? " No real money is used." : ""}
                </p>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 8,
                        marginTop: 18,
                    }}
                >
                    <button
                        type="button"
                        disabled={ask.paying}
                        onClick={() => close()}
                        style={button(false)}
                    >
                        Cancel
                    </button>
                    {action === "sign-in" && (
                        <button
                            type="button"
                            autoFocus
                            onClick={openSignIn}
                            style={button(true)}
                        >
                            Sign in to buy
                        </button>
                    )}
                    {action === "add-funds" && test && (
                        <button
                            type="button"
                            autoFocus
                            disabled={funding}
                            onClick={() => void addFunds()}
                            style={button(true)}
                        >
                            Add {formatPrice(TEST_FUNDS.stepCents)} test funds
                        </button>
                    )}
                    {(action === "buy" || action === "wait") && (
                        <button
                            type="button"
                            autoFocus
                            disabled={ask.paying || action === "wait"}
                            onClick={() => void buy()}
                            style={button(true)}
                        >
                            {ask.paying
                                ? "Paying…"
                                : `Buy for ${formatPrice(ask.product.cents)}`}
                        </button>
                    )}
                </div>
            </section>
        </div>
    );

    const showWallet = sells && wallet?.mode !== "off";
    const walletButton = showWallet && (
        <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={panel}
            // A page overlay (docs/games/safe-area.md), beside Credits.
            data-game-overlay="wallet"
            data-game-overlay-edge="bottom"
            onClick={() => {
                document.exitPointerLock?.();
                setPanel(true);
            }}
            style={{
                position: "absolute",
                right: 84,
                bottom: 10,
                border: 0,
                borderRadius: 999,
                padding: "6px 10px",
                font: `500 11px/1 ${FONT}`,
                color: "rgba(255,255,255,0.7)",
                background: "rgba(10, 12, 18, 0.45)",
                cursor: "pointer",
            }}
        >
            Wallet{wallet && signedIn ? ` · ${formatPrice(wallet.cents)}` : ""}
        </button>
    );
    const closePanel = () => {
        setPanel(false);
        live.current.onClose?.();
    };
    const walletPanel = panel && !ask && (
        <div
            data-game-overlay="wallet-panel"
            onClick={closePanel}
            style={{ ...cover, placeItems: "stretch end", padding: 0 }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-label="Your wallet"
                onClick={(event) => event.stopPropagation()}
                style={{
                    ...card,
                    width: "min(360px, 100%)",
                    height: "100%",
                    overflowY: "auto",
                    borderRadius: 0,
                    borderWidth: "0 0 0 1px",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                    }}
                >
                    <h2 style={{ margin: 0, font: `500 16px/1.3 ${FONT}` }}>
                        Wallet
                    </h2>
                    <button
                        type="button"
                        autoFocus
                        aria-label="Close wallet"
                        onClick={closePanel}
                        style={{ ...button(false), padding: "6px 10px" }}
                    >
                        ×
                    </button>
                </div>
                {!signedIn ? (
                    <>
                        <p style={{ opacity: 0.8 }}>
                            Sign in to see your wallet and what you bought.
                        </p>
                        <button
                            type="button"
                            onClick={openSignIn}
                            style={button(true)}
                        >
                            Sign in
                        </button>
                    </>
                ) : (
                    <>
                        <p
                            style={{
                                margin: "14px 0 0",
                                font: `500 24px/1.2 ${FONT}`,
                            }}
                        >
                            {wallet ? formatPrice(wallet.cents) : "…"}
                        </p>
                        {test && (
                            <>
                                <p
                                    style={{
                                        margin: "4px 0 12px",
                                        opacity: 0.7,
                                    }}
                                >
                                    Test balance. No real money is used.
                                </p>
                                <button
                                    type="button"
                                    disabled={
                                        funding ||
                                        (wallet?.cents ?? 0) >=
                                            TEST_FUNDS.maxCents
                                    }
                                    onClick={() => void addFunds()}
                                    style={button(true)}
                                >
                                    Add {formatPrice(TEST_FUNDS.stepCents)} test
                                    funds
                                </button>
                            </>
                        )}
                        <h3
                            style={{
                                margin: "22px 0 6px",
                                font: `500 13px/1.3 ${FONT}`,
                                opacity: 0.7,
                            }}
                        >
                            Purchases
                        </h3>
                        {history === null ? (
                            <p style={{ opacity: 0.6 }}>Loading…</p>
                        ) : history.length === 0 ? (
                            <p style={{ opacity: 0.6 }}>Nothing bought yet.</p>
                        ) : (
                            <ul
                                aria-label="Purchases, newest first"
                                style={{
                                    listStyle: "none",
                                    margin: 0,
                                    padding: 0,
                                }}
                            >
                                {history.map((item) => (
                                    <li
                                        key={item.order}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 12,
                                            padding: "8px 0",
                                            borderTop:
                                                "1px solid rgba(255,255,255,0.08)",
                                        }}
                                    >
                                        <span>
                                            {item.name}
                                            <br />
                                            <small style={{ opacity: 0.6 }}>
                                                {findGame(item.game)?.title ??
                                                    item.game}{" "}
                                                ·{" "}
                                                {new Date(
                                                    item.at
                                                ).toLocaleDateString()}
                                            </small>
                                        </span>
                                        <span>{formatPrice(item.cents)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </section>
        </div>
    );

    return {
        element: (
            <>
                {walletButton}
                {walletPanel}
                {sheet}
            </>
        ),
    };
}
