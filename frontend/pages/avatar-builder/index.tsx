import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
    bases,
    cuts,
    decodeLook,
    encodeLook,
    kits,
    modelUrl,
    palettes,
    starters,
    type Dye,
    type Look,
} from "@features/avatar-builder/look";
import { downloadLook } from "@features/avatar-builder/modelFile";
import {
    draftKey,
    libraryKey,
    readBuilds,
    type Build,
} from "@features/avatar-builder/library";
import type { Framing, Movement } from "@features/avatar-builder/StudioView";
import s from "@features/avatar-builder/studio.module.css";

const Viewer = dynamic(() => import("@features/avatar-builder/StudioView"), {
    ssr: false,
});
const sections = [
    ["Looks", "grid"],
    ["Face", "smile"],
    ["Hair", "scissors"],
    ["Outfit", "layers"],
    ["Body", "user"],
] as const;
type Section = (typeof sections)[number][0];
export function Icon({ name }: { name: string }) {
    return (
        <i
            aria-hidden="true"
            className={s.icon}
            style={{
                maskImage: `url("/icons/${name}.svg")`,
                WebkitMaskImage: `url("/icons/${name}.svg")`,
            }}
        />
    );
}
function Swatches({
    field,
    title,
    look,
    change,
}: {
    field: Dye;
    title: string;
    look: Look;
    change: (key: Dye, v: number) => void;
}) {
    return (
        <fieldset className={s.group}>
            <legend>{title}</legend>
            <span className={s.value}>{palettes[field][look[field]][0]}</span>
            <div className={s.swatches}>
                {palettes[field].map(([label, color], i) => (
                    <button
                        key={label}
                        type="button"
                        aria-label={title + " · " + label}
                        title={label}
                        aria-pressed={i === look[field]}
                        onClick={() => change(field, i)}
                        style={{ background: color }}
                    >
                        {i === look[field] && <span className={s.swatchDot} />}
                    </button>
                ))}
            </div>
        </fieldset>
    );
}
function Slider({
    label,
    value,
    onChange,
    ends,
}: {
    label: string;
    value: number;
    onChange: (n: number) => void;
    ends: [string, string];
}) {
    return (
        <label className={s.slider}>
            <span>
                {label}
                <output>{value}</output>
            </span>
            <input
                aria-label={label}
                type="range"
                min="0"
                max="100"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                style={{
                    background: `linear-gradient(to right,var(--lime) ${value}%,#44434c ${value}%)`,
                }}
            />
            <small>
                <span>{ends[0]}</span>
                <span>{ends[1]}</span>
            </small>
        </label>
    );
}
function Options({
    title,
    values,
    chosen,
    pick,
}: {
    title: string;
    values: string[];
    chosen: number;
    pick: (n: number) => void;
}) {
    return (
        <fieldset className={s.group}>
            <legend>{title}</legend>
            <div className={s.choices}>
                {values.map((v, i) => (
                    <button
                        key={v}
                        aria-pressed={i === chosen}
                        onClick={() => pick(i)}
                    >
                        <span className={s.radio} />
                        {v}
                        {i === chosen && <Icon name="check" />}
                    </button>
                ))}
            </div>
        </fieldset>
    );
}
const titles: Record<Section, string> = {
    Looks: "Starting look",
    Face: "Face sculpt",
    Hair: "Hairstyle",
    Outfit: "Wardrobe",
    Body: "Body shape",
};
export default function AvatarStudio() {
    const [look, setLook] = useState<Look>(starters[0].look),
        [name, setName] = useState(starters[0].name),
        [id, setId] = useState("");
    const [section, setSection] = useState<Section>("Looks"),
        [framing, setFraming] = useState<Framing>("Figure"),
        [motion, setMotion] = useState<Movement>("Idle"),
        [angle, setAngle] = useState(12);
    const [status, setStatus] = useState<"ready" | "loading" | "error">(
            "loading"
        ),
        [attempt, setAttempt] = useState(0),
        [ready, setReady] = useState(false);
    const [library, setLibrary] = useState<Build[]>([]),
        [message, setMessage] = useState(""),
        [exporting, setExporting] = useState(false),
        [remove, setRemove] = useState("");
    const dialog = useRef<HTMLDialogElement>(null);
    const code = encodeLook(look);
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const shared = decodeLook(params.get("build"));
        if (shared) {
            setLook(shared);
            setName(params.get("name")?.trim().slice(0, 40) || "Custom avatar");
        }
        try {
            const [draft] = readBuilds(localStorage.getItem(draftKey));
            if (!shared && draft) {
                setLook(decodeLook(draft.code));
                setName(draft.name);
                setId(draft.id);
            }
            setLibrary(readBuilds(localStorage.getItem(libraryKey)));
        } catch {}
        setReady(true);
    }, []);
    useEffect(() => {
        if (!ready) return;
        try {
            localStorage.setItem(
                draftKey,
                JSON.stringify([{ id, name: name.trim() || "My avatar", code }])
            );
        } catch {}
    }, [ready, id, name, code]);
    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => setMessage(""), 3500);
        return () => clearTimeout(timer);
    }, [message]);
    const edit = (key: keyof Omit<Look, "base">, value: number) =>
        setLook((prev) => ({ ...prev, [key]: value }));
    const select = (t: Section) => {
        setSection(t);
        setFraming(t === "Face" || t === "Hair" ? "Portrait" : "Figure");
    };
    const starter = (index: number) => {
        setLook({ ...starters[index].look });
        setName(starters[index].name);
        setId("");
        setMotion("Idle");
    };
    const save = () => {
        const title = name.trim() || "My avatar";
        try {
            const previous = readBuilds(localStorage.getItem(libraryKey));
            const key = id || crypto.randomUUID();
            if (previous.length >= 24 && !previous.some((b) => b.id === key)) {
                setMessage(
                    "Your library is full. Remove a build to save another."
                );
                return;
            }
            const next = [
                { id: key, name: title, code },
                ...previous.filter((b) => b.id !== key),
            ];
            localStorage.setItem(libraryKey, JSON.stringify(next));
            setId(key);
            setName(title);
            setLibrary(next);
            setMessage("Saved to My builds");
        } catch {
            setMessage(
                "Browser storage is unavailable. You can still download your VRM."
            );
        }
    };
    const erase = (key: string) => {
        try {
            const next = readBuilds(localStorage.getItem(libraryKey)).filter(
                (b) => b.id !== key
            );
            localStorage.setItem(libraryKey, JSON.stringify(next));
            setLibrary(next);
            if (id === key) setId("");
            setRemove("");
        } catch {
            setMessage("Could not update My builds.");
        }
    };
    const showLibrary = () => {
        try {
            setLibrary(readBuilds(localStorage.getItem(libraryKey)));
        } catch {}
        setRemove("");
        dialog.current?.showModal();
    };
    const exportFile = async () => {
        setExporting(true);
        try {
            await downloadLook(modelUrl(look), name.trim() || "My avatar");
            setMessage("VRM download started");
        } catch {
            setMessage("Download failed. Please try again.");
        } finally {
            setExporting(false);
        }
    };
    const nextSection =
        sections[
            (sections.findIndex(([v]) => v === section) + 1) % sections.length
        ][0];
    return (
        <main className={s.studio}>
            <Head>
                <title>Avatar Studio · Oncyber</title>
                <meta
                    name="description"
                    content="Build, customize and play as your own anime avatar."
                />
            </Head>
            <header className={s.header}>
                <div className={s.brand}>
                    <img
                        src="/brand/oncyber-wordmark-white.png"
                        alt="Oncyber"
                    />
                    <b />
                    <span>Avatar Studio</span>
                </div>
                <div className={s.actions}>
                    <button className={s.libraryButton} onClick={showLibrary}>
                        <Icon name="folder" />
                        My builds
                    </button>
                    <button className={s.save} onClick={save}>
                        <Icon name="bookmark" />
                        Save build
                    </button>
                </div>
            </header>
            <div className={s.workspace}>
                <nav aria-label="Customization" className={s.rail}>
                    {sections.map(([n, icon]) => (
                        <button
                            key={n}
                            aria-pressed={n === section}
                            onClick={() => select(n)}
                        >
                            <Icon name={icon} />
                            <span>{n}</span>
                        </button>
                    ))}
                </nav>
                <section
                    className={s.stage}
                    aria-label="Avatar preview"
                    data-status={status}
                    data-base={look.base}
                    data-look={code}
                >
                    <div className={s.paper} />
                    <Viewer
                        look={look}
                        framing={framing}
                        motion={motion}
                        angle={angle}
                        onTurn={setAngle}
                        onStatus={setStatus}
                        attempt={attempt}
                    />
                    <div className={s.stageHeader}>
                        <div className={s.live}>
                            <b />
                            {status === "ready"
                                ? "Live preview"
                                : status === "error"
                                ? "Preview unavailable"
                                : "Loading avatar"}
                        </div>
                        <div className={s.camera} aria-label="Camera framing">
                            {(["Figure", "Portrait"] as const).map((v) => (
                                <button
                                    key={v}
                                    aria-pressed={v === framing}
                                    onClick={() => setFraming(v)}
                                >
                                    <Icon
                                        name={
                                            v === "Figure" ? "maximize" : "user"
                                        }
                                    />
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>
                    {status !== "ready" && (
                        <div className={s.loading} role="status">
                            {status === "error" ? (
                                <>
                                    <strong>Avatar could not load</strong>
                                    <button
                                        onClick={() => {
                                            setStatus("loading");
                                            setAttempt((v) => v + 1);
                                        }}
                                    >
                                        Try again
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className={s.spinner} />
                                    Preparing character
                                </>
                            )}
                        </div>
                    )}
                    <div className={s.stageFoot}>
                        <div className={s.stageTitle}>
                            <span>
                                {look.base === "atelier" ? "Atelier" : "Relay"}{" "}
                                series
                            </span>
                            <h1>{name.trim() || "My avatar"}</h1>
                        </div>
                        <div className={s.turn}>
                            <button
                                aria-label="Rotate left"
                                onClick={() => setAngle((a) => a - 30)}
                            >
                                <Icon name="chevron-left" />
                            </button>
                            <button
                                title="Reset rotation"
                                aria-label="Reset rotation"
                                onClick={() => setAngle(0)}
                            >
                                <Icon name="rotate-ccw" />
                            </button>
                            <button
                                aria-label="Rotate right"
                                onClick={() => setAngle((a) => a + 30)}
                            >
                                <Icon name="chevron-right" />
                            </button>
                        </div>
                    </div>
                </section>
                <aside className={s.panel}>
                    <div className={s.panelContent}>
                        <div className={s.eyebrow}>Appearance</div>
                        <h2>{titles[section]}</h2>
                        {section === "Looks" && (
                            <>
                                <div className={s.presets}>
                                    {starters.map((v, i) => (
                                        <button
                                            key={v.name}
                                            aria-label={
                                                "Use " + v.name + " starter"
                                            }
                                            aria-pressed={
                                                encodeLook(v.look) === code
                                            }
                                            onClick={() => starter(i)}
                                        >
                                            <div
                                                className={s.portrait}
                                                style={{
                                                    background: [
                                                        "#ada2c3",
                                                        "#b3c3bc",
                                                        "#d3b0aa",
                                                        "#a9b6cd",
                                                    ][i],
                                                }}
                                            >
                                                <img
                                                    src={
                                                        "/avatar-kit/" +
                                                        v.name.toLowerCase() +
                                                        ".webp"
                                                    }
                                                    alt=""
                                                />
                                                {encodeLook(v.look) ===
                                                    code && (
                                                    <b>
                                                        <Icon name="check" />
                                                    </b>
                                                )}
                                            </div>
                                            <span>
                                                {v.name}
                                                <small>{v.look.base}</small>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <label className={s.name}>
                                    Build name
                                    <input
                                        maxLength={40}
                                        value={name}
                                        onChange={(e) =>
                                            setName(e.target.value)
                                        }
                                        placeholder="My avatar"
                                    />
                                </label>
                            </>
                        )}
                        {section === "Face" && (
                            <>
                                <Swatches
                                    title="Skin tone"
                                    field="skin"
                                    look={look}
                                    change={edit}
                                />
                                <Swatches
                                    title="Iris color"
                                    field="eyes"
                                    look={look}
                                    change={edit}
                                />
                                <Slider
                                    label="Jaw width"
                                    value={look.jaw}
                                    onChange={(v) => edit("jaw", v)}
                                    ends={["Narrow", "Wide"]}
                                />
                                <Slider
                                    label="Eye size"
                                    value={look.eyeSize}
                                    onChange={(v) => edit("eyeSize", v)}
                                    ends={["Subtle", "Large"]}
                                />
                                <Slider
                                    label="Eye spacing"
                                    value={look.spacing}
                                    onChange={(v) => edit("spacing", v)}
                                    ends={["Close", "Wide"]}
                                />
                                <Slider
                                    label="Cheek fullness"
                                    value={look.cheeks}
                                    onChange={(v) => edit("cheeks", v)}
                                    ends={["Lean", "Full"]}
                                />
                                <Slider
                                    label="Nose profile"
                                    value={look.nose}
                                    onChange={(v) => edit("nose", v)}
                                    ends={["Shallow", "Defined"]}
                                />
                            </>
                        )}
                        {section === "Hair" && (
                            <>
                                <Options
                                    title="Cut"
                                    values={cuts[look.base]}
                                    chosen={look.cut}
                                    pick={(v) => edit("cut", v)}
                                />
                                <Swatches
                                    title="Hair color"
                                    field="hair"
                                    look={look}
                                    change={edit}
                                />
                            </>
                        )}
                        {section === "Outfit" && (
                            <>
                                <Options
                                    title="Style"
                                    values={kits[look.base]}
                                    chosen={look.kit}
                                    pick={(v) => edit("kit", v)}
                                />
                                <Swatches
                                    title="Fabric color"
                                    field="fabric"
                                    look={look}
                                    change={edit}
                                />
                            </>
                        )}
                        {section === "Body" && (
                            <>
                                <Options
                                    title="Base rig"
                                    values={["Atelier", "Relay"]}
                                    chosen={bases.indexOf(look.base)}
                                    pick={(i) =>
                                        setLook((last) => ({
                                            ...last,
                                            base: bases[i],
                                        }))
                                    }
                                />
                                <Slider
                                    label="Torso build"
                                    value={look.frame}
                                    onChange={(v) => edit("frame", v)}
                                    ends={["Slender", "Broad"]}
                                />
                            </>
                        )}
                        <button
                            className={s.continue}
                            onClick={() => select(nextSection)}
                        >
                            Continue to {nextSection.toLowerCase()}
                            <Icon name="arrow-right" />
                        </button>
                    </div>
                    <div className={s.deploy}>
                        <Link
                            className={s.play}
                            href={{
                                pathname: "/avatar-builder/play",
                                query: {
                                    build: code,
                                    name: name.trim() || "My avatar",
                                },
                            }}
                        >
                            Enter space
                            <Icon name="arrow-up-right" />
                        </Link>
                        <div className={s.transfer}>
                            <Link
                                href={{
                                    pathname: "/avatar-builder",
                                    query: {
                                        build: code,
                                        name: name.trim() || "My avatar",
                                    },
                                }}
                                target="_blank"
                                rel="noopener"
                                title="Open a shareable link to this build"
                            >
                                <Icon name="link" />
                                Build link
                            </Link>
                            <button onClick={exportFile} disabled={exporting}>
                                <Icon name="download" />
                                {exporting ? "Preparing VRM…" : "Download VRM"}
                            </button>
                        </div>
                    </div>
                </aside>
                <div className={s.motion}>
                    <span>
                        <Icon name="activity" />
                        Motion
                    </span>
                    <div>
                        {(["Idle", "Walk", "Run"] as const).map((v) => (
                            <button
                                key={v}
                                aria-pressed={motion === v}
                                onClick={() => setMotion(v)}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                    <small>
                        <Icon name="move" />
                        Drag to rotate
                    </small>
                </div>
            </div>
            <dialog
                ref={dialog}
                className={s.dialog}
                aria-labelledby="build-library"
            >
                <div>
                    <h2 id="build-library">My builds</h2>
                    <button
                        aria-label="Close library"
                        onClick={() => dialog.current.close()}
                    >
                        <Icon name="x" />
                    </button>
                </div>
                {!library.length ? (
                    <p>
                        Your saved characters will appear here on this device.
                    </p>
                ) : (
                    <ul>
                        {library.map((b) => (
                            <li key={b.id}>
                                <button
                                    onClick={() => {
                                        setLook(decodeLook(b.code));
                                        setName(b.name);
                                        setId(b.id);
                                        dialog.current.close();
                                    }}
                                >
                                    {b.name}
                                    <small>
                                        {decodeLook(b.code).base} series
                                    </small>
                                </button>
                                <button
                                    aria-label={"Delete " + b.name}
                                    onClick={() =>
                                        remove === b.id
                                            ? erase(b.id)
                                            : setRemove(b.id)
                                    }
                                >
                                    {remove === b.id ? (
                                        "Confirm delete"
                                    ) : (
                                        <Icon name="trash-2" />
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <details>
                    <summary>Model credits</summary>
                    <p>
                        Atelier is adapted from the twist sample by pixiv Inc.
                        Relay is adapted from Seed-san by VirtualCast, Inc. Both
                        use the VRM Public License 1.0.
                    </p>
                </details>
            </dialog>
            <div role="status" className={message ? s.notice : s.silent}>
                {message}
            </div>
        </main>
    );
}
