import { ReactNode, useEffect, useRef } from "react";
import styled from "styled-components";
import Icon from "@features/landing-carousel/components/Icon";
import { darkDialogSurface } from "@components/Dialogs/styles";

export default function DestinationModal({
    title,
    onClose,
    children,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const panel = useRef<HTMLDivElement>(null);
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const previous = document.activeElement as HTMLElement;
        panel.current?.focus({ preventScroll: true });
        return () => {
            if (previous?.isConnected) previous.focus({ preventScroll: true });
        };
    }, []);
    return (
        <Overlay
            onClick={(event) => {
                if (event.target === event.currentTarget) close.current();
            }}
        >
            <Panel
                ref={panel}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="destination-dialog-title"
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        close.current();
                    }
                    if (event.key !== "Tab") return;
                    const elements = Array.from(
                        panel.current.querySelectorAll<HTMLElement>(
                            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]'
                        )
                    ).filter((element) => element.getClientRects().length > 0);
                    const first = elements[0];
                    const last = elements[elements.length - 1];
                    if (!first) {
                        event.preventDefault();
                    } else if (
                        event.shiftKey &&
                        (document.activeElement === first ||
                            document.activeElement === panel.current)
                    ) {
                        event.preventDefault();
                        last.focus();
                    } else if (
                        !event.shiftKey &&
                        (document.activeElement === last ||
                            document.activeElement === panel.current)
                    ) {
                        event.preventDefault();
                        first.focus();
                    }
                }}
            >
                <div className="dialog-heading">
                    <h2 id="destination-dialog-title">{title}</h2>
                    <button
                        type="button"
                        className="dialog-close"
                        aria-label="Close dialog"
                        onClick={onClose}
                    >
                        <Icon name="close" size={20} />
                    </button>
                </div>
                {children}
            </Panel>
        </Overlay>
    );
}

const Overlay = styled.div`
    position: fixed;
    z-index: 20;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: #0009;
`;
// The shared dark dialog surface (Dialogs/styles), like the other windows.
const Panel = styled.div`
    ${darkDialogSurface}
    width: min(640px, 100%);
    max-height: calc(100svh - 48px);
    overflow-y: auto;
    padding: 24px;
    color: var(--title-color);
    font: 400 14px/1.5 var(--oc-font);
    outline: none;
    /* Muted copy in the panels inside reads the paper's muted ink. */
    --oc-paper-muted: var(--content-color);
    .dialog-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 24px;
    }
    h2 {
        margin: 0;
        font: 500 20px/1.3 var(--oc-font);
    }
    .dialog-close {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border: 1px solid var(--btn-border-color);
        border-radius: 12px;
        background: transparent;
        cursor: pointer;
        color: inherit;
    }
    .dialog-close:hover {
        background: var(--btn-secondary-hover-bg);
        border-color: var(--btn-secondary-hover-border);
    }

    /*
     * The panels shown in this window (DestinationFilters, UploadDestination
     * with DropGlb, DestinationDetails with the uploader's ActionMenu) still
     * write light-surface colours of their own. Until those files take the
     * dialog variables themselves, they are held to the dark surface here;
     * "&&" outranks their single-class rules.
     */
    && section {
        border-color: var(--border-color);
    }
    && input[type="checkbox"] {
        accent-color: var(--btn-color);
    }
    && form button,
    && .existing-actions .menu {
        border: 1px solid var(--btn-border-color);
        background: transparent;
        color: var(--btn-secondary-color);
    }
    && form button.apply,
    && .destination-actions > .primary {
        border: 1px solid var(--btn-color);
        background: var(--btn-color);
        color: var(--btn-bg-color);
    }
    /* The menu's dots are drawn in near-black. */
    && .existing-actions .menu svg circle {
        fill: currentColor;
    }
    && .existing-actions .items {
        background: var(--bg-color);
        border-color: var(--border-color);
    }
    && .existing-actions .items > button {
        color: var(--title-color);
    }
    && .existing-actions .items > button:hover {
        background: var(--btn-secondary-hover-bg);
    }
    /* DropGlb's drop zone. */
    && section p,
    && section b,
    && section span.hr div {
        color: inherit;
    }
    && section a {
        color: inherit;
        text-decoration: underline;
    }
    && section span.hr div:first-child:before,
    && section span.hr div:last-child:before {
        background-color: var(--border-color);
    }
    && section button {
        border-color: var(--btn-border-color);
        color: var(--btn-secondary-color);
    }
    button:focus-visible,
    a:focus-visible,
    input:focus-visible {
        outline-color: #2567ff;
    }
    @media (max-width: 700px) {
        padding: 20px;
        max-height: calc(100svh - 32px);
    }
`;
