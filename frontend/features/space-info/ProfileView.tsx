import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import EmptyState from "@ui/components/EmptyState";
import ProfilePortrait from "@ui/components/ProfilePortrait";
import {
    nextSection,
    openingSection,
    ProfileSectionId,
    profileSections,
    visitsLabel,
} from "./profileSections";
import type { ProfileNft } from "./spaceInfo";

type SpaceCard = {
    id: string;
    title: string;
    href: string;
    imageUrls: string[];
    visits?: number;
};

export interface ProfileInfo {
    id: string;
    name: string;
    username: string;
    wallet: string;
    avatar: string;
    href: string;
    hasNfts: boolean;
    spaces: SpaceCard[];
    featured: SpaceCard[];
}

type NftKind = "owned" | "created";
type NftPage = {
    nfts: ProfileNft[];
    next: string;
    loading: boolean;
    failed: boolean;
};
const EMPTY: NftPage = { nfts: [], next: "", loading: false, failed: false };

const isNftSection = (section: ProfileSectionId): section is NftKind =>
    section === "owned" || section === "created";

/**
 * A person in the info sidebar: who they are, once, then one section at a
 * time behind a switch (their spaces, spaces showing their work, what they
 * collected and created).
 */
export default function ProfileView({
    profileId,
    fallbackName,
    fallbackAvatar,
    renderImage,
    onLoaded,
    actions,
}: {
    profileId: string;
    fallbackName: string;
    fallbackAvatar?: string;
    /** Shown under the name, e.g. Teleport when they're in the same world. */
    actions?: React.ReactNode;
    renderImage(urls: string[], className?: string): React.ReactNode;
    onLoaded?(name: string): void;
}) {
    const id = useId();
    const [profile, setProfile] = useState<ProfileInfo | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [section, setSection] = useState<ProfileSectionId>("spaces");
    const [pages, setPages] = useState<Record<NftKind, NftPage>>({
        owned: EMPTY,
        created: EMPTY,
    });
    const requested = useRef<Record<string, boolean>>({});

    useEffect(() => {
        const controller = new AbortController();
        setFailed(false);
        fetch(`/api/profile-info?id=${encodeURIComponent(profileId)}`, {
            signal: controller.signal,
        })
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status));
                return response.json();
            })
            .then((result: ProfileInfo) => {
                setProfile(result);
                setSection(openingSection(profileSections(result)));
                onLoaded?.(result.name);
            })
            .catch(() => !controller.signal.aborted && setFailed(true));
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileId, attempt]);

    const loadNfts = (kind: NftKind, more = false) => {
        const key = `${kind}:${more ? pages[kind].next : ""}`;
        if (requested.current[key]) return;
        requested.current[key] = true;
        setPages((value) => ({
            ...value,
            [kind]: { ...value[kind], loading: true, failed: false },
        }));
        const params = new URLSearchParams({ id: profileId, nfts: kind });
        if (more && pages[kind].next) params.set("next", pages[kind].next);
        fetch(`/api/profile-info?${params}`)
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status));
                return response.json();
            })
            .then((result) =>
                setPages((value) => ({
                    ...value,
                    [kind]: {
                        nfts: [
                            ...(more ? value[kind].nfts : []),
                            ...(result.nfts || []),
                        ],
                        next: result.next || "",
                        loading: false,
                        failed: false,
                    },
                }))
            )
            .catch(() => {
                requested.current[key] = false;
                setPages((value) => ({
                    ...value,
                    [kind]: { ...value[kind], loading: false, failed: true },
                }));
            });
    };

    useEffect(() => {
        if (profile?.hasNfts && isNftSection(section)) loadNfts(section);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.hasNfts, section]);

    const name = profile?.name || fallbackName;
    const sections = profile ? profileSections(profile) : [];
    const tabId = (value: ProfileSectionId) => `${id}-tab-${value}`;
    const panelId = `${id}-panel`;

    return (
        <>
            <div className="profile-summary">
                <ProfilePortrait
                    src={profile?.avatar || fallbackAvatar || undefined}
                    className="profile-portrait"
                />
                <span className="identity">
                    <strong>{name}</strong>
                    {profile?.wallet && profile.username && (
                        <span
                            className="identity-detail"
                            title={profile.wallet}
                        >
                            {profile.wallet.slice(0, 6)}…
                            {profile.wallet.slice(-4)}
                        </span>
                    )}
                </span>
            </div>
            {actions && <div className="profile-actions">{actions}</div>}
            {failed && (
                <EmptyState
                    role="alert"
                    icon="activity"
                    title="This profile is unavailable right now."
                    action={{
                        label: "Try again",
                        onClick: () => setAttempt((value) => value + 1),
                    }}
                />
            )}
            {!profile && !failed && (
                <div className="profile-loading" role="status">
                    <span className="sr-only">Loading profile…</span>
                    <CardSkeleton count={4} />
                </div>
            )}
            {profile && !failed && (
                <>
                    {/* One switch for every section, in the landing's
                        section-switch voice. A profile with a single
                        section shows it as a heading. */}
                    <div
                        className="profile-switch"
                        role="tablist"
                        aria-label={`${name}: sections`}
                        onKeyDown={(event) => {
                            const to = nextSection(
                                sections,
                                section,
                                event.key
                            );
                            if (!to) return;
                            event.preventDefault();
                            setSection(to);
                            document.getElementById(tabId(to))?.focus();
                        }}
                    >
                        {sections.map((item) => (
                            <button
                                key={item.id}
                                id={tabId(item.id)}
                                type="button"
                                role="tab"
                                aria-selected={section === item.id}
                                aria-controls={panelId}
                                tabIndex={section === item.id ? 0 : -1}
                                onClick={() => setSection(item.id)}
                            >
                                {item.label}
                                {item.count > 0 && (
                                    <span className="count">{item.count}</span>
                                )}
                            </button>
                        ))}
                    </div>
                    <div
                        id={panelId}
                        className="profile-panel"
                        role="tabpanel"
                        aria-labelledby={tabId(section)}
                        key={section}
                    >
                        {section === "spaces" && (
                            <SpaceGrid
                                cards={profile.spaces}
                                empty="No public spaces yet."
                                renderImage={renderImage}
                            />
                        )}
                        {section === "featured" && (
                            <SpaceGrid
                                cards={profile.featured}
                                empty="No spaces show their work yet."
                                renderImage={renderImage}
                            />
                        )}
                        {isNftSection(section) && (
                            <NftGrid
                                kind={section}
                                page={pages[section]}
                                renderImage={renderImage}
                                onMore={() => loadNfts(section, true)}
                                onRetry={() => loadNfts(section)}
                            />
                        )}
                    </div>
                </>
            )}
        </>
    );
}

function SpaceGrid({
    cards,
    empty,
    renderImage,
}: {
    cards: SpaceCard[];
    empty: string;
    renderImage(urls: string[], className?: string): React.ReactNode;
}) {
    if (!cards.length) return <EmptyState icon="globe" title={empty} />;
    return (
        <ul className="space-cards">
            {cards.map((card) => {
                const visits = visitsLabel(card.visits);
                return (
                    <li key={card.id}>
                        <Link href={card.href}>
                            <span className="space-cover">
                                {renderImage(card.imageUrls)}
                            </span>
                            <strong title={card.title}>{card.title}</strong>
                            {visits && <small className="mono">{visits}</small>}
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}

function NftGrid({
    kind,
    page,
    renderImage,
    onMore,
    onRetry,
}: {
    kind: NftKind;
    page: NftPage;
    renderImage(urls: string[], className?: string): React.ReactNode;
    onMore(): void;
    onRetry(): void;
}) {
    const nothing = !page.loading && !page.failed && !page.nfts.length;
    return (
        <>
            {page.nfts.length > 0 && (
                <ul className="artworks">
                    {page.nfts.map((nft) => (
                        <li key={nft.id}>
                            <a
                                href={nft.href || undefined}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <span className="thumb">
                                    {renderImage(nft.imageUrls)}
                                </span>
                                <strong title={nft.title}>{nft.title}</strong>
                                {nft.collection && (
                                    <small>{nft.collection}</small>
                                )}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
            {page.loading && (
                <div className="profile-loading" role="status">
                    <span className="sr-only">Loading NFTs…</span>
                    {!page.nfts.length && <CardSkeleton count={4} square />}
                </div>
            )}
            {page.failed && (
                <EmptyState
                    role="alert"
                    icon="activity"
                    title="NFTs are unavailable right now."
                    action={{ label: "Try again", onClick: onRetry }}
                />
            )}
            {nothing && (
                <EmptyState
                    icon="tag"
                    title={
                        kind === "owned"
                            ? "No NFTs in this wallet."
                            : page.next
                            ? "Nothing created in their recent mints."
                            : "No created NFTs found."
                    }
                    action={
                        page.next
                            ? { label: "Search older mints", onClick: onMore }
                            : undefined
                    }
                />
            )}
            {!page.loading && !nothing && page.next && (
                <button type="button" className="load-more" onClick={onMore}>
                    Load more
                </button>
            )}
        </>
    );
}

/** Quiet placeholders in the shape of the cards that are coming. */
function CardSkeleton({ count, square }: { count: number; square?: boolean }) {
    return (
        <ul className="card-skeleton" aria-hidden="true" data-square={square}>
            {Array.from({ length: count }, (_, index) => (
                <li key={index}>
                    <span />
                    <i />
                </li>
            ))}
        </ul>
    );
}
