import React, { useEffect, useState } from "react";
import type { LobbySummon } from "./LobbyConnection";

/** Same as spaces: five seconds to stay put, then you go. */
export const SUMMON_COUNTDOWN_S = 5;

/**
 * An admin's "bring everyone here", as a notice beside party invites. Like
 * the summon card in spaces it counts down and then takes you there, unless
 * you choose to stay.
 */
export default function LobbySummonNotice({
    summon,
    onGo,
    onStay,
}: {
    summon: LobbySummon | null;
    onGo(sessionId: string): void;
    onStay(): void;
}) {
    const [left, setLeft] = useState(SUMMON_COUNTDOWN_S);
    const id = summon?.sessionId,
        at = summon?.receivedAt;
    useEffect(() => {
        if (!id) return;
        const tick = () => {
            const remaining = Math.max(
                0,
                Math.ceil(SUMMON_COUNTDOWN_S - (Date.now() - at) / 1000)
            );
            setLeft(remaining);
            if (!remaining) onGo(id);
        };
        tick();
        const timer = window.setInterval(tick, 250);
        return () => window.clearInterval(timer);
        // onGo is stable for one summon; restarting on it would reset the count.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, at]);
    if (!summon) return null;
    return (
        <article
            className="group-notice voice-request-notice"
            aria-label={`${summon.name} is bringing everyone to them`}
        >
            <small>ADMIN · GOING IN {left}S</small>
            <p>
                {summon.avatar && (
                    <img src={summon.avatar} alt="" aria-hidden="true" />
                )}
                <span>
                    <strong>{summon.name}</strong> is bringing everyone to them.
                </span>
            </p>
            <div>
                <button
                    type="button"
                    className="notice-primary"
                    onClick={() => onGo(summon.sessionId)}
                >
                    Go now
                </button>
                <button type="button" onClick={onStay}>
                    Stay here
                </button>
            </div>
        </article>
    );
}
