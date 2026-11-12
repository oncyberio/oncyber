import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";
import type { AgoraVoiceChatProvider } from "./AgoraVoiceChatProvider";
import {
    AUDIO_LOW_BAR,
    levelToDecibels,
    readVoiceDebug,
    VoiceDebugRequest,
} from "./levels";
import { EventCallbacks, Events } from "./types";

type VoiceService = Pick<AgoraVoiceChatProvider, "on" | "off" | "channels">;

export interface VoiceLevelDebugProps {
    /** The place's voice service: `useMultiplayer().voice.voiceService`. */
    voiceService?: VoiceService | null;
}

interface Reading {
    threshold: number;
    people: Array<{ id: string; level: number; speaking: boolean }>;
}

/** Above every panel of a place, and below nothing it could cover up. */
const READOUT_LAYER = 30000;

const twoDecimals = (level: number) => level.toFixed(2);

// A level of 0 is anything at -100dB or quieter, not exactly -100dB.
const decibels = (level: number) =>
    level > 0 ? `${levelToDecibels(level).toFixed(1)} dB` : "-100 dB or less";

const meterStyle = (level: number, threshold: number) =>
    ({ "--level": level, "--threshold": threshold } as React.CSSProperties);

/**
 * A readout for tuning how loud counts as speaking. It shows each person's
 * microphone level four times a second, in decibels and on the 0..1 scale,
 * whether that counts as speaking, and the threshold.
 *
 * It appears only when the page URL has `voiceDebug`. Without it the
 * component renders nothing and listens to nothing. `?voiceDebug=0.42` (or
 * `?voiceDebug=-58`, in decibels) also tries that threshold while the readout
 * is up; the value to keep goes in AUDIO_LOW_BAR (levels.ts).
 *
 * Hidden from screen readers, and clicks pass through it.
 */
export default function VoiceLevelDebug({
    voiceService,
}: VoiceLevelDebugProps) {
    const [request, setRequest] = useState<VoiceDebugRequest | null>(null);

    // Read in the browser, after the first render, so that the server and
    // the browser render the same thing.
    useEffect(() => {
        setRequest(readVoiceDebug(window.location.search));
    }, []);

    if (request == null || voiceService == null) return null;

    return <Readout voiceService={voiceService} request={request} />;
}

function Readout({
    voiceService,
    request,
}: {
    voiceService: VoiceService;
    request: VoiceDebugRequest;
}) {
    const mic = voiceService.channels.mic;
    const [reading, setReading] = useState<Reading>({
        threshold: mic.audioLowBar,
        people: [],
    });

    // The threshold from the URL is tried for as long as the readout is up.
    useEffect(() => {
        if (request.threshold == null) return;

        const before = mic.audioLowBar;
        const threshold = mic.setAudioLowBar(request.threshold);

        setReading((shown) => ({ ...shown, threshold }));

        return () => {
            mic.setAudioLowBar(before);
        };
    }, [mic, request.threshold]);

    useEffect(() => {
        const show: EventCallbacks["VOLUME_INDICATOR"] = ({
            channel,
            volumes,
            threshold,
        }) => {
            if (channel !== "mic") return;

            // The channel updates the same objects on every sample.
            setReading({
                threshold: threshold ?? mic.audioLowBar,
                people: Object.keys(volumes)
                    .sort()
                    .map((id) => ({
                        id,
                        level: volumes[id].level,
                        speaking: volumes[id].isActive,
                    })),
            });
        };

        voiceService.on(Events.VOLUME_INDICATOR, show);

        return () => voiceService.off(Events.VOLUME_INDICATOR, show);
    }, [voiceService, mic]);

    const { threshold, people } = reading;

    return (
        <Panel aria-hidden="true" data-voice-debug="">
            <h2>Voice levels</h2>
            <p data-voice-debug-threshold="">
                Speaking above {twoDecimals(threshold)} ({decibels(threshold)})
                {threshold !== AUDIO_LOW_BAR &&
                    `, trying it: the code has ${twoDecimals(AUDIO_LOW_BAR)}`}
            </p>
            {people.length === 0 ? (
                <p>No microphone measured yet.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Session</th>
                            <th>0 to 1</th>
                            <th>Decibels</th>
                            <th>Counts as</th>
                            <th>Meter</th>
                        </tr>
                    </thead>
                    <tbody>
                        {people.map(({ id, level, speaking }) => (
                            <tr
                                key={id}
                                data-session={id}
                                data-speaking={speaking}
                            >
                                <td>
                                    {id}
                                    {id === mic.uid && " (you)"}
                                </td>
                                <td>{twoDecimals(level)}</td>
                                <td>{decibels(level)}</td>
                                <td>{speaking ? "speaking" : "quiet"}</td>
                                <td>
                                    <Meter
                                        style={meterStyle(level, threshold)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </Panel>
    );
}

const Panel = styled.div`
    position: fixed;
    top: 72px;
    left: 12px;
    z-index: ${READOUT_LAYER};
    max-width: calc(100vw - 24px);
    padding: 10px 12px;
    border: 1px solid ${base.color.line.strong};
    border-radius: ${base.radius.inset}px;
    background: ${lobby.control.tooltip};
    color: ${lobby.color.controlInk};
    font: ${base.font.weight.regular} ${base.font.size.xs}px / 1.5
        ${base.font.mono};
    font-variant-numeric: tabular-nums;
    pointer-events: none;

    h2,
    p {
        margin: 0;
        font: inherit;
    }

    h2 {
        color: ${lobby.color.meta};
    }

    table {
        margin-top: 6px;
        border-collapse: collapse;
    }

    th,
    td {
        padding: 0 12px 0 0;
        font-weight: inherit;
        text-align: left;
        white-space: nowrap;
    }

    th {
        color: ${lobby.color.meta};
    }

    tr[data-speaking="true"] td {
        color: ${base.color.selectionStart};
    }
`;

/** The level as a bar, with a mark where speaking starts. */
const Meter = styled.span`
    position: relative;
    display: block;
    width: 120px;
    height: 6px;
    background: ${base.color.line.default};

    &::before,
    &::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
    }

    &::before {
        left: 0;
        width: calc(var(--level) * 100%);
        background: currentColor;
    }

    &::after {
        left: calc(var(--threshold) * 100%);
        top: -3px;
        bottom: -3px;
        width: 1px;
        background: ${base.color.white};
    }
`;
