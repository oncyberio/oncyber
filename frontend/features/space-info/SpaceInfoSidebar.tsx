import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import Link from "next/link";
import ProfilePortrait from "@ui/components/ProfilePortrait";
import { brandFoundation } from "@styles/brand";
import { baseTokens } from "@styles/tokens";
import Icon from "@features/landing-carousel/components/Icon";
import { STAFF_PICKS_DEFAULT_MIN } from "@features/landing-carousel/data";
import dynamic from "next/dynamic";
import type { SpaceInfo } from "./spaceInfo";
import SpaceActions from "./SpaceActions";
import ProfileView from "./ProfileView";

type View =
    | { kind: "guestbook" }
    | { kind: "profile"; id: string; name: string; avatar?: string };

const Guestbook = dynamic(
    () => import("@components/_3DExhibit-v2/ui/Menu/shared/Guestbook/Content"),
    { ssr: false }
);

type Props = {
    id: string;
    /** Fetches /api/space-info for this space. */
    spaceId?: string;
    /** Shown immediately (the lobby, or a space before its info loads). */
    fallback: Partial<SpaceInfo> & { title: string };
    /** Extra line under the deployer, e.g. "12 here". */
    presence?: string;
    /** Open straight onto a profile (wallet or username). */
    initialProfile?: { id: string; name: string; avatar?: string };
    onClose(): void;
};

const Star = ({ filled }: { filled: boolean }) => (
    <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
    >
        <path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" />
    </svg>
);

/** Space facts from the top-left title: who deployed it, the artists and artworks. */
export default function SpaceInfoSidebar({
    id,
    spaceId,
    fallback,
    presence,
    initialProfile,
    onClose,
}: Props) {
    const dialog = useRef<HTMLDialogElement>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout>>();
    const [closing, setClosing] = useState(false);
    const [info, setInfo] = useState<Partial<SpaceInfo>>(fallback);
    const [loading, setLoading] = useState(!!spaceId);
    const [failed, setFailed] = useState(false);
    const [saving, setSaving] = useState(false);
    const [curateError, setCurateError] = useState("");
    // Views stack on top of the space info: the guestbook, or a profile.
    const [stack, setStack] = useState<View[]>(
        initialProfile ? [{ kind: "profile", ...initialProfile }] : []
    );
    const view = stack[stack.length - 1];
    const guestbook = view?.kind === "guestbook";
    const openView = (next: View) => setStack((value) => [...value, next]);
    const back = () => setStack((value) => value.slice(0, -1));
    const openProfile = (person: {
        address?: string;
        href?: string;
        name: string;
        avatar?: string;
    }) => {
        const handle =
            person.address ||
            decodeURIComponent((person.href || "").replace(/^\//, ""));
        if (handle)
            openView({
                kind: "profile",
                id: handle,
                name: person.name,
                avatar: person.avatar,
            });
    };

    useEffect(() => {
        if (!spaceId) return;
        const controller = new AbortController();
        fetch(`/api/space-info?id=${encodeURIComponent(spaceId)}`, {
            credentials: "same-origin",
            signal: controller.signal,
        })
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status));
                return response.json();
            })
            .then((result: SpaceInfo) => setInfo({ ...fallback, ...result }))
            .catch(() => !controller.signal.aborted && setFailed(true))
            .finally(() => !controller.signal.aborted && setLoading(false));
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spaceId]);

    useEffect(() => {
        const element = dialog.current;
        const previous = document.activeElement as HTMLElement;
        document.exitPointerLock?.();
        element.showModal();
        element.querySelector<HTMLElement>(".close-info")?.focus();
        return () => {
            clearTimeout(closeTimer.current);
            element.close();
            if (previous?.isConnected) previous.focus({ preventScroll: true });
        };
    }, []);

    const dismiss = () => {
        if (closing) return;
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
            return onClose();
        setClosing(true);
        closeTimer.current = setTimeout(onClose, baseTokens.motion.standard);
    };

    const toggleStaffPick = async () => {
        if (!spaceId || saving) return;
        setSaving(true);
        setCurateError("");
        try {
            const response = await fetch("/api/staff-picks", {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ id: spaceId, picked: !info.staffPick }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result) throw new Error();
            setInfo((value) => ({
                ...value,
                staffPick: result.staffPick,
                staffPickCount: result.count,
            }));
        } catch {
            setCurateError("Couldn’t update staff picks. Try again.");
        } finally {
            setSaving(false);
        }
    };

    const deployer = info.deployer;
    const artists = info.artists || [];
    const artworks = info.artworks || [];
    const count = info.staffPickCount ?? 0;
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
                // Keys in the sidebar must not move the avatar.
                event.stopPropagation();
                if (event.key === "Escape" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    dismiss();
                }
            }}
        >
            <aside className="info-sidebar">
                <header className="info-header">
                    {view && (stack.length > 1 || !initialProfile) && (
                        <button
                            type="button"
                            className="close-info"
                            aria-label="Back"
                            onClick={back}
                        >
                            <Icon name="back" size={18} />
                        </button>
                    )}
                    <h2 id={`${id}-title`}>
                        {view?.kind === "profile"
                            ? view.name
                            : guestbook
                            ? "Guestbook"
                            : info.title}
                    </h2>
                    <button
                        className="close-info"
                        aria-label="Close space info"
                        onClick={dismiss}
                        type="button"
                    >
                        <Icon name="close" size={20} />
                    </button>
                </header>
                {view?.kind === "profile" ? (
                    <div className="info-scroll" key={view.id}>
                        <ProfileView
                            profileId={view.id}
                            fallbackName={view.name}
                            fallbackAvatar={view.avatar}
                            renderImage={(urls, className) => (
                                <FallbackImage
                                    urls={urls}
                                    className={className}
                                    lazy
                                />
                            )}
                        />
                    </div>
                ) : guestbook && spaceId ? (
                    <div className="info-guestbook">
                        <Guestbook
                            isShowing
                            isMobile={false}
                            toggle={back}
                            owner={{ username: deployer?.name }}
                            exhibit={{
                                id: spaceId,
                                owner: deployer?.address,
                                info: { room: info.room },
                            }}
                        />
                    </div>
                ) : (
                    <div className="info-scroll">
                        {(info.coverUrls?.length || info.coverUrl) && (
                            <FallbackImage
                                className="info-cover"
                                urls={info.coverUrls || [info.coverUrl]}
                            />
                        )}
                        {info.description && (
                            <p className="info-description">
                                {info.description}
                            </p>
                        )}
                        {(deployer?.name || presence) && (
                            <section className="info-section">
                                <h3>Deployed by</h3>
                                <Person
                                    name={deployer?.name || "oncyber"}
                                    avatar={deployer?.avatar}
                                    href={deployer?.href}
                                    detail={presence}
                                    onOpen={
                                        deployer?.address || deployer?.href
                                            ? () => openProfile(deployer)
                                            : undefined
                                    }
                                />
                            </section>
                        )}
                        {info.location && (
                            <section className="info-section">
                                <h3>Location</h3>
                                <Link
                                    className="info-link"
                                    href={info.location.href}
                                >
                                    {info.location.name}
                                    <Icon name="forward" size={14} />
                                </Link>
                            </section>
                        )}
                        {!!info.collaborators?.length && (
                            <section className="info-section">
                                <h3>
                                    Collaborators · {info.collaborators.length}
                                </h3>
                                <ul className="people">
                                    {info.collaborators.map((person) => (
                                        <li key={person.address}>
                                            <Person
                                                name={person.name}
                                                avatar={person.avatar}
                                                href={person.href}
                                                onOpen={() =>
                                                    openProfile(person)
                                                }
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {spaceId && !loading && (
                            <SpaceActions
                                spaceId={spaceId}
                                title={info.title}
                                onGuestbook={() =>
                                    openView({ kind: "guestbook" })
                                }
                            />
                        )}
                        {spaceId && info.canCurate && (
                            <section className="info-section curate">
                                <h3>Staff picks</h3>
                                <button
                                    type="button"
                                    className="staff-pick"
                                    aria-pressed={!!info.staffPick}
                                    disabled={saving}
                                    onClick={toggleStaffPick}
                                >
                                    <Star filled={!!info.staffPick} />
                                    <span>
                                        <strong>
                                            {info.staffPick
                                                ? "Remove from staff picks"
                                                : "Add to staff picks"}
                                        </strong>
                                        <small>
                                            {count} picked
                                            {count < STAFF_PICKS_DEFAULT_MIN
                                                ? ` · default feed at ${STAFF_PICKS_DEFAULT_MIN}`
                                                : " · default feed"}
                                        </small>
                                    </span>
                                </button>
                                {curateError && (
                                    <p className="info-error" role="alert">
                                        {curateError}
                                    </p>
                                )}
                            </section>
                        )}
                        {info.staffPick && !info.canCurate && (
                            <p className="staff-badge">
                                <Star filled /> Staff pick
                            </p>
                        )}
                        {artists.length > 0 && (
                            <section className="info-section">
                                <h3>Featured artists · {artists.length}</h3>
                                <ul className="people">
                                    {artists.map((artist) => (
                                        <li key={artist.address || artist.name}>
                                            <Person
                                                name={artist.name}
                                                avatar={artist.avatar}
                                                href={artist.href}
                                                onOpen={() =>
                                                    openProfile(artist)
                                                }
                                                detail={`${artist.count} ${
                                                    artist.count === 1
                                                        ? "work"
                                                        : "works"
                                                }`}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {artworks.length > 0 && (
                            <section className="info-section">
                                <h3>
                                    Artworks ·{" "}
                                    {info.totalArtworks || artworks.length}
                                </h3>
                                <ul className="artworks">
                                    {artworks.map((artwork) => (
                                        <li key={artwork.id}>
                                            <span className="thumb">
                                                <FallbackImage
                                                    urls={
                                                        artwork.imageUrls || [
                                                            artwork.imageUrl,
                                                        ]
                                                    }
                                                    lazy
                                                />
                                            </span>
                                            <strong title={artwork.title}>
                                                {artwork.title}
                                            </strong>
                                            {(artwork.artist ||
                                                artwork.collection) && (
                                                <small>
                                                    {artwork.artist ||
                                                        artwork.collection}
                                                </small>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {loading && (
                            <p className="info-status" role="status">
                                Loading space info…
                            </p>
                        )}
                        {failed && (
                            <p className="info-status" role="alert">
                                Space info is unavailable right now.
                            </p>
                        )}
                        {spaceId && !loading && !failed && !artworks.length && (
                            <p className="info-status">
                                No artworks in this space yet.
                            </p>
                        )}
                    </div>
                )}
            </aside>
        </Surface>,
        document.body
    );
}

/** Tries each URL in turn and hides itself when none load. */
function FallbackImage({
    urls,
    className,
    lazy = false,
}: {
    urls: string[];
    className?: string;
    lazy?: boolean;
}) {
    const list = urls.filter(Boolean);
    const [index, setIndex] = useState(0);
    if (index >= list.length) return null;
    return (
        <img
            key={list[index]}
            className={className}
            src={list[index]}
            alt=""
            loading={lazy ? "lazy" : undefined}
            draggable={false}
            onError={() => setIndex((value) => value + 1)}
        />
    );
}

function Person({
    name,
    avatar,
    href,
    detail,
    onOpen,
}: {
    name: string;
    avatar?: string;
    href?: string;
    detail?: string;
    /** Opens the profile inside the sidebar instead of leaving the space. */
    onOpen?(): void;
}) {
    const body = (
        <>
            <ProfilePortrait src={avatar || undefined} className="portrait" />
            <span>
                <strong>{name}</strong>
                {detail && <small>{detail}</small>}
            </span>
        </>
    );
    if (onOpen)
        return (
            <button type="button" className="person" onClick={onOpen}>
                {body}
            </button>
        );
    return href ? (
        <Link className="person" href={href}>
            {body}
        </Link>
    ) : (
        <span className="person">{body}</span>
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
    &[open] {
        display: flex;
        justify-content: flex-start;
    }
    &::backdrop {
        background: #0005;
        animation: info-shade-in var(--oc-enter) var(--oc-ease) both;
    }
    &,
    * {
        box-sizing: border-box;
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
    .info-sidebar {
        width: 380px;
        max-width: 100%;
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        border: 1px solid var(--oc-line-strong);
        border-radius: ${baseTokens.radius.panel}px;
        background: var(--oc-panel);
        box-shadow: 8px 12px 40px #0003;
        overflow: hidden;
        animation: info-sidebar-in var(--oc-enter) var(--oc-ease) both;
    }
    .info-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 20px 20px 12px 24px;
    }
    h2 {
        flex: 1;
        margin: 0;
        min-width: 0;
        font-size: 18px;
        font-weight: 500;
        line-height: 1.4;
        overflow-wrap: anywhere;
    }
    .close-info {
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
    .close-info:hover {
        background: var(--oc-hover);
        color: var(--oc-ink);
    }
    .info-scroll {
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 4px 24px 24px;
        scrollbar-width: thin;
        scrollbar-color: var(--oc-line-strong) transparent;
    }
    .info-cover {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        border-radius: var(--oc-radius-inset);
        background: var(--oc-surface);
    }
    .info-description {
        margin: 16px 0 0;
        font-size: 13px;
        line-height: 1.6;
        color: var(--oc-secondary);
        white-space: pre-line;
        overflow-wrap: anywhere;
    }
    .info-section {
        margin-top: 24px;
    }
    h3 {
        font: 400 10px/1.5 var(--oc-mono);
        color: var(--oc-muted);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin: 0 0 10px;
    }
    .people,
    .artworks {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .people {
        display: grid;
        gap: 4px;
    }
    .person {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        padding: 6px;
        margin: 0 -6px;
        border-radius: var(--oc-radius-control);
    }
    button.person {
        width: calc(100% + 12px);
        border: 0;
        background: transparent;
        color: inherit;
        text-align: left;
    }
    a.person:hover,
    button.person:hover {
        background: var(--oc-surface);
    }
    .profile-head {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 4px 0 8px;
    }
    .profile-head .profile-portrait {
        width: 64px;
        height: 64px;
        flex: 0 0 64px;
    }
    .profile-head > span {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .profile-head strong {
        font-size: 17px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .profile-head .mono {
        font: 11px/1.5 var(--oc-mono);
        color: var(--oc-muted);
    }
    .info-link.small {
        font-size: 12px;
        color: var(--oc-secondary);
    }
    .space-cards {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px 12px;
    }
    .space-cards a,
    .artworks a {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .space-cover {
        display: block;
        aspect-ratio: 16 / 10;
        margin-bottom: 6px;
        border-radius: var(--oc-radius-inset);
        background: var(--oc-surface);
        overflow: hidden;
    }
    .space-cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }
    .space-cards strong {
        font-size: 13px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .nft-tabs {
        display: inline-flex;
        gap: 2px;
        padding: 3px;
        margin-bottom: 14px;
        border: 1px solid var(--oc-line);
        border-radius: 999px;
    }
    .nft-tabs button {
        height: 30px;
        padding: 0 16px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: var(--oc-secondary);
        font-size: 13px;
    }
    .nft-tabs button[aria-selected="true"] {
        background: var(--oc-ink);
        color: var(--oc-panel);
    }
    .load-more {
        margin-top: 16px;
        width: 100%;
        height: 38px;
        border: 1px solid var(--oc-line);
        border-radius: 999px;
        background: transparent;
        color: var(--oc-ink);
        font-size: 13px;
    }
    .load-more:hover {
        background: var(--oc-surface);
    }
    .person .portrait {
        width: 36px;
        height: 36px;
        flex: 0 0 36px;
    }
    .person > span,
    .staff-pick > span {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .person strong,
    .staff-pick strong {
        font-size: 14px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .person small,
    .staff-pick small {
        font-size: 12px;
        color: var(--oc-muted);
    }
    .staff-pick {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 12px;
        border: 1px solid var(--oc-line);
        border-radius: var(--oc-radius-control);
        background: transparent;
        color: var(--oc-ink);
        text-align: left;
    }
    .staff-pick:hover:not(:disabled) {
        background: var(--oc-surface);
    }
    .staff-pick[aria-pressed="true"] svg,
    .staff-badge svg {
        color: var(--oc-accent-create, #ffd23f);
    }
    .staff-pick:disabled {
        opacity: 0.6;
        cursor: progress;
    }
    .staff-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 16px 0 0;
        font-size: 12px;
        color: var(--oc-secondary);
    }
    .artworks {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px 12px;
    }
    .artworks li {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .thumb {
        display: block;
        aspect-ratio: 1;
        margin-bottom: 6px;
        border-radius: var(--oc-radius-inset);
        background: var(--oc-surface);
        overflow: hidden;
    }
    .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }
    .artworks strong {
        font-size: 13px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .artworks small {
        font-size: 12px;
        color: var(--oc-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .info-guestbook {
        min-height: 0;
        min-width: 0;
        display: flex;
        flex-direction: column;
        padding: 0 24px 20px;
        overflow: hidden;
        overflow-wrap: anywhere;
    }
    .info-guestbook textarea,
    .info-guestbook div {
        max-width: 100%;
        min-width: 0;
    }
    .info-guestbook > * {
        flex: 1;
        min-height: 0;
        margin-top: 0;
    }
    .info-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        color: var(--oc-ink);
    }
    .info-link:hover {
        text-decoration: underline;
    }
    .space-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .space-actions button {
        height: 36px;
        padding: 0 14px;
        border: 1px solid var(--oc-line);
        border-radius: 999px;
        background: transparent;
        color: var(--oc-ink);
        font-size: 13px;
    }
    .space-actions button:hover {
        background: var(--oc-surface);
    }
    .space-actions button[aria-pressed="true"] {
        background: var(--oc-ink);
        color: var(--oc-panel);
    }
    .action-notice {
        min-height: 18px;
        margin: 8px 0 0;
        font-size: 12px;
        color: var(--oc-muted);
    }
    .info-status,
    .info-error {
        margin: 24px 0 0;
        font-size: 13px;
        color: var(--oc-muted);
    }
    .info-error {
        margin-top: 8px;
        color: var(--oc-danger, #ff6b6b);
    }
    &[data-closing] .info-sidebar {
        animation: info-sidebar-out var(--oc-standard) var(--oc-ease) both;
    }
    &[data-closing]::backdrop {
        animation: info-shade-out var(--oc-standard) linear both;
    }
    @keyframes info-sidebar-in {
        from {
            opacity: 0;
            transform: translateX(-32px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    @keyframes info-sidebar-out {
        to {
            opacity: 0;
            transform: translateX(-32px);
        }
    }
    @keyframes info-shade-in {
        from {
            background: #0000;
        }
        to {
            background: #0005;
        }
    }
    @keyframes info-shade-out {
        to {
            background: #0000;
        }
    }
    @media (max-width: ${baseTokens.breakpoint.phone}px) {
        padding: 0;
        .info-sidebar {
            width: 100%;
            border: 0;
            border-radius: 0;
        }
        .info-header {
            padding: calc(16px + env(safe-area-inset-top, 0px)) 16px 12px 20px;
        }
        .info-scroll {
            padding: 4px 20px calc(24px + env(safe-area-inset-bottom, 0px));
        }
        .close-info {
            width: 44px;
            height: 44px;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        &::backdrop,
        .info-sidebar,
        &[data-closing] .info-sidebar,
        &[data-closing]::backdrop {
            animation: none;
        }
    }
`;
