import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { GetStaticPaths, GetStaticProps } from "next";
import { useState } from "react";
import manifest from "../../../../scripts/avatar_authoring/targets/holdout-v1/manifest.json";
import followups from "../../../../scripts/avatar_authoring/targets/holdout-v1/followup-studies.json";
import archive from "../../../../scripts/avatar_authoring/targets/holdout-v1/results.json";

const studyCases = [...manifest.cases, ...followups.cases];

const criteria = {
    likeness: "Likeness",
    profile: "Profile and rear",
    eyes: "Eyes and pupils",
    garments: "Clothing",
    body: "Proportions and anatomy",
    motion: "Walk and crouch",
    grip: "Both hands hold and release the item",
};
type Check = keyof typeof criteria;
const checks = Object.keys(criteria) as Check[];
const modes = ["WebGLBackend", "WebGPUBackend"] as const;
type Backend = (typeof modes)[number];
const rendererNames = { WebGLBackend: "WebGL2", WebGPUBackend: "WebGPU" };
type Images = Record<Backend, { views: string; walk: string }>;
interface Props {
    id: string;
    name: string;
    reference: string;
    input: string;
    referenceHash: string;
    evidenceHash: string;
    images: Images;
    inferred: boolean;
}

export default function RecordedReview(props: Props) {
    return <ReviewForm key={props.evidenceHash} {...props} />;
}

function ReviewForm({
    id,
    name,
    reference,
    input,
    referenceHash,
    evidenceHash,
    images,
    inferred,
}: Props) {
    const [backend, setBackend] = useState<Backend>("WebGLBackend");
    const [reviewer, setReviewer] = useState("");
    const [notes, setNotes] = useState("");
    const [marks, setMarks] = useState<Partial<Record<Check, boolean>>>({});
    function download() {
        if (!reviewer.trim() || checks.some((k) => marks[k] === undefined))
            return;
        const record = {
            kind: "human",
            reviewer: reviewer.trim(),
            evidence: evidenceHash,
            reference: referenceHash,
            checks: marks,
            reason: notes.trim(),
        };
        const url = URL.createObjectURL(
            new Blob([JSON.stringify(record, null, 2) + "\n"], {
                type: "application/json",
            })
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = id + "-visual-review.json";
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return (
        <main>
            <a href={`/preview/studies/${id}`}>← Interactive {name}</a>
            <h1>{name} visual review</h1>
            <div className="comparison">
                <figure>
                    <figcaption>
                        {inferred
                            ? "Withheld full-body reference"
                            : "Supplied drawing"}
                    </figcaption>
                    <a href={reference} target="_blank" rel="noreferrer">
                        <img
                            src={reference}
                            alt={`${name} full-body reference`}
                        />
                    </a>
                    {inferred && (
                        <details>
                            <summary>Supplied portrait</summary>
                            <img
                                src={input}
                                alt={`Portrait used to generate ${name}`}
                            />
                        </details>
                    )}
                </figure>
                <section aria-label="Recorded native evidence">
                    <label>
                        Recorded renderer{" "}
                        <select
                            value={backend}
                            onChange={(e) =>
                                setBackend(e.target.value as Backend)
                            }
                        >
                            {modes.map((m) => (
                                <option key={m} value={m}>
                                    {rendererNames[m]}
                                </option>
                            ))}
                        </select>
                    </label>
                    <a
                        href={images[backend].views}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <img
                            src={images[backend].views}
                            alt={`${rendererNames[backend]} body and face turnarounds, crouch and close-ups of both microphone grips`}
                        />
                    </a>
                    <details>
                        <summary>Play recorded walk with held item</summary>
                        <img
                            src={images[backend].walk}
                            alt={`${name} walking with an item in the right hand`}
                        />
                    </details>
                </section>
            </div>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    download();
                }}
            >
                <h2>Independent assessment</h2>
                <label>
                    Reviewer{" "}
                    <input
                        required
                        value={reviewer}
                        onChange={(e) => setReviewer(e.target.value)}
                    />
                </label>
                <div className="checks">
                    {checks.map((k) => (
                        <fieldset key={k}>
                            <legend>{criteria[k]}</legend>
                            {[true, false].map((v) => (
                                <label key={String(v)}>
                                    <input
                                        type="radio"
                                        required
                                        name={k}
                                        checked={marks[k] === v}
                                        onChange={() =>
                                            setMarks({ ...marks, [k]: v })
                                        }
                                    />{" "}
                                    {v ? "Pass" : "Miss"}
                                </label>
                            ))}
                        </fieldset>
                    ))}
                </div>
                <label>
                    Review notes{" "}
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </label>
                <button
                    type="submit"
                    disabled={
                        !reviewer.trim() ||
                        checks.some((k) => marks[k] === undefined)
                    }
                >
                    Download review JSON
                </button>
            </form>
            <style jsx>{`
                main {
                    margin: auto;
                    max-width: 1320px;
                    padding: 32px clamp(16px, 4vw, 52px);
                    background: #f8f6f1;
                    color: #272923;
                    font-family: "DM Sans", system-ui, sans-serif;
                }
                a {
                    color: #334c40;
                }
                h1 {
                    font-size: clamp(28px, 4vw, 48px);
                    margin: 20px 0;
                }
                .comparison {
                    display: grid;
                    grid-template-columns: minmax(170px, 0.38fr) minmax(0, 1fr);
                    gap: 24px;
                }
                figure {
                    margin: 0;
                }
                figcaption,
                label,
                summary {
                    font-weight: 600;
                }
                img {
                    display: block;
                    width: 100%;
                    height: auto;
                    margin-top: 8px;
                }
                select,
                input,
                textarea,
                button {
                    font: inherit;
                }
                select,
                textarea,
                input:not([type="radio"]),
                button {
                    padding: 8px;
                    border-radius: 4px;
                    border: 1px solid #92968a;
                }
                summary {
                    cursor: pointer;
                    padding: 14px 0;
                }
                form {
                    max-width: 840px;
                    margin: 32px 0;
                }
                .checks {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
                    gap: 12px;
                    margin: 16px 0;
                }
                fieldset {
                    margin: 0;
                    border: 1px solid #c7c9bc;
                    padding: 8px;
                }
                fieldset label {
                    font-weight: 400;
                    margin-right: 12px;
                    white-space: nowrap;
                }
                textarea {
                    display: block;
                    width: 100%;
                    box-sizing: border-box;
                    min-height: 60px;
                    margin: 6px 0 12px;
                }
                button {
                    background: #31483b;
                    color: white;
                    cursor: pointer;
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: default;
                }
                @media (max-width: 700px) {
                    .comparison {
                        grid-template-columns: 1fr;
                    }
                    figure img {
                        max-height: 220px;
                        object-fit: contain;
                        width: auto;
                        max-width: 100%;
                    }
                }
            `}</style>
        </main>
    );
}

export const getStaticPaths: GetStaticPaths = () => ({
    paths:
        process.env.NODE_ENV === "development" ||
        process.env.VERCEL_ENV === "preview"
            ? studyCases.map((c) => ({ params: { id: c.id } }))
            : [],
    fallback: false,
});
export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
    const entry = studyCases.find((c) => c.id === params?.id);
    if (!entry) return { notFound: true };
    const run = archive.runs[archive.preview.run];
    const receipt = run.cases[entry.id] ?? followups.receipts[entry.id];
    if (!receipt?.review_assets) return { notFound: true };
    const images = {} as Images;
    const root = path.join(
        process.cwd(),
        "scripts/avatar_authoring/targets/holdout-v1"
    );
    const hash = async (file: string) =>
        createHash("sha256")
            .update(new Uint8Array(await fs.readFile(path.join(root, file))))
            .digest("hex");
    if ((await hash(entry.evaluation_reference)) !== entry.reference_sha256)
        throw Error("The review reference changed");
    if (
        entry.input !== entry.evaluation_reference &&
        (await hash(entry.input)) !== entry.input_sha256
    )
        throw Error("The authoring input changed");
    for (const backend of modes) {
        const item = {} as Images[Backend];
        for (const key of ["views", "walk"] as const) {
            const name = `${entry.id}-${backend}-${key}`;
            if (
                (await hash(`reviews/${name}.webp`)) !==
                receipt.review_assets[backend][key]
            )
                throw Error("The native review capture changed");
            const asset = await import(
                `../../../../scripts/avatar_authoring/targets/holdout-v1/reviews/${name}.webp`
            );
            item[key] = asset.default.src;
        }
        images[backend] = item;
    }
    const sourceImage = async (file: string) =>
        (
            await import(
                `../../../../scripts/avatar_authoring/targets/holdout-v1/${file.slice(
                    0,
                    -5
                )}.webp`
            )
        ).default.src;
    return {
        props: {
            id: entry.id,
            name: entry.name,
            reference: await sourceImage(entry.evaluation_reference),
            input: await sourceImage(entry.input),
            referenceHash: entry.reference_sha256,
            evidenceHash: receipt.evidence_sha256,
            images,
            inferred: entry.framing === "portrait",
        },
    };
};
