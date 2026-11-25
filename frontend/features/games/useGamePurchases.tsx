import { useEffect, useRef, useState } from "react";
import GamePurchasesService from "@api/gamePurchases/_api";
import { ActionButton } from "@styles/brand";
import Icon from "@features/landing-carousel/components/Icon";
import {
    UtilityActions,
    UtilityButton,
    UtilityRow,
} from "@features/content-host/NativeVisitorPanel";
import { PurchasePanel, PurchaseSummary } from "./gamePurchaseStyles";
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
 * `purchase`; the page opens its payment sidebar on the right with the
 * declared name and price, takes the visitor's answer, pays through the
 * signed-in account's wallet and tells the game with `purchase-result`.
 * The game never draws this and never learns the balance. `owned` is
 * answered with the permanent products the visitor holds.
 *
 * The wallet itself (balance, adding funds, what was bought) is part of
 * the account, in the account dashboard; the sidebar links to it.
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
    /**
     * Opens the wallet in the account dashboard; resolves when it closes,
     * so the balance shown here is read again.
     */
    openWallet?: () => Promise<unknown> | void;
    /** Called when the sidebar closes, to give the game its focus. */
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
    // The account dashboard is open over the sidebar.
    const inWallet = useRef(false);
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
        if (asking.current) void refreshWallet();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [account]);

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
        answer(open.request, outcome);
        live.current.onClose?.();
    };

    const openSignIn = () => live.current.signIn?.(() => void refreshWallet());

    const openWallet = async () => {
        if (inWallet.current) return;
        inWallet.current = true;
        try {
            await live.current.openWallet?.();
        } catch {
            /* The dashboard could not open; the sidebar is as it was. */
        } finally {
            inWallet.current = false;
            // Funds may have been added there.
            void refreshWallet();
        }
    };

    // The sidebar holds the page's pause, and Escape closes it without also
    // opening the world menu.
    const covering = !!ask;
    useEffect(() => {
        if (!covering) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            // Something opened over the sidebar (the sign-in sheet, the
            // account dashboard): Escape is its, and the question stays.
            if (
                inWallet.current ||
                document.querySelector('[role="dialog"][aria-modal="true"]')
            )
                return;
            event.preventDefault();
            event.stopPropagation();
            close();
        };
        window.addEventListener("keydown", onKey, true);
        const resume = holdGamePause();
        return () => {
            window.removeEventListener("keydown", onKey, true);
            resume();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [covering]);

    const test = wallet?.mode === "test";
    const held =
        signedIn && wallet && wallet.mode !== "off"
            ? formatPrice(wallet.cents)
            : "";
    const action = ask
        ? purchaseAction({ signedIn, wallet, cents: ask.product.cents })
        : null;
    // The payment sidebar: the lobby's utility panel, docked right. The
    // game is a frame, so a click on it never reaches this page; the
    // sidebar closes by Cancel, its close button or Escape, each a no.
    const sidebar = ask && (
        <PurchasePanel
            title={`Buy ${ask.product.name}`}
            onClose={() => close()}
            closeOnClickAway={false}
        >
            <PurchaseSummary data-game-overlay="purchase">
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
                {action === "sign-in" && (
                    <ActionButton $variant="blue" onClick={openSignIn}>
                        Sign in to buy
                    </ActionButton>
                )}
                <UtilityActions>
                    <UtilityButton
                        type="button"
                        disabled={ask.paying}
                        onClick={() => close()}
                    >
                        Cancel
                    </UtilityButton>
                    {action === "add-funds" && test && (
                        <UtilityButton
                            $primary
                            type="button"
                            disabled={funding}
                            onClick={() => void addFunds()}
                        >
                            Add {formatPrice(TEST_FUNDS.stepCents)} test funds
                        </UtilityButton>
                    )}
                    {(action === "buy" || action === "wait") && (
                        <UtilityButton
                            $primary
                            type="button"
                            disabled={ask.paying || action === "wait"}
                            onClick={() => void buy()}
                        >
                            {ask.paying
                                ? "Paying…"
                                : action === "wait"
                                ? "Loading wallet…"
                                : `Buy for ${formatPrice(ask.product.cents)}`}
                        </UtilityButton>
                    )}
                </UtilityActions>
                {signedIn && live.current.openWallet && (
                    <UtilityRow
                        type="button"
                        disabled={ask.paying}
                        onClick={() => void openWallet()}
                    >
                        <Icon name="wallet" size={16} />
                        <span>
                            Wallet
                            <small>Your balance and purchases</small>
                        </span>
                    </UtilityRow>
                )}
            </PurchaseSummary>
        </PurchasePanel>
    );

    return { element: sidebar || null };
}
