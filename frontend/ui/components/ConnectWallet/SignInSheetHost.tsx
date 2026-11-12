import React, {
    createContext,
    useContext,
    useMemo,
    useRef,
    useState,
} from "react";
import dynamic from "next/dynamic";
import type { ConnectWalletProps } from "./SignInSheet";

// Loaded on first use, so the app shell does not carry the sheet.
const SignInSheet = dynamic(() => import("./SignInSheet"), { ssr: false });

/** What a screen may ask of the sheet: every prop except whether it is open. */
export type SignInRequest = Omit<ConnectWalletProps, "open" | "toggle"> & {
    toggle?: ConnectWalletProps["toggle"];
};

export type SignInSheetRegistry = {
    /** Asks for the sheet, or refreshes what an open request asks for. */
    show(id: number, request: SignInRequest): void;
    /** Withdraws a request. The sheet stays up for any request below it. */
    hide(id: number): void;
    /** Opens the sheet from code; returns the function that closes it. */
    open(request?: SignInRequest): () => void;
};

export const SignInSheetContext = createContext<SignInSheetRegistry | null>(
    null
);

let nextRequestId = 0;
/** A stable id for one requester of the sheet. */
export const newSignInRequestId = () => ++nextRequestId;

/** True when two requests would draw the same sheet (callbacks aside). */
function sameSettings(a: SignInRequest, b: SignInRequest) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
        const before = a[key],
            after = b[key];
        if (typeof before === "function" && typeof after === "function")
            continue;
        if (key === "style") {
            if (JSON.stringify(before) !== JSON.stringify(after)) return false;
        } else if (before !== after) return false;
    }
    return true;
}

/**
 * The one sign-in sheet of the app. Mounted once in `_app`; every
 * `<ConnectWallet open … />` on a page, and `useSignInSheet().open()`, is a
 * request to this host, so there is never more than one sheet on screen and
 * one place to change it. Requests stack: the latest one is shown, and
 * closing it gives the sheet back to the one before.
 */
export function SignInSheetHost({ children }: { children?: React.ReactNode }) {
    // Requests are read at call time, so a requester's callbacks stay
    // current without redrawing the sheet on each of its renders.
    const requests = useRef(new Map<number, SignInRequest>());
    const [stack, setStack] = useState<number[]>([]);
    const [, redraw] = useState(0);

    const registry = useMemo<SignInSheetRegistry>(() => {
        const show = (id: number, request: SignInRequest) => {
            const previous = requests.current.get(id);
            requests.current.set(id, request);
            setStack((ids) => (ids.includes(id) ? ids : [...ids, id]));
            if (previous && !sameSettings(previous, request))
                redraw((count) => count + 1);
        };
        const hide = (id: number) => {
            requests.current.delete(id);
            setStack((ids) =>
                ids.includes(id) ? ids.filter((other) => other !== id) : ids
            );
        };
        const open = (request: SignInRequest = {}) => {
            const id = newSignInRequestId();
            const close = () => hide(id);
            show(id, {
                ...request,
                toggle: (value) => {
                    request.toggle?.(value);
                    close();
                },
            });
            return close;
        };
        return { show, hide, open };
    }, []);

    const active = stack[stack.length - 1];
    const request = active === undefined ? null : requests.current.get(active);
    const current = () => requests.current.get(active);

    return (
        <SignInSheetContext.Provider value={registry}>
            {children}
            {request && (
                <SignInSheet
                    key={active}
                    {...request}
                    open
                    toggle={(value) => current()?.toggle?.(value)}
                    setOpen={(value) => current()?.setOpen?.(value)}
                    callbackAfterAuth={
                        request.callbackAfterAuth
                            ? (...args) =>
                                  current()?.callbackAfterAuth?.(...args)
                            : undefined
                    }
                />
            )}
        </SignInSheetContext.Provider>
    );
}

/**
 * Opens the sign-in sheet from code:
 * `const close = useSignInSheet().open({ callbackAfterAuth })`.
 * Returns `null` outside the app shell (tests, standalone pages).
 */
export function useSignInSheet() {
    return useContext(SignInSheetContext);
}
