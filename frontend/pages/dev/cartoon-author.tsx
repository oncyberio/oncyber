import { useEffect, useRef, useState } from "react";
import AvatarStudy, { type Subject } from "./procedural-avatars";
import { readAvatarFile } from "@features/procedural-avatars/avatarFile";
import {
    loadRecipeForUrl,
    previewRecipe,
} from "@features/procedural-avatars/catalog";

export default function CartoonAuthor() {
    const [error, setError] = useState("");
    const [ready, setReady] = useState(false);
    const [preview, setPreview] = useState<{
        subjects: Subject[];
        release?: () => void;
    }>();
    const generation = useRef(0);
    useEffect(() => {
        const token = ++generation.current;
        setReady(true);
        const id = new URLSearchParams(window.location.search).get("character");
        if (id && /^[a-z][a-z0-9-]{0,63}$/.test(id)) {
            const source = "drawn-" + id;
            void loadRecipeForUrl("/models/procedural/" + source)
                .then((recipe) => {
                    if (token !== generation.current || !recipe) return;
                    setPreview({
                        subjects: [
                            {
                                id: "authored",
                                template: recipe.template,
                                source,
                                name: id
                                    .split("-")
                                    .map((w) => w[0].toUpperCase() + w.slice(1))
                                    .join(" "),
                                layout: recipe.layout,
                                orbScale: recipe.orbScale,
                                posedTPose:
                                    !recipe.cartoon ||
                                    !!recipe.cartoon.fit?.sections,
                                coat: !!recipe.cartoon?.fit?.sections?.coat,
                            },
                        ],
                    });
                })
                .catch((reason) => {
                    if (token === generation.current) setError(String(reason));
                });
        }
        return () => {
            generation.current++;
        };
    }, []);
    useEffect(() => () => preview?.release?.(), [preview]);
    async function open(file: File) {
        const token = ++generation.current;
        try {
            if (file.size > 128 * 1024)
                throw Error("The recipe exceeds 128 KiB.");
            const drawing = readAvatarFile(JSON.parse(await file.text()));
            if (token !== generation.current) return;
            const entry = previewRecipe(drawing.recipe);
            setPreview({
                subjects: [
                    {
                        id: "authored",
                        posedTPose:
                            !drawing.recipe.cartoon ||
                            !!drawing.recipe.cartoon.fit?.sections,
                        coat: !!drawing.recipe.cartoon?.fit?.sections?.coat,
                        name: drawing.name,
                        template: drawing.recipe.template,
                        source: entry.slug,
                        layout: entry.recipe.layout,
                        orbScale: entry.recipe.orbScale,
                    },
                ],
                release: entry.release,
            });
            setError("");
        } catch (e) {
            if (token === generation.current)
                setError(e instanceof Error ? e.message : "Invalid recipe");
        }
    }
    return (
        <>
            <header
                style={{
                    padding: "12px 4vw",
                    background: "#f7f5ef",
                    fontFamily: "system-ui",
                }}
            >
                <label>
                    Open cartoon recipe{" "}
                    <input
                        type="file"
                        disabled={!ready}
                        accept=".json,application/json"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void open(f);
                        }}
                    />
                </label>
                {error && <p role="alert">{error}</p>}
            </header>
            {preview && (
                <AvatarStudy
                    key={preview.subjects[0].source}
                    customSubjects={preview.subjects}
                />
            )}
        </>
    );
}

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
