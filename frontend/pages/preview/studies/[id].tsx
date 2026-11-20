import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { GetStaticPaths, GetStaticProps } from "next";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { readAvatarFile } from "@features/procedural-avatars/avatarFile";
import { previewRecipe } from "@features/procedural-avatars/catalog";
import type { Subject } from "../../dev/procedural-avatars";
import manifest from "../../../scripts/avatar_authoring/targets/holdout-v1/manifest.json";
import followups from "../../../scripts/avatar_authoring/targets/holdout-v1/followup-studies.json";
import results from "../../../scripts/avatar_authoring/targets/holdout-v1/results.json";

const streetwear = {
    id: "vale-streetwear",
    name: "Vale",
    framing: "turnaround",
};
const studyCases = [...manifest.cases, ...followups.cases, streetwear];

const Viewer = dynamic(() => import("../../dev/procedural-avatars"), {
    ssr: false,
});

interface Props {
    id: string;
    candidate: string;
    reference: string;
    fullBody: string;
    evidence?: {
        comparison: string;
        triangles: number;
        frontOverlap: number;
        profileOverlap: number;
        captures: { mode: string; views: string; walk: string }[];
    };
}

export default function RecipeReview({
    id,
    candidate,
    reference,
    fullBody,
    evidence,
}: Props) {
    const [subjects, setSubjects] = useState<Subject[]>();
    useEffect(() => {
        const { recipe, name } = readAvatarFile(JSON.parse(candidate));
        const local = previewRecipe(recipe);
        setSubjects([
            {
                id: "authored",
                name,
                template: recipe.template,
                source: local.slug,
                layout: recipe.layout,
                orbScale: recipe.orbScale,
                posedTPose: true,
                coat: !!recipe.cartoon?.fit?.sections?.coat,
            },
        ]);
        return local.release;
    }, [candidate]);
    const entry = studyCases.find((c) => c.id === id);
    return (
        <>
            <nav aria-label="Avatar studies">
                {studyCases.map(({ id: slug, name }) => (
                    <a
                        key={slug}
                        href={`/preview/studies/${slug}`}
                        aria-current={id === slug ? "page" : undefined}
                    >
                        {name}
                    </a>
                ))}
                <a href="/preview/crowd">
                    {evidence ? "100-avatar cartoon crowd" : "100-avatar crowd"}
                </a>
            </nav>
            <div className="review">
                <aside>
                    <figure>
                        <figcaption>
                            {evidence
                                ? "Generated T-pose and profile"
                                : entry.framing === "portrait"
                                ? "Supplied portrait"
                                : "Supplied full body"}
                        </figcaption>
                        <a href={reference} target="_blank" rel="noreferrer">
                            <img
                                src={reference}
                                alt={`Reference drawing of ${entry.name}`}
                            />
                        </a>
                    </figure>
                    {reference !== fullBody && (
                        <details>
                            <summary>Withheld full body</summary>
                            <img
                                src={fullBody}
                                alt={`Complete evaluation drawing of ${entry.name}`}
                            />
                        </details>
                    )}
                    {evidence ? (
                        <>
                            <a className="evidence" href="/preview/vale">
                                Walk around as Vale
                            </a>
                            <p>
                                {evidence.triangles.toLocaleString("en-US")}{" "}
                                triangles · one skinned mesh
                            </p>
                            <figure>
                                <figcaption>
                                    Drawing and native render
                                </figcaption>
                                <a
                                    href={evidence.comparison}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <img
                                        src={evidence.comparison}
                                        alt="Source and measured avatar at the front and in profile"
                                    />
                                </a>
                            </figure>
                            <p>
                                Silhouette overlap with the drawing is{" "}
                                {evidence.frontOverlap}% from the front and{" "}
                                {evidence.profileOverlap}% in profile.
                            </p>
                            {evidence.captures.map(({ mode, views, walk }) => (
                                <details key={mode}>
                                    <summary>{mode} turns and motion</summary>
                                    <a
                                        href={views}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <img
                                            src={views}
                                            alt={
                                                mode +
                                                " turns, crouch and both grips"
                                            }
                                        />
                                    </a>
                                    <a className="evidence" href={walk}>
                                        Play recorded walk
                                    </a>
                                </details>
                            ))}
                        </>
                    ) : (
                        <a
                            className="evidence"
                            href={`/preview/studies/${id}/review`}
                        >
                            Review recorded views and motion
                        </a>
                    )}
                </aside>
                <div className="viewer">
                    {subjects ? (
                        <Viewer
                            customSubjects={subjects}
                            key={subjects[0].source}
                        />
                    ) : (
                        <p role="status">Loading {entry.name}…</p>
                    )}
                </div>
            </div>
            <style jsx>{`
                nav,
                aside,
                .viewer > p {
                    font-family: "DM Sans", system-ui, sans-serif;
                }
                nav {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px 20px;
                    padding: 14px 3vw;
                    background: #292927;
                }
                a {
                    color: #f5f2e9;
                    padding: 4px 0;
                    text-underline-offset: 5px;
                }
                a:not([aria-current]) {
                    text-decoration: none;
                }
                a:focus-visible,
                a:hover {
                    text-decoration: underline;
                }
                a.evidence {
                    color: #313932;
                    text-decoration: underline;
                    display: inline-block;
                    margin: 16px 0;
                }
                .review {
                    display: grid;
                    grid-template-columns: minmax(160px, 24%) minmax(0, 1fr);
                    background: #f7f5ef;
                    color: #292927;
                }
                aside {
                    padding: 17px 12px;
                }
                figure {
                    margin: 0;
                }
                figcaption,
                summary {
                    margin: 6px 0 12px;
                    font-weight: 600;
                }
                img {
                    display: block;
                    width: 100%;
                    height: auto;
                }
                details {
                    margin-top: 20px;
                }
                summary {
                    cursor: pointer;
                }
                @media (max-width: 760px) {
                    .review {
                        display: flex;
                        flex-direction: column;
                    }
                    aside {
                        display: flex;
                        align-items: flex-start;
                        gap: 18px;
                        flex-wrap: wrap;
                    }
                    aside img {
                        object-fit: contain;
                        width: auto;
                        max-width: 42vw;
                        max-height: 160px;
                    }
                    details {
                        margin-top: 0;
                    }
                }
            `}</style>
        </>
    );
}

export const getStaticPaths: GetStaticPaths = () => ({
    paths:
        process.env.NODE_ENV === "development" ||
        process.env.VERCEL_ENV === "preview"
            ? studyCases.map(({ id }) => ({ params: { id } }))
            : [],
    fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
    if (params?.id === streetwear.id) {
        const { default: report } = await import(
            "../../../scripts/avatar_authoring/targets/streetwear-v1/measurements.json"
        );
        const root = path.join(
            process.cwd(),
            "public/lobby/procedural/recipes",
            streetwear.id + ".json"
        );
        const candidate = await fs.readFile(root, "utf8");
        if (
            createHash("sha256").update(candidate).digest("hex") !==
            report.recipe_sha256
        )
            throw Error("Streetwear preview differs from the measured recipe");
        async function asset(file: string, checksum: string) {
            const folder = path.join(
                process.cwd(),
                "scripts/avatar_authoring/targets/streetwear-v1"
            );
            const bytes = await fs.readFile(path.join(folder, file + ".webp"));
            if (
                createHash("sha256")
                    .update(new Uint8Array(bytes))
                    .digest("hex") !== checksum
            )
                throw Error("Streetwear study asset changed: " + file);
            return (
                await import(
                    `../../../scripts/avatar_authoring/targets/streetwear-v1/${file}.webp`
                )
            ).default.src;
        }
        const reference = await asset(
            "vale-turnaround",
            report.turnaround_sha256
        );
        const benchmark = report.backends.WebGLBackend;
        return {
            props: {
                id: streetwear.id,
                candidate,
                reference,
                fullBody: reference,
                evidence: {
                    comparison: await asset(
                        "vale-comparison",
                        report.comparison_sha256
                    ),
                    triangles: benchmark.triangles,
                    frontOverlap:
                        Math.round(benchmark.silhouette_iou.front * 1000) / 10,
                    profileOverlap:
                        Math.round(benchmark.silhouette_iou.profile * 1000) /
                        10,
                    captures: await Promise.all(
                        ["WebGLBackend", "WebGPUBackend"].map(
                            async (backend) => ({
                                mode:
                                    backend === "WebGLBackend"
                                        ? "WebGL2"
                                        : "WebGPU",
                                views: await asset(
                                    "vale-" + backend + "-views",
                                    report.captures[backend].views
                                ),
                                walk: await asset(
                                    "vale-" + backend + "-walk",
                                    report.captures[backend].walk
                                ),
                            })
                        )
                    ),
                },
            },
        };
    }
    const entry = [...manifest.cases, ...followups.cases].find(
        (c) => c.id === params?.id
    );
    if (!entry) return { notFound: true };
    const folder = path.join(
        process.cwd(),
        "scripts/avatar_authoring/targets/holdout-v1/candidates"
    );
    const candidate = await fs.readFile(
        path.join(folder, entry.id + ".recipe"),
        "utf8"
    );
    const measuredHash =
        results.preview.candidate_sha256[entry.id] ??
        followups.receipts[entry.id]?.candidate_sha256;
    if (createHash("sha256").update(candidate).digest("hex") !== measuredHash)
        throw Error("The preview recipe differs from the measured candidate");
    async function image(name: string): Promise<string> {
        const asset = await import(
            `../../../scripts/avatar_authoring/targets/holdout-v1/${name.slice(
                0,
                -5
            )}.webp`
        );
        return asset.default.src;
    }
    return {
        props: {
            id: entry.id,
            candidate,
            reference: await image(entry.input),
            fullBody: await image(entry.evaluation_reference),
        },
    };
};
