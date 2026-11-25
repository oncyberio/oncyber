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
    /** NFTs the person keeps off their profile (`<contract>/<token>`). */
    hiddenNfts?: string[];
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

/** What edit mode can change, as the account's own fields. */
export interface ProfileEdit {
    username?: string;
    avatar?: string;
    avatarContractAddress?: string;
    avatarTokenId?: string;
    hiddenNfts?: string[];
}
/** The signed-in visitor, when this may be their own profile. */
export interface ProfileSelf {
    /** Their account id (a wallet address, or an account's id). */
    id: string;
    save(edit: ProfileEdit): Promise<{ success: boolean; message?: string }>;
    /** The site's rule for a username; an error sentence, or "". */
    checkUsername?(name: string): string;
}

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
    self,
    ownExtras,
}: {
    /**
     * The signed-in visitor. When the profile shown is theirs they get
     * Edit profile: the same sidebar, with its name, picture and NFTs
     * editable in place.
     */
    self?: ProfileSelf;
    /** Shown on the visitor's own profile only, e.g. their wallet. */
    ownExtras?: React.ReactNode;
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
    // Edit mode, on the visitor's own profile.
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<{
        name: string;
        picture: ProfileNft | null;
        hidden: Set<string>;
    }>({ name: "", picture: null, hidden: new Set() });
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState("");

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
        // Editing shows what is hidden too, so it can be shown again.
        if (editing) params.set("all", "1");
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
    }, [profile?.hasNfts, section, editing]);

    const own =
        !!self &&
        !!profile &&
        [profile.id, profile.wallet].some(
            (value) => !!value && value.toLowerCase() === self.id.toLowerCase()
        );
    // The lists differ in and out of edit mode (hidden NFTs): read again.
    const switchMode = (next: boolean) => {
        requested.current = {};
        setPages({ owned: EMPTY, created: EMPTY });
        setEditing(next);
        setEditError("");
    };
    const startEdit = () => {
        setDraft({
            name: profile.username || "",
            picture: null,
            hidden: new Set(profile.hiddenNfts ?? []),
        });
        switchMode(true);
    };
    const save = async () => {
        if (saving) return;
        const edit: ProfileEdit = {};
        const username = draft.name.trim();
        if (username !== (profile.username || "")) {
            const problem = !username
                ? "A username can’t be empty."
                : self.checkUsername?.(username) || "";
            if (problem) return setEditError(problem);
            edit.username = username;
        }
        if (draft.picture) {
            const [contract, token] = draft.picture.id.split("/");
            edit.avatar =
                draft.picture.imageUrls[draft.picture.imageUrls.length - 1];
            edit.avatarContractAddress = contract;
            edit.avatarTokenId = token;
        }
        const hidden = [...draft.hidden].sort();
        if (hidden.join() !== [...(profile.hiddenNfts ?? [])].sort().join())
            edit.hiddenNfts = hidden;
        if (!Object.keys(edit).length) return switchMode(false);
        setSaving(true);
        setEditError("");
        const result = await self
            .save(edit)
            .catch(() => ({ success: false, message: "" }));
        setSaving(false);
        if (!result.success)
            return setEditError(
                result.message || "Your profile wasn’t saved. Try again."
            );
        setProfile({
            ...profile,
            ...(edit.username
                ? { username: edit.username, name: edit.username }
                : {}),
            ...(edit.avatar ? { avatar: edit.avatar } : {}),
            ...(edit.hiddenNfts ? { hiddenNfts: edit.hiddenNfts } : {}),
        });
        if (edit.username) onLoaded?.(edit.username);
        switchMode(false);
    };

    const name = profile?.name || fallbackName;
    const sections = profile ? profileSections(profile) : [];
    const tabId = (value: ProfileSectionId) => `${id}-tab-${value}`;
    const panelId = `${id}-panel`;

    return (
        <>
            <div className="profile-summary">
                <ProfilePortrait
                    src={
                        (editing && draft.picture?.imageUrls[0]) ||
                        profile?.avatar ||
                        fallbackAvatar ||
                        undefined
                    }
                    className="profile-portrait"
                />
                <span className="identity">
                    {editing ? (
                        <label className="profile-field">
                            <span className="sr-only">Username</span>
                            <input
                                value={draft.name}
                                maxLength={18}
                                autoComplete="off"
                                spellCheck={false}
                                placeholder="Username"
                                aria-invalid={!!editError || undefined}
                                onChange={(event) =>
                                    setDraft({
                                        ...draft,
                                        name: event.target.value,
                                    })
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") void save();
                                }}
                            />
                        </label>
                    ) : (
                        <strong>{name}</strong>
                    )}
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
            {actions && !editing && (
                <div className="profile-actions">{actions}</div>
            )}
            {own && !editing && (
                <div className="profile-actions">
                    <button type="button" onClick={startEdit}>
                        Edit profile
                    </button>
                </div>
            )}
            {own && editing && (
                <div className="profile-edit">
                    <p>
                        {profile.hasNfts
                            ? "Change your name here. Under Collected, choose a picture or hide what you don’t want shown."
                            : "Change your name here."}
                    </p>
                    {editError && (
                        <p className="profile-error" role="alert">
                            {editError}
                        </p>
                    )}
                    <div className="profile-actions">
                        <button
                            type="button"
                            className="primary"
                            disabled={saving}
                            onClick={() => void save()}
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => switchMode(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {own && !editing && ownExtras}
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
                                edit={
                                    own && editing
                                        ? {
                                              hidden: draft.hidden,
                                              picture: draft.picture?.id,
                                              onPicture: (nft) =>
                                                  setDraft({
                                                      ...draft,
                                                      picture: nft,
                                                  }),
                                              onToggle: (nft) => {
                                                  const hidden = new Set(
                                                      draft.hidden
                                                  );
                                                  const id =
                                                      nft.id.toLowerCase();
                                                  if (!hidden.delete(id))
                                                      hidden.add(id);
                                                  setDraft({
                                                      ...draft,
                                                      hidden,
                                                  });
                                              },
                                          }
                                        : undefined
                                }
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
    edit,
    renderImage,
    onMore,
    onRetry,
}: {
    /** Edit mode: each NFT can become the picture, or be hidden or shown. */
    edit?: {
        hidden: Set<string>;
        picture?: string;
        onPicture(nft: ProfileNft): void;
        onToggle(nft: ProfileNft): void;
    };
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
                    {page.nfts.map((nft) => {
                        const hidden = edit?.hidden.has(nft.id.toLowerCase());
                        return (
                            <li key={nft.id} data-hidden={hidden || undefined}>
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
                                {edit && (
                                    <span className="nft-edit">
                                        <button
                                            type="button"
                                            aria-pressed={
                                                edit.picture === nft.id
                                            }
                                            disabled={!nft.imageUrls.length}
                                            onClick={() => edit.onPicture(nft)}
                                        >
                                            {edit.picture === nft.id
                                                ? "Your picture"
                                                : "Use as picture"}
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={!!hidden}
                                            onClick={() => edit.onToggle(nft)}
                                        >
                                            {hidden ? "Show" : "Hide"}
                                        </button>
                                    </span>
                                )}
                            </li>
                        );
                    })}
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
