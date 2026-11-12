import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ProfilePortrait from "@ui/components/ProfilePortrait";
import Icon from "@features/landing-carousel/components/Icon";
type SpaceCard = {
    id: string;
    title: string;
    href: string;
    imageUrls: string[];
};
import type { ProfileNft } from "./spaceInfo";

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

type NftTab = "owned" | "created";
type NftPage = {
    nfts: ProfileNft[];
    next: string;
    loading: boolean;
    failed: boolean;
};
const EMPTY: NftPage = { nfts: [], next: "", loading: false, failed: false };

/** A profile in the info sidebar: spaces they deployed, spaces featuring their work, their NFTs. */
export default function ProfileView({
    profileId,
    fallbackName,
    fallbackAvatar,
    renderImage,
    onLoaded,
}: {
    profileId: string;
    fallbackName: string;
    fallbackAvatar?: string;
    renderImage(urls: string[], className?: string): React.ReactNode;
    onLoaded?(name: string): void;
}) {
    const [profile, setProfile] = useState<ProfileInfo | null>(null);
    const [failed, setFailed] = useState(false);
    const [tab, setTab] = useState<NftTab>("owned");
    const [pages, setPages] = useState<Record<NftTab, NftPage>>({
        owned: EMPTY,
        created: EMPTY,
    });
    const requested = useRef<Record<string, boolean>>({});

    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/profile-info?id=${encodeURIComponent(profileId)}`, {
            signal: controller.signal,
        })
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status));
                return response.json();
            })
            .then((result: ProfileInfo) => {
                setProfile(result);
                onLoaded?.(result.name);
            })
            .catch(() => !controller.signal.aborted && setFailed(true));
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileId]);

    const loadNfts = (kind: NftTab, more = false) => {
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
        if (profile?.hasNfts) loadNfts(tab);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.hasNfts, tab]);

    const name = profile?.name || fallbackName;
    const page = pages[tab];
    return (
        <>
            <div className="profile-head">
                <ProfilePortrait
                    src={profile?.avatar || fallbackAvatar || undefined}
                    className="profile-portrait"
                />
                <span>
                    <strong>{name}</strong>
                    {profile?.wallet && profile.username && (
                        <small className="mono">
                            {profile.wallet.slice(0, 6)}…
                            {profile.wallet.slice(-4)}
                        </small>
                    )}
                    {profile?.href && (
                        <Link className="info-link small" href={profile.href}>
                            Full profile <Icon name="forward" size={12} />
                        </Link>
                    )}
                </span>
            </div>
            {failed && (
                <p className="info-status" role="alert">
                    This profile is unavailable right now.
                </p>
            )}
            {!profile && !failed && (
                <p className="info-status" role="status">
                    Loading profile…
                </p>
            )}
            {profile && (
                <>
                    <SpaceList
                        title="Spaces deployed"
                        cards={profile.spaces}
                        empty="No public spaces yet."
                        renderImage={renderImage}
                    />
                    {profile.featured.length > 0 && (
                        <SpaceList
                            title="Featured in"
                            cards={profile.featured}
                            renderImage={renderImage}
                        />
                    )}
                    {profile.hasNfts && (
                        <section className="info-section">
                            <div
                                className="nft-tabs"
                                role="tablist"
                                aria-label="NFTs"
                            >
                                {(["owned", "created"] as NftTab[]).map(
                                    (kind) => (
                                        <button
                                            key={kind}
                                            type="button"
                                            role="tab"
                                            aria-selected={tab === kind}
                                            onClick={() => setTab(kind)}
                                        >
                                            {kind === "owned"
                                                ? "Owned"
                                                : "Created"}
                                        </button>
                                    )
                                )}
                            </div>
                            <ul className="artworks" role="tabpanel">
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
                                            <strong title={nft.title}>
                                                {nft.title}
                                            </strong>
                                            {nft.collection && (
                                                <small>{nft.collection}</small>
                                            )}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                            {page.loading && (
                                <p className="info-status" role="status">
                                    Loading NFTs…
                                </p>
                            )}
                            {page.failed && (
                                <p className="info-status" role="alert">
                                    NFTs are unavailable right now.
                                </p>
                            )}
                            {!page.loading &&
                                !page.failed &&
                                !page.nfts.length && (
                                    <p className="info-status">
                                        {tab === "owned"
                                            ? "No NFTs found for this wallet."
                                            : page.next
                                            ? "Nothing created in their recent mints."
                                            : "No created NFTs found."}
                                    </p>
                                )}
                            {!page.loading && page.next && (
                                <button
                                    type="button"
                                    className="load-more"
                                    onClick={() => loadNfts(tab, true)}
                                >
                                    {tab === "created" && !page.nfts.length
                                        ? "Search older mints"
                                        : "Load more"}
                                </button>
                            )}
                        </section>
                    )}
                </>
            )}
        </>
    );
}

function SpaceList({
    title,
    cards,
    empty,
    renderImage,
}: {
    title: string;
    cards: SpaceCard[];
    empty?: string;
    renderImage(urls: string[], className?: string): React.ReactNode;
}) {
    return (
        <section className="info-section">
            <h3>
                {title} · {cards.length}
            </h3>
            {cards.length ? (
                <ul className="space-cards">
                    {cards.map((card) => (
                        <li key={card.id}>
                            <Link href={card.href}>
                                <span className="space-cover">
                                    {renderImage(card.imageUrls)}
                                </span>
                                <strong title={card.title}>{card.title}</strong>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="info-status">{empty}</p>
            )}
        </section>
    );
}
