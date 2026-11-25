import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { useRouter } from "next/router";
import styled from "styled-components";
import Link from "@components/InAppLink";
import ProfilePortrait from "@ui/components/ProfilePortrait";
import { brandFoundation } from "@styles/brand";
import { baseTokens } from "@styles/tokens";
import Icon from "./Icon";
import { MY_SPACES_HREF } from "../yourSpaces";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from "locales/language";
import { useCyberTranslation } from "@components/context/I18nContext";

type Props = {
    id: string;
    name: string;
    detail: string;
    photo?: string;
    initialFocus?: "first" | "last";
    onClose(): void;
    /**
     * The visitor's own profile: the lobby with their sidebar open, where
     * Edit profile and their wallet are.
     */
    profileHref: string;
    onConnections(): void;
    onFriends(): void;
    onSignOut(): void;
};

/** Account navigation stays above both the lobby canvas and hosted experiences. */
/** Same pathname and query parameters, in any order; the hash is ignored. */
export function sameRoute(current: string | undefined, href: string) {
    if (!current) return false;
    const a = new URL(current, "http://x");
    const b = new URL(href, "http://x");
    if (a.pathname !== b.pathname) return false;
    a.searchParams.sort();
    b.searchParams.sort();
    return a.searchParams.toString() === b.searchParams.toString();
}

export default function AccountSidebar({
    id,
    name,
    detail,
    photo,
    initialFocus = "first",
    onClose,
    profileHref,
    onConnections,
    onFriends,
    onSignOut,
}: Props) {
    const dialog = useRef<HTMLDialogElement>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout>>();
    const closingRef = useRef(false);
    const [closing, setClosing] = useState(false);
    const { t, i18n, switchI18n } = useCyberTranslation();
    const [languagesOpen, setLanguagesOpen] = useState(false);
    const router = useRouter();
    const active = (href: string) =>
        sameRoute(router?.asPath, href) ? ("page" as const) : undefined;

    useEffect(() => {
        const element = dialog.current;
        const previous = document.activeElement as HTMLElement;
        const overflow = document.body.style.overflow;
        document.exitPointerLock?.();
        document.body.style.overflow = "hidden";
        element.showModal();
        const items = element.querySelectorAll<HTMLElement>(
            "[data-account-item]"
        );
        items[initialFocus === "last" ? items.length - 1 : 0]?.focus();
        return () => {
            clearTimeout(closeTimer.current);
            element.close();
            document.body.style.overflow = overflow;
            if (previous?.isConnected) previous.focus({ preventScroll: true });
        };
    }, []);

    const finish = (action?: () => void) => {
        clearTimeout(closeTimer.current);
        dialog.current?.close();
        // Unmount the native modal before another account dialog takes focus.
        if (action) {
            flushSync(onClose);
            action();
        } else onClose();
    };
    const dismiss = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            finish();
            return;
        }
        setClosing(true);
        closeTimer.current = setTimeout(
            () => finish(),
            baseTokens.motion.standard
        );
    };
    const arrow = <Icon name="forward" size={16} className="row-arrow" />;
    return createPortal(
        <Surface
            ref={dialog}
            id={id}
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            data-closing={closing || undefined}
            onCancel={(event) => {
                event.preventDefault();
                dismiss();
            }}
            onPointerDown={(event) => {
                event.stopPropagation();
                if (event.target === event.currentTarget) dismiss();
            }}
            onKeyDown={(event) => {
                // Typing and shortcuts in account UI must not move the avatar.
                event.stopPropagation();
                if (event.key === "Escape" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    dismiss();
                }
                if (event.key === "Tab") {
                    const targets = [
                        ...dialog.current.querySelectorAll<HTMLElement>(
                            "button:not(:disabled), a[href], select"
                        ),
                    ];
                    const first = targets[0],
                        last = targets[targets.length - 1];
                    if (event.shiftKey && document.activeElement === first) {
                        event.preventDefault();
                        last?.focus();
                    } else if (
                        !event.shiftKey &&
                        document.activeElement === last
                    ) {
                        event.preventDefault();
                        first?.focus();
                    }
                }
            }}
        >
            <aside className="account-sidebar">
                <header className="sidebar-header">
                    <h2 id={`${id}-title`}>{t("Your account")}</h2>
                    <button
                        className="close-account"
                        aria-label={t("Close account sidebar")}
                        onClick={dismiss}
                        type="button"
                    >
                        <Icon name="close" size={20} />
                    </button>
                </header>
                <div className="sidebar-scroll">
                    <div className="profile-summary">
                        <ProfilePortrait
                            src={photo}
                            className="sidebar-portrait"
                        />
                        <span className="identity">
                            <strong>{name}</strong>
                            {detail && (
                                <span className="identity-detail">
                                    {detail}
                                </span>
                            )}
                        </span>
                    </div>
                    <nav
                        aria-label={t("Your worlds")}
                        className="sidebar-section"
                    >
                        <h3>{t("Your worlds")}</h3>
                        <Link
                            className="sidebar-row"
                            href={MY_SPACES_HREF}
                            aria-current={active(MY_SPACES_HREF)}
                            data-account-item
                            onClick={() => finish()}
                        >
                            <Icon name="gallery" size={21} />
                            <span>
                                <strong>{t("My spaces")}</strong>
                                <small>
                                    {t("Your galleries and experiences")}
                                </small>
                            </span>
                            {arrow}
                        </Link>
                        <Link
                            className="sidebar-row"
                            href="/destinations"
                            aria-current={active("/destinations")}
                            data-account-item
                            onClick={() => finish()}
                        >
                            <Icon name="globe" size={21} />
                            <span>
                                <strong>{t("My destinations")}</strong>
                                <small>{t("The places you own")}</small>
                            </span>
                            {arrow}
                        </Link>
                        <button
                            type="button"
                            className="sidebar-row"
                            data-account-item
                            onClick={() => finish(onFriends)}
                        >
                            <Icon name="people" size={21} />
                            <span>
                                <strong>{t("Friends")}</strong>
                                <small>{t("Friends and requests")}</small>
                            </span>
                            {arrow}
                        </button>
                    </nav>
                    <section
                        aria-labelledby={`${id}-settings`}
                        className="sidebar-section settings-section"
                    >
                        <h3 id={`${id}-settings`}>{t("Account")}</h3>
                        <Link
                            className="sidebar-row compact-row"
                            href={profileHref}
                            data-account-item
                            onClick={() => finish()}
                        >
                            <Icon name="user" size={20} />
                            <span>{t("Your profile")}</span>
                            {arrow}
                        </Link>
                        <button
                            type="button"
                            className="sidebar-row compact-row"
                            data-account-item
                            onClick={() => finish(onConnections)}
                        >
                            <Icon name="wallet" size={20} />
                            <span>{t("Linked accounts")}</span>
                            {arrow}
                        </button>
                        <button
                            type="button"
                            className="sidebar-row compact-row language-row"
                            aria-expanded={languagesOpen}
                            aria-controls={`${id}-languages`}
                            onClick={() => setLanguagesOpen((open) => !open)}
                        >
                            <Icon name="globe" size={20} />
                            <span>{t("Language")}</span>
                            <span className="row-value" lang={i18n}>
                                {LANGUAGE_NAMES[i18n]}
                            </span>
                            <Icon name="chevron" size={12} />
                        </button>
                        {languagesOpen && (
                            <div
                                id={`${id}-languages`}
                                className="language-list"
                                role="group"
                                aria-label={t("Language")}
                            >
                                {SUPPORTED_LANGUAGES.map((language) => (
                                    <button
                                        key={language}
                                        type="button"
                                        className="sidebar-row language-option"
                                        aria-pressed={language === i18n}
                                        lang={language}
                                        onClick={() => {
                                            // Always store the choice, even when
                                            // it already shows (from ?lang= or
                                            // the browser), so it sticks.
                                            if (language !== i18n) {
                                                amplitude_logAnalyticsEvent(
                                                    "language_changed",
                                                    { from: i18n, to: language }
                                                );
                                            }
                                            switchI18n(language);
                                        }}
                                    >
                                        <span>{LANGUAGE_NAMES[language]}</span>
                                        {language === i18n && (
                                            <Icon name="check" size={16} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
                <footer className="sidebar-footer">
                    <button
                        type="button"
                        className="sidebar-row compact-row sign-out"
                        data-account-item
                        onClick={() => finish(onSignOut)}
                    >
                        <Icon name="signout" size={20} />
                        <span>{t("Sign out")}</span>
                    </button>
                </footer>
            </aside>
        </Surface>,
        document.body
    );
}

const Surface = styled.dialog`
    ${brandFoundation}
    position: fixed;
    inset: 0;
    width: 100%;
    max-width: none;
    height: 100%;
    height: 100dvh;
    max-height: none;
    margin: 0;
    padding: 16px;
    border: 0;
    box-sizing: border-box;
    background: transparent;
    color: var(--oc-ink);
    overflow: hidden;
    overscroll-behavior: none;
    touch-action: none;
    &[open] {
        display: flex;
        justify-content: flex-end;
    }
    &::backdrop {
        background: #0005;
        animation: account-shade-in var(--oc-enter) var(--oc-ease) both;
    }
    &,
    * {
        box-sizing: border-box;
    }
    button,
    a {
        -webkit-tap-highlight-color: transparent;
    }
    button {
        font: inherit;
        cursor: pointer;
    }
    a {
        color: inherit;
        text-decoration: none;
    }
    button:focus-visible,
    a:focus-visible {
        outline: 2px solid var(--oc-accent);
        outline-offset: -2px;
    }
    .account-sidebar {
        width: 368px;
        max-width: 100%;
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        border: 1px solid var(--oc-line-strong);
        border-radius: ${baseTokens.radius.panel}px;
        background: var(--oc-panel);
        box-shadow: -8px 12px 40px #0003;
        overflow: hidden;
        touch-action: pan-y;
        animation: account-sidebar-in var(--oc-enter) var(--oc-ease) both;
    }
    .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 20px 20px 12px 24px;
    }
    h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
        line-height: 1.4;
    }
    .close-account {
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        border: 1px solid var(--oc-line);
        border-radius: var(--oc-radius-control);
        background: transparent;
        color: var(--oc-secondary);
    }
    .close-account:hover {
        background: var(--oc-hover);
        color: var(--oc-ink);
    }
    .sidebar-scroll {
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 8px 16px 24px;
        scrollbar-width: thin;
        scrollbar-color: var(--oc-line-strong) transparent;
    }
    .profile-summary {
        display: flex;
        align-items: center;
        gap: 16px;
        margin: 0 0 24px;
        padding: 12px 8px 20px;
        border-bottom: 1px solid var(--oc-line);
        border-radius: var(--oc-radius-inset) var(--oc-radius-inset) 0 0;
    }
    .sidebar-portrait {
        width: 56px;
        height: 56px;
        flex: 0 0 56px;
    }
    .identity {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }
    .identity strong {
        font-size: 17px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .identity-detail {
        color: var(--oc-muted);
        font: 11px/1.5 var(--oc-mono);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    h3 {
        font: 400 10px/1.5 var(--oc-mono);
        color: var(--oc-muted);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin: 0 8px 10px;
    }
    .sidebar-row {
        display: flex;
        align-items: center;
        gap: 14px;
        width: 100%;
        min-height: 68px;
        padding: 12px;
        margin: 2px 0;
        border: 1px solid transparent;
        border-radius: var(--oc-radius-control);
        background: transparent;
        color: var(--oc-secondary);
        text-align: left;
        transition: background var(--oc-fast), color var(--oc-fast);
    }
    .sidebar-row > svg {
        flex-shrink: 0;
    }
    .sidebar-row > span {
        flex: 1;
        min-width: 0;
    }
    .sidebar-row strong {
        display: block;
        font-size: 14px;
        line-height: 1.5;
        font-weight: 500;
        color: var(--oc-ink);
    }
    .sidebar-row small {
        display: block;
        margin-top: 2px;
        font-size: 12px;
        line-height: 1.5;
        color: var(--oc-muted);
    }
    .row-arrow {
        color: var(--oc-muted);
        opacity: 0.65;
    }
    .sidebar-row:hover,
    .sidebar-row:focus-visible {
        background: var(--oc-surface);
        color: var(--oc-ink);
    }
    .sidebar-row:hover .row-arrow {
        opacity: 1;
    }
    .sidebar-row[aria-current="page"] {
        background: var(--oc-surface);
        border-color: var(--oc-line);
        color: var(--oc-ink);
    }
    .settings-section {
        margin-top: 28px;
    }
    .language-row .row-value {
        flex: 0 1 auto;
        color: var(--oc-muted);
    }
    .language-row > svg:last-child {
        color: var(--oc-muted);
        transition: transform var(--oc-fast);
    }
    .language-row[aria-expanded="true"] > svg:last-child {
        transform: rotate(180deg);
    }
    .language-list {
        margin: 0 0 4px 32px;
    }
    .language-option {
        min-height: 40px;
        font-size: 14px;
        border-radius: 8px;
    }
    .language-option[aria-pressed="true"] {
        color: var(--oc-ink);
    }
    .compact-row {
        min-height: 48px;
        font-size: 14px;
    }
    .sidebar-footer {
        border-top: 1px solid var(--oc-line);
        padding: 12px 16px;
    }
    .sign-out {
        margin: 0;
    }
    &[data-closing] .account-sidebar {
        animation: account-sidebar-out var(--oc-standard) var(--oc-ease) both;
    }
    &[data-closing]::backdrop {
        animation: account-shade-out var(--oc-standard) linear both;
    }
    @keyframes account-sidebar-in {
        from {
            opacity: 0;
            transform: translateX(32px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    @keyframes account-sidebar-out {
        to {
            opacity: 0;
            transform: translateX(32px);
        }
    }
    @keyframes account-shade-in {
        from {
            background: #0000;
        }
        to {
            background: #0005;
        }
    }
    @keyframes account-shade-out {
        to {
            background: #0000;
        }
    }
    @media (max-width: ${baseTokens.breakpoint.phone}px) {
        padding: 0;
        .account-sidebar {
            width: 100%;
            border: 0;
            border-radius: 0;
        }
        .sidebar-header {
            padding: calc(16px + env(safe-area-inset-top, 0px)) 16px 12px 24px;
        }
        .close-account {
            width: 44px;
            height: 44px;
        }
        .sidebar-footer {
            padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        }
    }
    @media (prefers-reduced-motion: reduce) {
        &::backdrop,
        .account-sidebar,
        &[data-closing] .account-sidebar,
        &[data-closing]::backdrop {
            animation: none;
        }
    }
`;
