import React, { forwardRef, useContext, useEffect, useRef } from "react";
import SignInSheet, { ConnectWalletProps } from "./SignInSheet";
import { SignInSheetContext, newSignInRequestId } from "./SignInSheetHost";

export type { ConnectWalletProps } from "./SignInSheet";
export { SignInSheetHost, useSignInSheet } from "./SignInSheetHost";

/**
 * Asks for the sign-in sheet while `open` is true.
 *
 * Screens keep rendering `<ConnectWallet open={…} toggle={…} />` where they
 * need sign-in, but none of them draws a sheet of its own any more: the
 * request goes to the one `SignInSheetHost` in `_app`, which shows a single
 * sheet for the latest request. The sheet itself is `SignInSheet.tsx`.
 *
 * Two cases still draw in place, exactly as before: sign-in buttons embedded
 * in another layout (`customModalWrapper`), and a render with no host above
 * it (tests, pages outside the app shell).
 */
const ConnectWallet = forwardRef(
    (props: ConnectWalletProps, ref: React.Ref<HTMLDivElement>) => {
        const host = useContext(SignInSheetContext);
        const inline = !host || !!props.customModalWrapper;
        const id = useRef<number>();
        if (id.current === undefined) id.current = newSignInRequestId();
        const wanted = !inline && !!props.open;

        // Every render, so the host always calls this render's callbacks.
        useEffect(() => {
            if (wanted) host.show(id.current, props);
        });
        useEffect(() => {
            if (!wanted) return;
            const request = id.current;
            return () => host.hide(request);
        }, [wanted, host]);

        return inline ? <SignInSheet {...props} ref={ref} /> : null;
    }
);

export default ConnectWallet;
