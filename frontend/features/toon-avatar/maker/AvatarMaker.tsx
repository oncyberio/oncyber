import {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useRouter } from "next/router";
import styled from "styled-components";
import { brandFoundation } from "@styles/brand";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";
import { UPDATE_USER_DATA, UserContext } from "@components/context/UserContext";
import { rememberTravelAvatar } from "@utils/travelAvatar";
import { decodeRecipe, encodeRecipe } from "../codec";
import { TOON_AVATAR_PRESETS } from "../presets";
import { randomRecipe } from "../random";
import {
    TOON_AVATAR_SCHEMA,
    defaultRecipe,
    normalizeRecipe,
    recipesEqual,
    setRecipeField,
    type Field,
    type ToonAvatarRecipe,
} from "../recipe";
import { TOON_MOTIONS, type ToonMotion } from "../three/motion";
import { isAuthoredAvatarId, loadAuthoredAvatar } from "../authored/catalogue";
import type { AuthoredAvatar } from "../authored/types";
import { authoredAvatarUrl, toonAvatarUrl } from "../url";
import {
    TOON_AVATAR_NAME,
    readToonDraft,
    saveToonAvatar,
    saveToonDraft,
} from "../wardrobe";
import { Choice, ColorPicker, Slider } from "./controls";
import type { ToonAvatarStage } from "./stage";
import { MAKER_TABS, optionLabel, paletteFor, type FieldRef } from "./tabs";
import { useRecipeHistory } from "./useRecipeHistory";

const MOTION_LABELS: Record<ToonMotion, string> = {
    idle: "Idle",
    walk: "Walk",
    run: "Run",
    jump: "Jump",
    wave: "Wave",
    dance: "Dance",
    cheer: "Cheer",
};

function initialRecipe(query: Record<string, unknown>): ToonAvatarRecipe {
    const preset = TOON_AVATAR_PRESETS.find((item) => item.id === query.preset);
    return (
        decodeRecipe(query.a) ||
        preset?.recipe ||
        (query.seed ? randomRecipe(Number(query.seed)) : null) ||
        decodeRecipe(readToonDraft()) ||
        defaultRecipe()
    );
}

/** A square portrait of the canvas, small enough to keep in local storage. */
async function portrait(stage: ToonAvatarStage): Promise<string | undefined> {
    const blob = await stage.snapshot();
    if (!blob) return undefined;
    const bitmap = await createImageBitmap(blob);
    const size = 192;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const side = Math.min(bitmap.width, bitmap.height);
    canvas
        .getContext("2d")
        ?.drawImage(
            bitmap,
            (bitmap.width - side) / 2,
            (bitmap.height - side) / 2,
            side,
            side,
            0,
            0,
            size,
            size
        );
    return canvas.toDataURL("image/webp", 0.8);
}

export default function AvatarMaker() {
    const router = useRouter();
    const id = router.isReady ? router.query.id : undefined;
    const wanted = isAuthoredAvatarId(id) ? id : null;
    const [authored, setAuthored] = useState<AuthoredAvatar | null>(null);
    useEffect(() => {
        let cancelled = false;
        if (wanted)
            void loadAuthoredAvatar(wanted).then((avatar) => {
                if (!cancelled) setAuthored(avatar);
            });
        return () => {
            cancelled = true;
        };
    }, [wanted]);
    if (!router.isReady || (wanted && !authored)) return <Page aria-busy />;
    return (
        <Maker
            initial={
                decodeRecipe(router.query.a) ||
                (authored && normalizeRecipe(authored.recipe)) ||
                initialRecipe(router.query)
            }
            authored={authored}
            query={router.query}
        />
    );
}

function Maker({
    initial,
    authored,
    query,
}: {
    initial: ToonAvatarRecipe;
    authored: AuthoredAvatar | null;
    query: Record<string, unknown>;
}) {
    const router = useRouter();
    const account = useContext(UserContext) as any;
    const history = useRecipeHistory(initial);
    const { recipe } = history;
    const canvas = useRef<HTMLCanvasElement>(null);
    const stage = useRef<ToonAvatarStage | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "failed">(
        "loading"
    );
    const [tabId, setTabId] = useState(
        typeof query.tab === "string" ? query.tab : "starters"
    );
    const [motion, setMotion] = useState<ToonMotion>(
        TOON_MOTIONS.includes(query.motion as ToonMotion)
            ? (query.motion as ToonMotion)
            : "idle"
    );
    const [turntable, setTurntable] = useState(false);
    const [notice, setNotice] = useState("");
    const [saved, setSaved] = useState<ToonAvatarRecipe | null>(null);
    const seed = useRef(Math.floor(Math.random() * 1e9));
    const tab = MAKER_TABS.find((item) => item.id === tabId) || MAKER_TABS[0];
    const code = useMemo(() => encodeRecipe(recipe), [recipe]);

    // The stage: created once, fed the recipe as it changes.
    useEffect(() => {
        if (!canvas.current) return;
        let cancelled = false;
        let created: ToonAvatarStage | null = null;
        let observer: ResizeObserver | null = null;
        const root = document.documentElement;
        root.dataset.toonAvatar = "loading";
        (async () => {
            const { ToonAvatarStage } = await import("./stage");
            if (cancelled || !canvas.current) return;
            created = new ToonAvatarStage(canvas.current, initial, {
                forceWebGL: query.renderer === "webgl",
                authored: authored || undefined,
                reducedMotion: window.matchMedia?.(
                    "(prefers-reduced-motion: reduce)"
                ).matches,
            });
            stage.current = created;
            if (typeof query.yaw === "string")
                created.orbit(Number(query.yaw) + 0.35, 0);
            observer = new ResizeObserver(() => created?.resize());
            observer.observe(canvas.current);
            await created.whenReady();
            if (cancelled) return;
            setStatus("ready");
            root.dataset.toonAvatar = "ready";
        })().catch((error) => {
            console.error(error);
            if (cancelled) return;
            setStatus("failed");
            root.dataset.toonAvatar = "failed";
        });
        return () => {
            cancelled = true;
            observer?.disconnect();
            created?.dispose();
            stage.current = null;
            delete root.dataset.toonAvatar;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Rebuild at most once a frame while a slider is dragged.
    const pending = useRef(0);
    useEffect(() => {
        cancelAnimationFrame(pending.current);
        pending.current = requestAnimationFrame(() =>
            stage.current?.setRecipe(recipe)
        );
        return () => cancelAnimationFrame(pending.current);
    }, [recipe, status]);
    useEffect(() => stage.current?.setMotion(motion), [motion, status]);
    useEffect(() => stage.current?.setFocus(tab.focus), [tab.focus, status]);
    useEffect(
        () => stage.current?.setTurntable(turntable),
        [turntable, status]
    );

    // Keep the draft and the address in step, so a reload or a shared link
    // comes back to this avatar.
    useEffect(() => {
        const timer = window.setTimeout(() => {
            saveToonDraft(code);
            const url = new URL(window.location.href);
            url.searchParams.set("a", code);
            window.history.replaceState(window.history.state, "", url);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [code]);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(""), 2600);
        return () => window.clearTimeout(timer);
    }, [notice]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (
                !(event.metaKey || event.ctrlKey) ||
                event.key.toLowerCase() !== "z"
            )
                return;
            const target = event.target as HTMLElement;
            if (
                target?.tagName === "INPUT" &&
                (target as HTMLInputElement).type === "text"
            )
                return;
            event.preventDefault();
            if (event.shiftKey) history.redo();
            else history.undo();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [history]);

    const change = useCallback(
        (ref: FieldRef, value: unknown, dragging = false) =>
            history.set(
                setRecipeField(recipe, ref[0], ref[1] as never, value),
                dragging ? "drag" : "step"
            ),
        [history, recipe]
    );

    const shuffle = () => {
        seed.current += 1;
        history.set(
            randomRecipe(
                seed.current,
                recipe,
                tab.groups.length ? tab.groups : undefined
            )
        );
        setNotice(
            tab.groups.length
                ? `Shuffled ${tab.label.toLowerCase()}`
                : "Shuffled everything"
        );
    };

    const copy = async (text: string, done: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setNotice(done);
        } catch {
            setNotice("Copying isn’t available in this browser");
        }
    };

    const savePicture = async () => {
        const blob = await stage.current?.snapshot();
        if (!blob) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "oncyber-avatar.png";
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    };

    const useAvatar = async () => {
        // An authored avatar keeps its id, plus the sliders if they were changed.
        const url = authored
            ? authoredAvatarUrl(
                  authored.id,
                  recipesEqual(recipe, normalizeRecipe(authored.recipe))
                      ? undefined
                      : code
              )
            : toonAvatarUrl(code);
        const image = stage.current
            ? await portrait(stage.current).catch(() => undefined)
            : undefined;
        saveToonAvatar({ code, id: authored?.id, image, wear: true });
        const { userData, user, token, authenticated, isAnonymous } =
            account || {};
        // The lobby and spaces read the same travel avatar and saved setting.
        rememberTravelAvatar(userData, {
            id: url,
            name: TOON_AVATAR_NAME,
            url,
        });
        if (authenticated && !isAnonymous && user?.id && token) {
            const payload = {
                settings: { ...(userData?.settings || {}), vrm: url },
            };
            account.dispatch?.({ type: UPDATE_USER_DATA, payload });
            try {
                const { updateUser } = await import("@utils/saveToDb");
                await updateUser(token, payload, user.id);
                setNotice(
                    "Saved to your account. You’ll wear it in the lobby."
                );
            } catch {
                setNotice(
                    "Saved on this device. Your account couldn’t be reached."
                );
            }
        } else setNotice("Saved on this device. You’ll wear it in the lobby.");
        setSaved(recipe);
    };

    // Dragging turns the avatar; the wheel and pinch zoom.
    const drag = useRef<{ x: number; y: number } | null>(null);
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const pinch = useRef(0);
    const onPointerDown = (event: React.PointerEvent) => {
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
        });
        drag.current = { x: event.clientX, y: event.clientY };
        pinch.current = 0;
    };
    const onPointerMove = (event: React.PointerEvent) => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
        });
        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinch.current) stage.current?.zoomBy(pinch.current / distance);
            pinch.current = distance;
            return;
        }
        if (!drag.current) return;
        stage.current?.orbit(
            -(event.clientX - drag.current.x) * 0.008,
            (event.clientY - drag.current.y) * 0.004
        );
        drag.current = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: React.PointerEvent) => {
        pointers.current.delete(event.pointerId);
        drag.current = null;
        pinch.current = 0;
    };
    useEffect(() => {
        const element = canvas.current;
        if (!element) return;
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            stage.current?.zoomBy(Math.exp(event.deltaY * 0.0012));
        };
        element.addEventListener("wheel", onWheel, { passive: false });
        return () => element.removeEventListener("wheel", onWheel);
    }, []);
    const onStageKey = (event: React.KeyboardEvent) => {
        const step = {
            ArrowLeft: [0.2, 0],
            ArrowRight: [-0.2, 0],
            ArrowUp: [0, 0.08],
            ArrowDown: [0, -0.08],
        }[event.key];
        if (step) {
            event.preventDefault();
            stage.current?.orbit(step[0], step[1]);
        } else if (event.key === "+" || event.key === "=")
            stage.current?.zoomBy(0.9);
        else if (event.key === "-") stage.current?.zoomBy(1.1);
        else if (event.key === "0") stage.current?.resetView();
    };

    const isSaved = !!saved && recipesEqual(saved, recipe);
    const back = () => {
        if (window.history.length > 1) router.back();
        else void router.push("/");
    };

    return (
        <Page>
            <Stage>
                <canvas
                    ref={canvas}
                    tabIndex={0}
                    role="img"
                    aria-label="Your avatar. Drag or use the arrow keys to turn it, scroll to zoom."
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onKeyDown={onStageKey}
                    onDoubleClick={() => stage.current?.resetView()}
                />
                {status === "loading" && (
                    <StageNote>Getting the studio ready…</StageNote>
                )}
                {status === "failed" && (
                    <StageNote role="alert">
                        The 3D view couldn’t start in this browser. Your avatar
                        is still saved in the address bar.
                    </StageNote>
                )}
                <TopBar>
                    <IconButton type="button" onClick={back} aria-label="Back">
                        <svg
                            viewBox="0 0 16 16"
                            width="16"
                            height="16"
                            aria-hidden
                        >
                            <path
                                d="M10 3 5 8l5 5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </IconButton>
                    <h1>Avatar maker</h1>
                    <span className="spacer" />
                    <TextButton
                        type="button"
                        onClick={history.undo}
                        disabled={!history.canUndo}
                    >
                        Undo
                    </TextButton>
                    <TextButton
                        type="button"
                        onClick={history.redo}
                        disabled={!history.canRedo}
                    >
                        Redo
                    </TextButton>
                    <TextButton type="button" onClick={shuffle}>
                        Shuffle
                    </TextButton>
                </TopBar>
                <Dock role="radiogroup" aria-label="Preview a move">
                    {TOON_MOTIONS.map((name) => (
                        <DockButton
                            key={name}
                            type="button"
                            role="radio"
                            aria-checked={motion === name}
                            $on={motion === name}
                            onClick={() => setMotion(name)}
                        >
                            {MOTION_LABELS[name]}
                        </DockButton>
                    ))}
                    <span className="divider" aria-hidden />
                    <DockButton
                        type="button"
                        aria-pressed={turntable}
                        $on={turntable}
                        onClick={() => setTurntable((value) => !value)}
                    >
                        Spin
                    </DockButton>
                </Dock>
            </Stage>

            <Panel aria-label="Avatar controls">
                <Tabs role="tablist" aria-label="Avatar parts">
                    {MAKER_TABS.map((item) => (
                        <Tab
                            key={item.id}
                            type="button"
                            role="tab"
                            id={`maker-tab-${item.id}`}
                            aria-selected={item.id === tab.id}
                            aria-controls="maker-panel"
                            tabIndex={item.id === tab.id ? 0 : -1}
                            $on={item.id === tab.id}
                            onClick={() => setTabId(item.id)}
                            onKeyDown={(event) => {
                                const at = MAKER_TABS.indexOf(item);
                                const move = {
                                    ArrowRight: 1,
                                    ArrowDown: 1,
                                    ArrowLeft: -1,
                                    ArrowUp: -1,
                                }[event.key];
                                if (!move) return;
                                event.preventDefault();
                                const next =
                                    MAKER_TABS[
                                        (at + move + MAKER_TABS.length) %
                                            MAKER_TABS.length
                                    ];
                                setTabId(next.id);
                                document
                                    .getElementById(`maker-tab-${next.id}`)
                                    ?.focus();
                            }}
                        >
                            {item.label}
                        </Tab>
                    ))}
                </Tabs>
                <Body
                    id="maker-panel"
                    role="tabpanel"
                    aria-labelledby={`maker-tab-${tab.id}`}
                    key={tab.id}
                >
                    {tab.id === "starters" ? (
                        <>
                            <SectionTitle>Start from</SectionTitle>
                            <Starters>
                                {TOON_AVATAR_PRESETS.map((preset) => (
                                    <Starter
                                        key={preset.id}
                                        type="button"
                                        aria-pressed={recipesEqual(
                                            preset.recipe,
                                            recipe
                                        )}
                                        $on={recipesEqual(
                                            preset.recipe,
                                            recipe
                                        )}
                                        onClick={() =>
                                            history.set(preset.recipe)
                                        }
                                    >
                                        <span
                                            className="chip"
                                            style={{
                                                background: `linear-gradient(135deg, ${preset.recipe.look.skin} 0 34%, ${preset.recipe.hair.color} 34% 56%, ${preset.recipe.outfit.topColor} 56% 80%, ${preset.recipe.outfit.bottomColor} 80%)`,
                                            }}
                                            aria-hidden
                                        />
                                        {preset.name}
                                    </Starter>
                                ))}
                            </Starters>
                            <Hint>
                                Pick a starter, then change anything in the
                                tabs. Shuffle rolls a new avatar; on a tab it
                                rolls just that part.
                            </Hint>
                            <SectionTitle>Avatar code</SectionTitle>
                            <CodeBox
                                readOnly
                                value={code}
                                aria-label="Avatar code"
                                onFocus={(event) => event.target.select()}
                            />
                            <Actions>
                                <TextButton
                                    type="button"
                                    onClick={() => copy(code, "Code copied")}
                                >
                                    Copy code
                                </TextButton>
                                <TextButton
                                    type="button"
                                    onClick={() =>
                                        copy(
                                            new URL(
                                                toonAvatarUrl(code),
                                                window.location.href
                                            ).href,
                                            "Link copied"
                                        )
                                    }
                                >
                                    Copy link
                                </TextButton>
                                <TextButton
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            const text = (
                                                await navigator.clipboard.readText()
                                            ).trim();
                                            const pasted =
                                                decodeRecipe(text) ||
                                                decodeRecipe(
                                                    new URL(
                                                        text,
                                                        window.location.href
                                                    ).searchParams.get("a")
                                                );
                                            if (pasted) history.set(pasted);
                                            setNotice(
                                                pasted
                                                    ? "Avatar loaded"
                                                    : "That isn’t an avatar code"
                                            );
                                        } catch {
                                            setNotice(
                                                "Paste isn’t available in this browser"
                                            );
                                        }
                                    }}
                                >
                                    Paste code
                                </TextButton>
                            </Actions>
                        </>
                    ) : (
                        tab.sections.map((section) => (
                            <section key={section.title}>
                                <SectionTitle>{section.title}</SectionTitle>
                                {section.fields.map((ref) => {
                                    const [group, key] = ref;
                                    const field = (
                                        TOON_AVATAR_SCHEMA[group] as Record<
                                            string,
                                            Field
                                        >
                                    )[key];
                                    const value = (
                                        recipe[group] as Record<
                                            string,
                                            string | number
                                        >
                                    )[key];
                                    if (field.kind === "unit")
                                        return (
                                            <Slider
                                                key={key}
                                                label={field.label}
                                                value={value as number}
                                                reset={field.def}
                                                onChange={(v, dragging) =>
                                                    change(ref, v, dragging)
                                                }
                                                onCommit={history.commit}
                                            />
                                        );
                                    if (field.kind === "choice")
                                        return (
                                            <Choice
                                                key={key}
                                                label={field.label}
                                                options={field.options}
                                                value={value as string}
                                                format={optionLabel}
                                                onChange={(option) =>
                                                    change(ref, option)
                                                }
                                            />
                                        );
                                    return (
                                        <ColorPicker
                                            key={key}
                                            label={field.label}
                                            value={value as string}
                                            palette={paletteFor(group, key)}
                                            onChange={(color, dragging) =>
                                                change(ref, color, dragging)
                                            }
                                            onCommit={history.commit}
                                        />
                                    );
                                })}
                            </section>
                        ))
                    )}
                </Body>
                <Footer>
                    <TextButton
                        type="button"
                        onClick={savePicture}
                        disabled={status !== "ready"}
                    >
                        Save picture
                    </TextButton>
                    <TextButton
                        type="button"
                        onClick={() => history.set(defaultRecipe())}
                    >
                        Reset
                    </TextButton>
                    <Primary
                        type="button"
                        onClick={useAvatar}
                        disabled={isSaved}
                    >
                        {isSaved ? "Wearing this avatar" : "Use this avatar"}
                    </Primary>
                </Footer>
            </Panel>
            <Toast role="status" aria-live="polite" $show={!!notice}>
                {notice}
            </Toast>
        </Page>
    );
}

const PANEL = 380;

const Page = styled.main`
    ${brandFoundation}
    position: fixed;
    inset: 0;
    display: flex;
    overflow: hidden;
    color: ${base.color.ink};
    background: radial-gradient(
        120% 80% at 35% 60%,
        ${lobby.control.pressed} 0%,
        ${lobby.glass.fallback} 55%,
        ${base.color.black} 140%
    );
    @media (max-width: ${base.breakpoint.compact}px) {
        flex-direction: column;
    }
`;

const Stage = styled.div`
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    canvas {
        display: block;
        width: 100%;
        height: 100%;
        cursor: grab;
        touch-action: none;
        outline: none;
        &:active {
            cursor: grabbing;
        }
        &:focus-visible {
            box-shadow: inset 0 0 0 ${base.focus.width}px ${base.color.accent};
        }
    }
    @media (max-width: ${base.breakpoint.compact}px) {
        flex: 0 0 44dvh;
    }
`;

const StageNote = styled.p`
    position: absolute;
    inset: 50% 24px auto;
    margin: 0;
    text-align: center;
    color: ${lobby.color.secondary};
    pointer-events: none;
`;

const TopBar = styled.header`
    position: absolute;
    inset: 16px 16px auto;
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: none;
    > * {
        pointer-events: auto;
    }
    h1 {
        margin: 0 4px;
        font-size: 16px;
        font-weight: ${base.font.weight.medium};
        line-height: 24px;
        white-space: nowrap;
        @media (max-width: ${base.breakpoint.phone}px) {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip-path: inset(50%);
        }
    }
    .spacer {
        flex: 1;
        pointer-events: none;
    }
`;

const control = `
    border: 1px solid ${lobby.control.border};
    border-radius: ${lobby.control.radius}px;
    background: ${lobby.control.background};
    color: ${lobby.color.controlInk};
    font: ${base.font.weight.medium} ${base.font.size.md}px/1 var(--oc-font, ${base.font.sans});
    cursor: pointer;
    transition: background ${base.motion.fast}ms ${base.motion.ease}, border-color ${base.motion.fast}ms ${base.motion.ease};
    &:hover:not(:disabled) {
        background: ${lobby.control.hover};
        border-color: ${lobby.control.hoverBorder};
    }
    &:focus-visible {
        outline: ${base.focus.width}px solid ${base.color.accent};
        outline-offset: ${base.focus.offset}px;
    }
    &:disabled {
        opacity: 0.4;
        cursor: default;
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;

const IconButton = styled.button`
    ${control}
    display: grid;
    place-items: center;
    width: ${lobby.control.size}px;
    height: ${lobby.control.size}px;
    padding: 0;
`;

const TextButton = styled.button`
    ${control}
    height: ${lobby.control.touchSize}px;
    padding: 0 12px;
    white-space: nowrap;
`;

const Primary = styled.button`
    ${control}
    height: ${lobby.control.size}px;
    margin-left: auto;
    padding: 0 16px;
    border-color: transparent;
    background: ${base.color.accent};
    color: ${base.color.white};
    &:hover:not(:disabled) {
        background: ${base.color.accentStart};
        border-color: transparent;
    }
`;

const Dock = styled.div`
    position: absolute;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    max-width: calc(100% - 24px);
    padding: 4px;
    overflow-x: auto;
    scrollbar-width: none;
    border: 1px solid ${lobby.control.border};
    border-radius: ${base.radius.card}px;
    background: ${lobby.control.background};
    .divider {
        flex: none;
        width: 1px;
        height: 20px;
        margin: 0 4px;
        background: ${base.color.line.default};
    }
`;

const DockButton = styled.button<{ $on: boolean }>`
    flex: none;
    height: 32px;
    padding: 0 12px;
    border: 0;
    border-radius: ${lobby.control.radius}px;
    background: ${(p) => (p.$on ? lobby.control.dockPressed : "transparent")};
    color: ${(p) => (p.$on ? base.color.ink : lobby.color.secondary)};
    font: ${base.font.weight.medium} ${base.font.size.md}px / 1
        var(--oc-font, ${base.font.sans});
    cursor: pointer;
    &:hover {
        background: ${(p) =>
            p.$on ? lobby.control.dockPressed : lobby.control.hover};
    }
    &:focus-visible {
        outline: ${base.focus.width}px solid ${base.color.accent};
        outline-offset: -${base.focus.offset}px;
    }
`;

const Panel = styled.aside`
    display: flex;
    flex-direction: column;
    flex: 0 0 ${PANEL}px;
    min-height: 0;
    margin: 16px 16px 16px 0;
    border: 1px solid ${lobby.panel.border};
    border-radius: ${base.radius.panel}px;
    background: ${lobby.glass.fallback};
    box-shadow: ${lobby.glass.shadow};
    overflow: hidden;
    @media (max-width: ${base.breakpoint.compact}px) {
        flex: 1;
        margin: 0;
        border-width: 1px 0 0;
        border-radius: ${base.radius.card}px ${base.radius.card}px 0 0;
    }
`;

const Tabs = styled.div`
    display: flex;
    flex: none;
    gap: 2px;
    padding: 12px 12px 8px;
    overflow-x: auto;
    scrollbar-width: none;
    border-bottom: 1px solid ${base.color.line.subtle};
`;

const Tab = styled.button<{ $on: boolean }>`
    flex: none;
    height: 32px;
    padding: 0 10px;
    border: 0;
    border-radius: ${base.radius.inset}px;
    background: ${(p) => (p.$on ? lobby.control.pressed : "transparent")};
    color: ${(p) => (p.$on ? base.color.ink : lobby.color.meta)};
    font: ${base.font.weight.medium} ${base.font.size.md}px / 1
        var(--oc-font, ${base.font.sans});
    cursor: pointer;
    &:hover {
        color: ${base.color.ink};
    }
    &:focus-visible {
        outline: ${base.focus.width}px solid ${base.color.accent};
        outline-offset: -${base.focus.offset}px;
    }
`;

const Body = styled.div`
    flex: 1;
    min-height: 0;
    padding: 4px 16px 16px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: ${base.color.line.strong} transparent;
`;

const SectionTitle = styled.h2`
    margin: 16px 0 10px;
    font: ${base.font.size.xs}px ${base.font.mono};
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${lobby.color.meta};
`;

const Starters = styled.div`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
`;

const Starter = styled.button<{ $on: boolean }>`
    ${control}
    display: flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 12px;
    text-align: left;
    background: ${(p) => (p.$on ? lobby.control.pressed : "transparent")};
    border-color: ${(p) =>
        p.$on ? lobby.panel.cardSelected : lobby.control.border};
    .chip {
        flex: none;
        width: 24px;
        height: 24px;
        border: 1px solid ${base.color.line.strong};
        border-radius: 50%;
    }
`;

const Hint = styled.p`
    margin: 12px 0 0;
    font-size: ${base.font.size.sm}px;
    color: ${lobby.color.meta};
`;

const CodeBox = styled.textarea`
    display: block;
    width: 100%;
    height: 64px;
    padding: 8px 10px;
    resize: none;
    border: 1px solid ${lobby.control.border};
    border-radius: ${base.radius.inset}px;
    background: transparent;
    color: ${lobby.color.secondary};
    font: ${base.font.size.xs}px / 1.5 ${base.font.mono};
    word-break: break-all;
    &:focus-visible {
        outline: ${base.focus.width}px solid ${base.color.accent};
        outline-offset: ${base.focus.offset}px;
    }
`;

const Actions = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
`;

const Footer = styled.footer`
    display: flex;
    flex: none;
    align-items: center;
    gap: 6px;
    padding: 12px;
    border-top: 1px solid ${base.color.line.subtle};
`;

const Toast = styled.div<{ $show: boolean }>`
    position: fixed;
    left: 50%;
    top: 16px;
    transform: translate(-50%, ${(p) => (p.$show ? 0 : -8)}px);
    padding: 8px 14px;
    border: 1px solid ${lobby.control.border};
    border-radius: ${lobby.control.radius}px;
    background: ${lobby.control.notice};
    color: ${lobby.color.noticeStrong};
    font-size: ${base.font.size.md}px;
    opacity: ${(p) => (p.$show ? 1 : 0)};
    pointer-events: none;
    transition: opacity ${base.motion.enter}ms ${base.motion.ease},
        transform ${base.motion.enter}ms ${base.motion.ease};
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;
