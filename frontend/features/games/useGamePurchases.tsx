import { useEffect, useRef, useState } from "react";
import GamePurchasesService from "@api/gamePurchases/_api";
import { ActionButton } from "@styles/brand";
import Icon from "@features/landing-carousel/components/Icon";
import {
    UtilityButton,
    UtilityStack,
} from "@features/content-host/NativeVisitorPanel";
import {
    PurchaseDialog,
    PurchaseScrim,
    WalletControl,
    WalletPanel,
} from "./gamePurchaseStyles";
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
            // Another sheet opened over this one (the sign-in): Escape is
            // that sheet's, and this one stays as it is underneath.
            const dialogs = document.querySelectorAll(
                '[role="dialog"][aria-modal="true"]'
            );
            const top = dialogs[dialogs.length - 1];
            if (
                top &&
                !top.closest(
                    '[data-game-overlay="purchase"], [data-game-overlay="wallet-panel"]'
                )
            )
                return;
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
    const held =
        signedIn && wallet && wallet.mode !== "off"
            ? formatPrice(wallet.cents)
            : "";
    const action = ask
        ? purchaseAction({ signedIn, wallet, cents: ask.product.cents })
        : null;
    // The question: the shared dark dialog, white to confirm, outline to
    // cancel, blue only to sign in (docs/brand, Dialogs and Action buttons).
    const sheet = ask && (
        <PurchaseScrim data-game-overlay="purchase" onClick={() => close()}>
            <PurchaseDialog
                role="dialog"
                aria-modal="true"
                aria-label={`Buy ${ask.product.name}`}
                onClick={(event) => event.stopPropagation()}
            >
                <h2>Buy {ask.product.name}?</h2>
                <p>
                    {live.current.title}
                    {ask.product.kind === "permanent" ? " · yours to keep" : ""}
                </p>
                <dl>
                    <dt>Price</dt>
                    <dd>{formatPrice(ask.product.cents)}</dd>
                    {held && (
                        <>
                            <dt>{test ? "Test balance" : "Your wallet"}</dt>
                            <dd>{held}</dd>
                        </>
                    )}
                </dl>
                <p
                    className="purchase-status"
                    role="status"
                    data-tone={ask.note ? "error" : undefined}
                >
                    {ask.note ||
                        (action === "sign-in"
                            ? "Sign in to buy this with your Oncyber wallet."
                            : action === "unavailable"
                            ? REFUSED.unavailable
                            : action === "add-funds"
                            ? `Add funds to buy this.${
                                  test ? " No real money is used." : ""
                              }`
                            : test
                            ? "No real money is used."
                            : "")}
                </p>
                <div className="purchase-actions">
                    <ActionButton disabled={ask.paying} onClick={() => close()}>
                        Cancel
                    </ActionButton>
                    {action === "sign-in" && (
                        <ActionButton
                            $variant="blue"
                            autoFocus
                            onClick={openSignIn}
                        >
                            Sign in to buy
                        </ActionButton>
                    )}
                    {action === "add-funds" && test && (
                        <ActionButton
                            $variant="white"
                            autoFocus
                            disabled={funding}
                            onClick={() => void addFunds()}
                        >
                            Add {formatPrice(TEST_FUNDS.stepCents)} test funds
                        </ActionButton>
                    )}
                    {(action === "buy" || action === "wait") && (
                        <ActionButton
                            $variant="white"
                            autoFocus
                            disabled={ask.paying || action === "wait"}
                            onClick={() => void buy()}
                        >
                            {ask.paying
                                ? "Paying…"
                                : action === "wait"
                                ? "Loading wallet…"
                                : `Buy for ${formatPrice(ask.product.cents)}`}
                        </ActionButton>
                    )}
                </div>
            </PurchaseDialog>
        </PurchaseScrim>
    );

    const showWallet = sells && wallet?.mode !== "off";
    const opener = useRef<HTMLButtonElement>(null);
    const closePanel = () => {
        setPanel(false);
        live.current.onClose?.();
    };
    const walletButton = showWallet && (
        <WalletControl
            ref={opener}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={panel}
            aria-label={held ? `Wallet · ${held}` : "Wallet"}
            // A page overlay (docs/games/safe-area.md), above Credits.
            data-game-overlay="wallet"
            data-game-overlay-edge="bottom"
            onClick={() => {
                if (panel) return closePanel();
                document.exitPointerLock?.();
                setPanel(true);
            }}
        >
            <Icon name="wallet" size={16} />
            <span>Wallet</span>
            {held && <span className="wallet-balance">{held}</span>}
        </WalletControl>
    );
    // The wallet: the lobby's utility panel. The game is a frame, so a click
    // on it never reaches this page; the panel closes by its own button,
    // Escape, or its opener.
    const walletPanel = panel && !ask && (
        <WalletPanel
            title="Wallet"
            onClose={closePanel}
            returnFocusRef={opener}
            closeOnClickAway={false}
        >
            <UtilityStack data-game-overlay="wallet-panel">
                {!signedIn ? (
                    <>
                        <p>Sign in to see your wallet and what you bought.</p>
                        <ActionButton $variant="blue" onClick={openSignIn}>
                            Sign in
                        </ActionButton>
                    </>
                ) : (
                    <>
                        <div>
                            <p className="wallet-balance">
                                {wallet ? formatPrice(wallet.cents) : "…"}
                            </p>
                            {test && (
                                <p>Test balance. No real money is used.</p>
                            )}
                        </div>
                        {test && (
                            <UtilityButton
                                $primary
                                type="button"
                                disabled={
                                    funding ||
                                    (wallet?.cents ?? 0) >= TEST_FUNDS.maxCents
                                }
                                onClick={() => void addFunds()}
                            >
                                Add {formatPrice(TEST_FUNDS.stepCents)} test
                                funds
                            </UtilityButton>
                        )}
                        <h3>Purchases</h3>
                        {history === null ? (
                            <p>Loading…</p>
                        ) : history.length === 0 ? (
                            <p>Nothing bought yet.</p>
                        ) : (
                            <ul
                                className="wallet-list"
                                aria-label="Purchases, newest first"
                            >
                                {history.map((item) => (
                                    <li key={item.order}>
                                        <span>
                                            {item.name}
                                            <small>
                                                {findGame(item.game)?.title ??
                                                    item.game}{" "}
                                                ·{" "}
                                                {new Date(
                                                    item.at
                                                ).toLocaleDateString()}
                                            </small>
                                        </span>
                                        <span className="wallet-price">
                                            {formatPrice(item.cents)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </UtilityStack>
        </WalletPanel>
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
