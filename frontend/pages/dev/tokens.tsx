import React, { useState } from "react";
import styled from "styled-components";
import { studioFoundation } from "@features/studio/styles/foundation";
import {
    studioPanel,
    studioHeading,
    studioTab,
} from "@features/studio/styles/primitives";
import { Button } from "@features/studio/styles/Button";
import { TextInput } from "@features/studio/styles/Input";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import { showConfirm, showInfo, showPrompt } from "@components/Dialogs";
import { Alert } from "@components/Dialogs/Alert";
import { Confirm } from "@components/Dialogs/Confirm";
import {
    DIALOG_COLOR_SCHEMES,
    dialogSurface,
} from "@components/Dialogs/styles";
import Confirming from "@components/modals/Transactions/Confirming";
import Bought from "@components/modals/Transactions/Confirm";
import {
    ActionButton,
    actionButton,
    brandFoundation,
    blueAction,
    compactActionSizing,
    outlineAction,
    pillAction,
    whiteAction,
} from "@styles/brand";
import {
    actionTokens,
    baseTokens,
    landingTokens,
    lobbyTokens,
    studioTokens,
} from "@styles/tokens";
import { promptGlass } from "@ui/components/PromptGlass";
import EmptyState from "@ui/components/EmptyState";
import { experienceControl } from "@features/content-host/experienceChrome";
import { lobbyPanelCard } from "@features/lobby/lobbyPanelStyles";
import { NButton } from "@ui/components/NButton";
import { RoundButton } from "@components/DesignSystem/buttons";

const ACTION_VARIANTS = [
    { variant: "blue", label: "Sign in", use: "Important: sign in, publish" },
    { variant: "white", label: "Continue", use: "An ordinary main action" },
    { variant: "outline", label: "Cancel", use: "Everything else" },
] as const;
const ACTION_SHAPES = ["rectangle", "pill"] as const;
const ACTION_STATES = ["default", "hover", "focus", "disabled"] as const;

/** Development reference: every token set, with samples of the real primitives. */
export default function TokensPreview() {
    return (
        <Page>
            <h1>Design tokens</h1>
            <p className="lead">
                One shared base, three surface sets. Source:
                <code> frontend/styles/tokens/</code>
            </p>
            <TokenSet name="Base" tokens={baseTokens} />
            <TokenSet name="Action buttons" tokens={actionTokens}>
                <p className="note">
                    One spec for every action button: the same type, border
                    width, height and padding for a pill and a rounded
                    rectangle. Blue is for important actions only.
                </p>
                <ActionMatrix data-sample="actions">
                    {ACTION_VARIANTS.map(({ variant, label, use }) =>
                        ACTION_SHAPES.map((shape) => (
                            <div className="row" key={variant + shape}>
                                <span className="name">
                                    {variant} · {shape}
                                    <small>{use}</small>
                                </span>
                                {ACTION_STATES.map((state) => (
                                    <span className="state" key={state}>
                                        <button
                                            type="button"
                                            className={`${variant} ${shape}`}
                                            data-force={state}
                                            disabled={state === "disabled"}
                                        >
                                            {label}
                                        </button>
                                        <small>{state}</small>
                                    </span>
                                ))}
                            </div>
                        ))
                    )}
                </ActionMatrix>
                <p className="note">
                    The component: <code>ActionButton</code> from
                    <code> @styles/brand</code>.
                </p>
                <Samples data-sample="action-component">
                    <ActionButton $variant="blue">Publish</ActionButton>
                    <ActionButton $variant="white">Save</ActionButton>
                    <ActionButton>Cancel</ActionButton>
                    <ActionButton $variant="white" $shape="pill">
                        Save
                    </ActionButton>
                    <ActionButton $shape="pill">Cancel</ActionButton>
                    <ActionButton as="a" href="#" $shape="pill">
                        A link
                    </ActionButton>
                </Samples>
                <p className="note">
                    The older families read the same spec. On a dark surface
                    they need the dark theme (<code>overrideTheme="dark"</code>
                    on <code>NButton</code>); the last one shows what happens
                    without it.
                </p>
                <Samples data-sample="legacy-dark">
                    <NButton variant="blue">NButton blue</NButton>
                    <NButton overrideTheme="dark">NButton</NButton>
                    <NButton overrideTheme="dark" outline>
                        NButton outline
                    </NButton>
                    <NButton overrideTheme="dark" size="small">
                        NButton small
                    </NButton>
                    <NButton overrideTheme="dark" disabled>
                        Disabled
                    </NButton>
                    <NButton overrideTheme="dark" outline disabled>
                        Disabled
                    </NButton>
                    <RoundButton>RoundButton</RoundButton>
                    <RoundButton disabled>Disabled</RoundButton>
                    <NButton overrideTheme="light">Light theme on dark</NButton>
                </Samples>
                <Samples className="light" data-sample="legacy-light">
                    <NButton overrideTheme="light">NButton</NButton>
                    <NButton overrideTheme="light" outline>
                        NButton outline
                    </NButton>
                    <NButton overrideTheme="light" disabled>
                        Disabled
                    </NButton>
                    <RoundButton isLight>RoundButton isLight</RoundButton>
                    <RoundButton isLight disabled>
                        Disabled
                    </RoundButton>
                </Samples>
            </TokenSet>
            <DialogSamples />
            <EmptyStateSamples />
            <TokenSet name="Landing (2D)" tokens={landingTokens}>
                <Samples>
                    <button className="landing-action">Jump In</button>
                    <div className="paper">Paper card</div>
                </Samples>
            </TokenSet>
            <TokenSet name="Lobby (UI over 3D)" tokens={lobbyTokens}>
                <Samples className="scene">
                    <button className="lobby-control" aria-label="Control">
                        ●
                    </button>
                    <button
                        className="lobby-control"
                        aria-pressed="true"
                        aria-label="Pressed control"
                    >
                        ●
                    </button>
                    <div className="glass">Glass panel</div>
                    <div className="lobby-card">Card</div>
                    <div className="lobby-card" aria-selected="true">
                        Selected
                    </div>
                </Samples>
            </TokenSet>
            <TokenSet id="studio" name="Studio" tokens={studioTokens}>
                <p className="lead">
                    Flat editor surfaces, compact controls, and neutral states.
                    These samples use the same primitives as the Studio. Build
                    with <code>studioTokens</code> and <code>StudioTheme</code>;
                    use <code>studioFoundation</code> for an isolated surface.
                </p>
                <StudioSamples />
            </TokenSet>
        </Page>
    );
}

const SAMPLE_ARTWORK = {
    name: "Cyber Warehouse",
    image_url: "/landing-build/cyber-warehouse.jpg",
};

/** The shared dialog: still specimens, and buttons that open the real ones. */
function DialogSamples() {
    const [buyWindow, setBuyWindow] = useState<"buying" | "bought">(null);
    const closeBuyWindow = () => setBuyWindow(null);
    return (
        <section>
            <h2>Dialogs</h2>
            <p className="note">
                Dialogs are dark on every page: the panel surface, a hairline
                border, 24 px corners (16 px on small screens) and the action
                buttons above. The confirming action is solid white and the
                other is the outline. Only the sign-in sheet stays light.
            </p>
            <DialogSpecimens data-sample="dialogs">
                <div
                    className="dialog"
                    style={DIALOG_COLOR_SCHEMES.dark as React.CSSProperties}
                >
                    <Alert
                        type="Info"
                        title="Link copied"
                        message="Anyone with this link can visit your world."
                    />
                </div>
                <div
                    className="dialog"
                    style={DIALOG_COLOR_SCHEMES.dark as React.CSSProperties}
                >
                    <Confirm
                        title="Leave without saving?"
                        message="Your latest changes will be lost."
                        yes="Leave"
                        no="Keep editing"
                    />
                </div>
            </DialogSpecimens>
            <Samples data-sample="dialog-openers">
                <ActionButton
                    onClick={() =>
                        showInfo(
                            "Anyone with this link can visit your world.",
                            "Link copied"
                        )
                    }
                >
                    Open an alert
                </ActionButton>
                <ActionButton
                    onClick={() =>
                        showConfirm("Your latest changes will be lost.", {
                            title: "Leave without saving?",
                            yes: "Leave",
                            no: "Keep editing",
                        })
                    }
                >
                    Open a confirm
                </ActionButton>
                <ActionButton
                    onClick={() =>
                        showPrompt({
                            type: "password",
                            message: "Enter the password for this world.",
                        })
                    }
                >
                    Open a prompt
                </ActionButton>
                <ActionButton onClick={() => setBuyWindow("buying")}>
                    Open the buy window
                </ActionButton>
                <ActionButton onClick={() => setBuyWindow("bought")}>
                    Open the bought window
                </ActionButton>
            </Samples>
            <Confirming
                isShowing={buyWindow === "buying"}
                toggle={closeBuyWindow}
                transactionHash="0x0000000000000000000000000000000000000000"
                asset={SAMPLE_ARTWORK}
            />
            <Bought
                isShowing={buyWindow === "bought"}
                toggle={closeBuyWindow}
                artwork={SAMPLE_ARTWORK}
            />
        </section>
    );
}

/** The shared empty state on a dark page, a dark panel and a light panel. */
function EmptyStateSamples() {
    return (
        <section>
            <h2>Empty states</h2>
            <p className="note">
                A small icon, one plain line, an optional short second line and
                at most one action: blue only to sign in or publish, white for
                the one obvious next step, the outline otherwise. Never an
                emoji. <code>EmptyState</code> from
                <code> @ui/components/EmptyState</code>.
            </p>
            <Samples className="empty-states" data-sample="empty-states">
                <EmptyState
                    size="page"
                    icon="globe"
                    title="Your destinations, in one place."
                    detail="Sign in to manage your uploaded and published destinations."
                    action={{
                        label: "Sign in",
                        variant: "blue",
                        onClick: noop,
                    }}
                />
                <EmptyState
                    size="page"
                    icon="globe"
                    title="Your next destination starts here."
                    detail="Upload a gallery destination or a Kitbash to get started."
                    action={{
                        label: "Upload destination",
                        variant: "white",
                        onClick: noop,
                    }}
                />
                <EmptyState
                    icon="search"
                    title="No matching destinations."
                    action={{ label: "Show all destinations", onClick: noop }}
                />
                <EmptyState icon="activity" title="No activity yet." />
            </Samples>
            <Samples
                className="light empty-states"
                data-sample="empty-states-light"
            >
                <EmptyState
                    surface="light"
                    icon="activity"
                    title="No price history yet."
                />
                <EmptyState
                    surface="light"
                    icon="tag"
                    title="No offers yet."
                    action={{ label: "Make an offer", onClick: noop }}
                />
            </Samples>
        </section>
    );
}

const noop = () => {};

function StudioSamples() {
    const [tab, setTab] = useState("content");
    return (
        <StudioReference>
            <div className="editor-panel" data-studio-surface>
                <h3 className="editor-title">Artwork inspector</h3>
                <div className="editor-tabs" aria-label="Inspector section">
                    <button
                        type="button"
                        aria-pressed={tab === "content"}
                        onClick={() => setTab("content")}
                    >
                        Content
                    </button>
                    <button
                        type="button"
                        aria-pressed={tab === "settings"}
                        onClick={() => setTab("settings")}
                    >
                        Settings
                    </button>
                </div>
                <Field>
                    <Label as="label" htmlFor="studio-sample-name">
                        {tab === "content" ? "Artwork title" : "Object name"}
                    </Label>
                    <TextInput
                        id="studio-sample-name"
                        placeholder="Untitled artwork"
                    />
                </Field>
                <Field>
                    <Label as="label" htmlFor="studio-sample-readonly">
                        Unavailable field
                    </Label>
                    <TextInput
                        id="studio-sample-readonly"
                        defaultValue="Select an artwork first"
                        disabled
                    />
                </Field>
                <div className="editor-actions">
                    <Button type="button">Neutral action</Button>
                    <Button type="button" primary>
                        Primary action
                    </Button>
                    <Button type="button" disabled>
                        Disabled
                    </Button>
                </div>
                <p className="editor-hint">
                    Preview controls only. Nothing is saved.
                </p>
            </div>
            <div className="editor-reference">
                <h3>Editor conventions</h3>
                <p>13 px body · 16 px headings · 40 px fields</p>
                <p>18 px panels · 10 px controls · 8 px gaps</p>
                <p>Use Space Mono for coordinates and numeric utilities.</p>
                <code className="editor-numeric">X 0.00 · Y 1.68 · Z 0.00</code>
                <button type="button" className="editor-play">
                    Play / Preview
                </button>
                <p>
                    Blue is reserved for Play / Preview. Ordinary editor actions
                    stay neutral.
                </p>
            </div>
        </StudioReference>
    );
}

const StudioReference = styled.div`
    ${studioFoundation}
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 24px;
    padding: 20px;
    margin: 0 0 20px;
    border-radius: var(--studio-radius-panel);
    background: var(--studio-bg);
    .editor-panel {
        ${studioPanel}
        box-sizing: border-box;
        display: grid;
        gap: ${studioTokens.space.sectionGap}px;
        width: min(100%, ${studioTokens.layout.inspectorWidth}px);
        padding: var(--studio-panel-padding);
    }
    h3.editor-title {
        ${studioHeading}
        color: var(--studio-ink);
        text-transform: none;
    }
    .editor-tabs {
        display: flex;
        gap: 20px;
        border-bottom: 1px solid var(--studio-line);
        button {
            ${studioTab}
        }
    }
    .editor-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--studio-grid-gap);
    }
    .editor-hint {
        margin: 0;
        color: var(--studio-muted);
    }
    .editor-reference {
        flex: 1 1 240px;
        min-width: 0;
        color: var(--studio-secondary);
    }
    .editor-reference h3 {
        font: var(--studio-font-heading);
        color: var(--studio-ink);
        text-transform: none;
    }
    .editor-numeric {
        display: block;
        font: var(--studio-font-numeric);
    }
    .editor-play {
        ${blueAction}
        margin-top: 20px;
        min-height: ${studioTokens.action.minHeight}px;
        padding: 0 16px;
        border: 0;
        border-radius: 999px;
        font: var(--studio-font-action);
        cursor: pointer;
    }
`;

function TokenSet({ name, tokens, children = null, id = undefined }) {
    return (
        <section id={id}>
            <h2>{name}</h2>
            {children}
            <div className="groups">
                {Object.entries(tokens).map(([group, values]) => (
                    <div key={group} className="group">
                        <h3>{group}</h3>
                        <Rows prefix="" values={values} />
                    </div>
                ))}
            </div>
        </section>
    );
}

function Rows({ prefix, values }) {
    return (
        <>
            {Object.entries(values).map(([key, value]) =>
                typeof value === "object" ? (
                    <Rows
                        key={key}
                        prefix={`${prefix}${key}.`}
                        values={value}
                    />
                ) : (
                    <div key={key} className="row">
                        {isColor(value) && (
                            <i style={{ background: String(value) }} />
                        )}
                        <span>{prefix + key}</span>
                        <code>{String(value)}</code>
                    </div>
                )
            )}
        </>
    );
}

const isColor = (value: unknown) =>
    typeof value === "string" && /^(#|rgba?\(|linear-gradient)/.test(value);

/**
 * Shows a variant's hover and focus styles without a pointer: the variant's
 * own rules again, with the pseudo-classes replaced by `data-force`.
 */
const forcedStates = (rules: readonly unknown[]) =>
    rules
        .join("")
        .replace(/&:hover:not\(:disabled\)/g, '&[data-force="hover"]')
        .replace(/&:focus-visible/g, '&[data-force="focus"]');

const DialogSpecimens = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 20px;
    margin: 0 0 20px;
    padding: 20px;
    border-radius: var(--oc-radius-control);
    background: ${baseTokens.color.black};
    .dialog {
        ${dialogSurface}
        width: 400px;
        max-width: 100%;
        overflow: hidden;
    }
`;

const ActionMatrix = styled.div`
    display: grid;
    gap: 16px;
    margin: 0 0 20px;
    padding: 20px;
    border-radius: var(--oc-radius-control);
    background: ${landingTokens.color.panel};
    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 12px 16px;
    }
    .name {
        flex: 0 0 180px;
        display: grid;
        gap: 2px;
        align-self: center;
        color: var(--oc-ink);
    }
    .state {
        display: grid;
        justify-items: center;
        gap: 6px;
    }
    small {
        color: var(--oc-muted);
        font: 400 10px/1.4 var(--oc-mono);
    }
    button {
        ${actionButton}
    }
    .pill {
        ${pillAction}
    }
    .blue {
        ${blueAction}
        ${forcedStates(blueAction)}
    }
    .white {
        ${whiteAction}
        ${forcedStates(whiteAction)}
    }
    .outline {
        ${outlineAction}
        ${forcedStates(outlineAction)}
    }
    @media (max-width: ${baseTokens.breakpoint.compact}px) {
        .name {
            flex-basis: 100%;
        }
    }
`;

const Samples = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin: 0 0 20px;
    padding: 20px;
    border-radius: var(--oc-radius-control);
    background: ${landingTokens.color.panel};
    &.scene {
        background: radial-gradient(circle at 20% 30%, #4b6b8a, transparent),
            linear-gradient(135deg, #2c3f2a, #5b3b5e);
    }
    &.light {
        background: ${baseTokens.color.white};
    }
    &.empty-states {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        align-items: stretch;
    }
    .landing-action {
        ${compactActionSizing}
        ${blueAction}
        border: 0;
    }
    .paper {
        padding: 16px 20px;
        border-radius: ${landingTokens.radius.compactCard}px;
        background: ${landingTokens.color.paper};
        color: ${landingTokens.color.paperInk};
        box-shadow: ${landingTokens.shadow.card};
    }
    .lobby-control {
        ${experienceControl}
    }
    .glass {
        ${promptGlass}
        position: relative;
        padding: 16px 20px;
        border-radius: ${lobbyTokens.panel.radius}px;
    }
    .lobby-card {
        ${lobbyPanelCard}
        padding: 16px 20px;
        color: ${lobbyTokens.color.ink};
    }
`;

const Page = styled.main`
    ${brandFoundation}
    min-height: 100vh;
    box-sizing: border-box;
    padding: 40px 16px 80px;
    background: var(--oc-canvas);
    color: var(--oc-ink);
    > * {
        max-width: 1100px;
        margin-left: auto;
        margin-right: auto;
    }
    h1 {
        margin-top: 0;
        margin-bottom: 4px;
        font-size: 28px;
        font-weight: 500;
    }
    .lead {
        margin-top: 0;
        color: var(--oc-muted);
    }
    .note {
        margin: 0 0 12px;
        color: var(--oc-secondary);
    }
    .note code {
        color: var(--oc-ink);
        font: 12px var(--oc-mono);
    }
    section {
        margin-top: 40px;
    }
    h2 {
        font-size: 18px;
        font-weight: 500;
    }
    .groups {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 12px;
    }
    .group {
        padding: 12px 14px;
        border: 1px solid var(--oc-line);
        border-radius: var(--oc-radius-control);
        background: var(--oc-panel);
        min-width: 0;
    }
    h3 {
        margin: 0 0 8px;
        color: var(--oc-secondary);
        font: 400 11px/1.4 var(--oc-mono);
        text-transform: uppercase;
    }
    .row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 24px;
        font-size: 12px;
    }
    .row i {
        flex: 0 0 16px;
        height: 16px;
        border-radius: 4px;
        border: 1px solid var(--oc-line-strong);
    }
    .row span {
        flex-shrink: 0;
    }
    .row code {
        margin-left: auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--oc-muted);
        font: 11px var(--oc-mono);
    }
`;

/** Development only, like the other /dev pages: not found in production. */
export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
