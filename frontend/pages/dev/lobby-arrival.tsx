import { useState } from "react";
import styled from "styled-components";
import { brandFoundation, compactActionSizing } from "@styles/brand";
import LobbyArrivalStatus from "@features/lobby/LobbyArrivalStatus";
import type { LobbyDestinationPhase } from "@features/lobby/lobbyJourneyProtocol";

/** Isolated development states; no destination, admission or network activity. */
export default function LobbyArrivalPreview() {
    const [stage, setStage] = useState("opening");
    const [longName, setLongName] = useState(false);
    const [visible, setVisible] = useState(true);
    const phase: LobbyDestinationPhase =
        stage === "returning"
            ? "returning"
            : stage === "arriving"
            ? "revealing"
            : stage === "ready"
            ? "entering"
            : "loading";
    return (
        <Preview
            onKeyDown={(event) => {
                if (
                    event.key === "Escape" &&
                    !event.nativeEvent.isComposing &&
                    event.keyCode !== 229
                )
                    setVisible(false);
            }}
        >
            <header>
                <span>Arrival · development preview</span>
                <label>
                    Stage
                    <select
                        value={stage}
                        onChange={(event) => {
                            setStage(event.target.value);
                            setVisible(true);
                        }}
                    >
                        <option value="opening">Opening</option>
                        <option value="ready">Admitted</option>
                        <option value="arriving">Arriving</option>
                        <option value="returning">Returning</option>
                    </select>
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={longName}
                        onChange={(event) => setLongName(event.target.checked)}
                    />
                    Long world name
                </label>
                {!visible && (
                    <button onClick={() => setVisible(true)}>
                        Show arrival
                    </button>
                )}
                {!visible && <span role="status">Preview cancelled</span>}
            </header>
            <div className="preview-horizon" aria-hidden="true" />
            {visible && (
                <LobbyArrivalStatus
                    worldName={
                        stage === "returning"
                            ? "Lobby"
                            : longName
                            ? "A quiet place on the moon — collection of impossible worlds"
                            : "A quiet place"
                    }
                    phase={phase}
                    admitted={stage !== "opening"}
                    onCancel={() => setVisible(false)}
                />
            )}
        </Preview>
    );
}

const Preview = styled.main`
    ${brandFoundation}
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #101010;
    color: var(--oc-ink);
    header {
        position: relative;
        z-index: 30;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        padding: 24px;
        font-size: 12px;
    }
    label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }
    button,
    select {
        ${compactActionSizing}
        border: 1px solid var(--oc-line-strong);
        color: var(--oc-ink);
        background: var(--oc-panel);
        cursor: pointer;
    }
    button:focus-visible,
    select:focus-visible,
    input:focus-visible {
        outline: 2px solid var(--oc-accent);
        outline-offset: 3px;
    }
    .preview-horizon {
        position: absolute;
        inset: 20% 0 0;
        background: radial-gradient(
            ellipse 80% 70% at 50% 100%,
            #c2c8d133,
            transparent 75%
        );
        pointer-events: none;
    }
`;

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
