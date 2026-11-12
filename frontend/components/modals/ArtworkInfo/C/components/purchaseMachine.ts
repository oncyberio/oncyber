/**
 * Buying an artwork, or making an offer on it, from the artwork panel, as a
 * pure state machine.
 *
 * `ArtworkInfoProvider` (`ArtworkContext.tsx`) holds the value and applies
 * `purchaseTransition`. It keeps everything that touches the wallet, the
 * marketplace and analytics, and reads the flags its consumers have always
 * read (`submitting`, `confirming`, `confirmingAction`, `buyingSuccess`,
 * `orderError`) from `purchaseFlags`.
 *
 *   any ─ start(action) ─▶ confirming
 *   confirming ─ dismiss ─▶ waiting ─ reveal ─▶ confirming
 *   confirming | waiting ─ succeeded ─▶ succeeded
 *   confirming | waiting ─ ended ─▶ idle
 *   any ─ failed(error) ─▶ failed ─ clear ─▶ idle
 *
 * "confirming" is an order sent to the wallet with the confirming overlay
 * up; "waiting" is the same order after the visitor closed the overlay. The
 * order goes on either way. "ended" is an order that finished without a
 * result to show: the visitor closed their wallet's prompt. "succeeded" and
 * "failed" are the order's outcome. A wallet that could not be connected
 * fails before any order starts, so "failed" applies from any status.
 *
 * `action` is the latest order's, and stays after it ends so the overlay
 * keeps its wording while it animates out. `purchased` is set by the first
 * purchase that goes through and never cleared: the confetti and the
 * congratulations follow it.
 */

/** What the visitor asked for. */
export type OrderAction = "purchase" | "offer";

/** A purchase or offer that failed, shown beside the Buy / offer controls. */
export interface OrderError {
    action: OrderAction;
    message: string;
    /** The offer amount, so Retry can submit the same offer again. */
    amount?: number;
}

export type PurchaseStatus =
    | "idle"
    | "confirming"
    | "waiting"
    | "succeeded"
    | "failed";

export interface PurchaseState {
    status: PurchaseStatus;
    /** The latest order's action; "purchase" before any. */
    action: OrderAction;
    /** Set exactly while the status is "failed". */
    error: OrderError | null;
    /** A purchase went through while this panel was open. */
    purchased: boolean;
}

export type PurchaseEvent =
    /** An order is sent to the wallet. */
    | { type: "start"; action: OrderAction }
    /** The visitor closed the confirming overlay; the order goes on. */
    | { type: "dismiss" }
    /** The confirming overlay is shown again. */
    | { type: "reveal" }
    /** The order went through. */
    | { type: "succeeded" }
    /** The order finished with nothing to show (the wallet was closed). */
    | { type: "ended" }
    /** The order, or connecting the wallet for it, failed. */
    | { type: "failed"; error: OrderError }
    /** The failure no longer applies: dismissed, or another listing. */
    | { type: "clear" };

export const initialPurchaseState: PurchaseState = {
    status: "idle",
    action: "purchase",
    error: null,
    purchased: false,
};

const isOrderOpen = (status: PurchaseStatus) =>
    status === "confirming" || status === "waiting";

export function purchaseTransition(
    state: PurchaseState,
    event: PurchaseEvent
): PurchaseState {
    switch (event.type) {
        case "start":
            return {
                ...state,
                status: "confirming",
                action: event.action,
                error: null,
            };
        case "dismiss":
            return state.status === "confirming"
                ? { ...state, status: "waiting" }
                : state;
        case "reveal":
            return state.status === "waiting"
                ? { ...state, status: "confirming" }
                : state;
        case "succeeded":
            return isOrderOpen(state.status)
                ? {
                      ...state,
                      status: "succeeded",
                      purchased: state.purchased || state.action === "purchase",
                  }
                : state;
        case "ended":
            return isOrderOpen(state.status)
                ? { ...state, status: "idle" }
                : state;
        case "failed":
            return { ...state, status: "failed", error: event.error };
        case "clear":
            return state.status === "failed"
                ? { ...state, status: "idle", error: null }
                : state;
        default:
            return state;
    }
}

/** The flags `ArtworkContext` has always exposed, read from the state. */
export function purchaseFlags(state: PurchaseState) {
    return {
        submitting: isOrderOpen(state.status),
        confirming: state.status === "confirming",
        confirmingAction: state.action,
        buyingSuccess: state.purchased,
        orderError: state.error,
    };
}
