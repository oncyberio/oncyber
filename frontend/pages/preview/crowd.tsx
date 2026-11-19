import { promises as fs } from "fs";
import path from "path";
import type { GetStaticProps } from "next";
import dynamic from "next/dynamic";
import manifest from "../../scripts/avatar_authoring/targets/holdout-v1/manifest.json";

export default dynamic(() => import("../dev/procedural-crowd"), { ssr: false });

export const getStaticProps: GetStaticProps = async () => {
    if (
        process.env.NODE_ENV !== "development" &&
        process.env.VERCEL_ENV !== "preview"
    )
        return { notFound: true };
    const dir = path.join(
        process.cwd(),
        "scripts/avatar_authoring/targets/holdout-v1/candidates"
    );
    const seeds = await Promise.all(
        manifest.cases.map(({ id }) =>
            fs.readFile(path.join(dir, id + ".recipe"), "utf8")
        )
    );
    return { props: { seeds } };
};
