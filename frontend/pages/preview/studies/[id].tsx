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

const studyCases = [...manifest.cases, ...followups.cases];

const Viewer = dynamic(() => import("../../dev/procedural-avatars"), {
    ssr: false,
});

interface Props {
    id: string;
    candidate: string;
    reference: string;
    fullBody: string;
}

export default function RecipeReview({
    id,
    candidate,
    reference,
    fullBody,
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
                <a href="/preview/crowd">100-avatar crowd</a>
            </nav>
            <div className="review">
                <aside>
                    <figure>
                        <figcaption>
                            Supplied{" "}
                            {entry.framing === "portrait"
                                ? "portrait"
                                : "full body"}
                        </figcaption>
                        <img
                            src={reference}
                            alt={`Supplied drawing of ${entry.name}`}
                        />
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
                    <a
                        className="evidence"
                        href={`/preview/studies/${id}/review`}
                    >
                        Review recorded views and motion
                    </a>
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
    const entry = studyCases.find((c) => c.id === params?.id);
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
