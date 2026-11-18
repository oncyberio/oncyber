import Head from "next/head";
import { jsonLdScript } from "@utils/structuredData";

/**
 * Structured data for the page, in the document head. `id` keeps one copy
 * when a page and the default head both describe the same thing.
 */
export default function JsonLd({
    id,
    data,
}: {
    id: string;
    data: Record<string, unknown> | null;
}) {
    if (!data) return null;
    return (
        <Head>
            <script
                key={`jsonld:${id}`}
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }}
            />
        </Head>
    );
}
