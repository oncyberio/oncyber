import React, { useContext, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import styled from "styled-components";
import { UserContext } from "@components/context/UserContext";
const ConnectWallet = dynamic(() => import("@ui/components/ConnectWallet"), {
    ssr: false,
});
async function request(url: string, options: RequestInit = {}) {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
        throw new Error(
            response.status === 401
                ? "Sign in to manage who you follow."
                : "Could not update following. Please try again."
        );
    return body;
}
const write = (body, method = "POST") => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
});
export function FollowButton({ accountId }: { accountId: string }) {
    const { user, authenticated, isAnonymous } = useContext(UserContext);
    const signedIn = authenticated && !isAnonymous && !!user?.id;
    const [following, setFollowing] = useState<boolean>(null);
    const [target, setTarget] = useState(accountId);
    const [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    const [connect, setConnect] = useState(false);
    useEffect(() => {
        if (!signedIn || !accountId || accountId === user.id) return;
        const abort = new AbortController();
        setTarget(accountId);
        setFollowing(null);
        setError("");
        request(`/api/social/follows?accountId=${encodeURIComponent(accountId)}`, {
            signal: abort.signal,
        })
            .then((result) => {
                setTarget(result.accountId);
                setFollowing(result.following);
            })
            .catch((failure) => {
                if (!abort.signal.aborted) setError(failure.message);
            });
        return () => abort.abort();
    }, [signedIn, accountId, user?.id]);
    if (!accountId || target === user?.id || accountId === user?.id)
        return null;
    return (
        <FollowControls>
            <button
                type="button"
                aria-pressed={following === true}
                disabled={busy || (signedIn && following === null && !error)}
                onClick={async () => {
                    if (!signedIn) {
                        setConnect(true);
                        return;
                    }
                    setBusy(true);
                    setError("");
                    try {
                        if (following === null) {
                            const result = await request(
                                `/api/social/follows?accountId=${encodeURIComponent(
                                    accountId
                                )}`
                            );
                            setTarget(result.accountId);
                            setFollowing(result.following);
                        } else {
                            const result = await request(
                                "/api/social/follows",
                                write({
                                    accountId: target,
                                    following: !following,
                                })
                            );
                            setFollowing(result.following);
                        }
                    } catch (failure) {
                        setError(failure.message);
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                {!signedIn
                    ? "Sign in to follow"
                    : busy
                    ? "Saving…"
                    : following === null
                    ? error
                        ? "Retry"
                        : "Loading…"
                    : following
                    ? "Following"
                    : "Follow"}
            </button>
            {error && <span role="alert">{error}</span>}
            {connect && (
                <ConnectWallet
                    open
                    toggle={setConnect}
                    skipRedirectToAccount
                    callbackAfterAuth={() => setConnect(false)}
                />
            )}
        </FollowControls>
    );
}
interface FollowedProfile {
    accountId: string;
    name: string;
    avatar?: string;
    profileUrl?: string;
    presence?: { experienceId: string };
}
export function FollowingList() {
    const { user, authenticated, isAnonymous } = useContext(UserContext);
    const [rows, setRows] = useState<FollowedProfile[]>([]),
        [error, setError] = useState("");
    const [loaded, setLoaded] = useState(false),
        [visible, setVisible] = useState(20);
    const [visibility, setVisibility] = useState<"public" | "hidden">(null),
        [busy, setBusy] = useState("");
    useEffect(() => {
        if (!authenticated || isAnonymous || !user?.id) return;
        setRows([]);
        setLoaded(false);
        setVisibility(null);
        let stopped = false,
            timer;
        const abort = new AbortController();
        async function load() {
            try {
                const [list, preferences] = await Promise.all([
                    request("/api/social/follows", { signal: abort.signal }),
                    request("/api/social/presence-preferences", {
                        signal: abort.signal,
                    }),
                ]);
                if (!stopped) {
                    setRows(list.following);
                    setVisibility(preferences.visibility);
                    setLoaded(true);
                    setError("");
                }
            } catch (failure) {
                if (!stopped) {
                    setError(failure.message);
                    setLoaded(true);
                }
            }
            if (!stopped)
                timer = setTimeout(() => {
                    if (!document.hidden) load();
                    else timer = setTimeout(load, 15000);
                }, 15000);
        }
        load();
        return () => {
            stopped = true;
            abort.abort();
            clearTimeout(timer);
        };
    }, [authenticated, isAnonymous, user?.id]);
    return (
        <FollowControls>
            <label className="visibility">
                Show my public world activity
                <select
                    aria-label="Presence visibility"
                    value={visibility || ""}
                    disabled={!visibility || !!busy}
                    onChange={async (event) => {
                        const next = event.target.value as "public" | "hidden";
                        setBusy("visibility");
                        setError("");
                        try {
                            const result = await request(
                                "/api/social/presence-preferences",
                                write({ visibility: next }, "PUT")
                            );
                            setVisibility(result.visibility);
                        } catch (failure) {
                            setError(failure.message);
                        } finally {
                            setBusy("");
                        }
                    }}
                >
                    <option value="" disabled>
                        Loading…
                    </option>
                    <option value="public">Visible</option>
                    <option value="hidden">Hidden</option>
                </select>
            </label>
            {error && <span role="alert">{error}</span>}
            {!loaded ? (
                <p role="status">Loading people you follow…</p>
            ) : !rows.length ? (
                <p>
                    Follow creators from their profiles to find their worlds
                    here.
                </p>
            ) : (
                <ul>
                    {rows.slice(0, visible).map((person) => (
                        <li key={person.accountId}>
                            {person.avatar && (
                                <img
                                    src={person.avatar}
                                    alt=""
                                    width={40}
                                    height={40}
                                />
                            )}
                            <div className="person">
                                {person.profileUrl?.startsWith("/@") ? (
                                    <a href={person.profileUrl}>
                                        {person.name}
                                    </a>
                                ) : (
                                    <span>{person.name}</span>
                                )}
                                {person.presence?.experienceId && (
                                    <a
                                        className="activity"
                                        href={`/spaces/${encodeURIComponent(
                                            person.presence.experienceId
                                        )}`}
                                    >
                                        Visit current world →
                                    </a>
                                )}
                            </div>
                            <button
                                disabled={!!busy}
                                onClick={async () => {
                                    setBusy(person.accountId);
                                    setError("");
                                    try {
                                        await request(
                                            "/api/social/follows",
                                            write({
                                                accountId: person.accountId,
                                                following: false,
                                            })
                                        );
                                        setRows((current) =>
                                            current.filter(
                                                (row) =>
                                                    row.accountId !==
                                                    person.accountId
                                            )
                                        );
                                    } catch (failure) {
                                        setError(failure.message);
                                    } finally {
                                        setBusy("");
                                    }
                                }}
                            >
                                {busy === person.accountId
                                    ? "Saving…"
                                    : "Unfollow"}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {rows.length > visible && (
                <button onClick={() => setVisible((current) => current + 20)}>
                    Show more
                </button>
            )}
        </FollowControls>
    );
}
const FollowControls = styled.div`
    display: grid;
    gap: 16px;
    width: 100%;
    max-width: 720px;
    margin: 16px auto;
    button,
    select {
        color: inherit;
        background: transparent;
        border: 1px solid currentColor;
        border-radius: 12px;
        min-height: 40px;
        padding: 8px 16px;
        font: inherit;
        cursor: pointer;
    }
    > button {
        justify-self: center;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    button:focus-visible,
    a:focus-visible,
    select:focus-visible {
        outline: 2px solid #3975ff;
        outline-offset: 3px;
    }
    .visibility {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
    }
    select option {
        background: #191919;
        color: #fff;
    }
    ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    li {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 0;
        border-bottom: 1px solid #8883;
    }
    li img {
        border-radius: 50%;
        object-fit: cover;
    }
    .person {
        display: grid;
        gap: 4px;
        flex: 1;
        min-width: 0;
    }
    a {
        color: inherit;
        overflow-wrap: anywhere;
    }
    .activity {
        opacity: 0.65;
        font-size: 12px;
    }
    [role="alert"] {
        font-size: 13px;
    }
`;
