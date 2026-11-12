import {
    initialPurchaseState,
    purchaseFlags,
    purchaseTransition as step,
    type OrderError,
    type PurchaseEvent,
    type PurchaseState,
    type PurchaseStatus,
} from "./purchaseMachine";

const error: OrderError = { action: "purchase", message: "Timed out" };
const at = (
    status: PurchaseStatus,
    more: Partial<PurchaseState> = {}
): PurchaseState => ({
    ...initialPurchaseState,
    status,
    error: status === "failed" ? error : null,
    ...more,
});

const buy: PurchaseEvent = { type: "start", action: "purchase" };
const offer: PurchaseEvent = { type: "start", action: "offer" };
const dismiss: PurchaseEvent = { type: "dismiss" };
const reveal: PurchaseEvent = { type: "reveal" };
const succeeded: PurchaseEvent = { type: "succeeded" };
const ended: PurchaseEvent = { type: "ended" };
const failed: PurchaseEvent = { type: "failed", error };
const clear: PurchaseEvent = { type: "clear" };

const STATUSES: PurchaseStatus[] = [
    "idle",
    "confirming",
    "waiting",
    "succeeded",
    "failed",
];

test.each<[string, PurchaseState, PurchaseEvent, PurchaseState]>([
    ["a purchase is sent", at("idle"), buy, at("confirming")],
    [
        "an offer is sent",
        at("idle"),
        offer,
        at("confirming", { action: "offer" }),
    ],
    ["a retry clears the failure", at("failed"), buy, at("confirming")],
    ["the overlay is closed", at("confirming"), dismiss, at("waiting")],
    ["the overlay is shown again", at("waiting"), reveal, at("confirming")],
    [
        "a purchase goes through",
        at("confirming"),
        succeeded,
        at("succeeded", { purchased: true }),
    ],
    [
        "with the overlay closed too",
        at("waiting"),
        succeeded,
        at("succeeded", { purchased: true }),
    ],
    [
        "an offer goes through without confetti",
        at("confirming", { action: "offer" }),
        succeeded,
        at("succeeded", { action: "offer" }),
    ],
    [
        "a later offer keeps the purchase's confetti",
        at("confirming", { action: "offer", purchased: true }),
        succeeded,
        at("succeeded", { action: "offer", purchased: true }),
    ],
    ["the wallet prompt is closed", at("confirming"), ended, at("idle")],
    ["while the overlay is closed", at("waiting"), ended, at("idle")],
    [
        "the action stays for the overlay's exit",
        at("confirming", { action: "offer" }),
        ended,
        at("idle", { action: "offer" }),
    ],
    ["the order fails", at("confirming"), failed, at("failed")],
    ["the wallet cannot be connected", at("idle"), failed, at("failed")],
    ["the failure is dismissed", at("failed"), clear, at("idle")],
])("%s", (_name, state, event, next) => {
    expect(step(state, event)).toEqual(next);
});

test.each<[string, PurchaseState, PurchaseEvent]>([
    // The order's own `finally` runs after its outcome.
    ["an outcome outlasts the order's end", at("succeeded"), ended],
    ["a failure outlasts the order's end", at("failed"), ended],
    ["nothing to end", at("idle"), ended],
    ["nothing to succeed", at("idle"), succeeded],
    ["no overlay to close", at("idle"), dismiss],
    ["the overlay is not closed", at("confirming"), reveal],
    ["no overlay to show with nothing sent", at("idle"), reveal],
    // An order in progress has no failure to clear.
    ["clearing while confirming", at("confirming"), clear],
    ["clearing with nothing failed", at("idle"), clear],
    ["clearing after success", at("succeeded"), clear],
])("%s returns the same state", (_name, state, event) => {
    expect(step(state, event)).toBe(state);
});

test("an order can start, and fail, from any status", () => {
    for (const status of STATUSES) {
        expect(step(at(status), offer)).toEqual(
            at("confirming", { action: "offer" })
        );
        expect(step(at(status), failed)).toEqual(at("failed"));
    }
});

test("an event that does not apply returns the same state", () => {
    for (const status of STATUSES) {
        const state = at(status);
        expect(step(state, { type: "unknown" } as any)).toBe(state);
    }
});

test.each<[PurchaseStatus, boolean, boolean]>([
    ["idle", false, false],
    ["confirming", true, true],
    ["waiting", true, false],
    ["succeeded", false, false],
    ["failed", false, false],
])("%s reads as submitting %p, confirming %p", (status, submitting, shown) => {
    const flags = purchaseFlags(at(status, { action: "offer" }));
    expect(flags.submitting).toBe(submitting);
    expect(flags.confirming).toBe(shown);
    expect(flags.confirmingAction).toBe("offer");
    expect(flags.orderError).toBe(status === "failed" ? error : null);
    expect(flags.buyingSuccess).toBe(false);
    expect(purchaseFlags(at(status, { purchased: true })).buyingSuccess).toBe(
        true
    );
});
