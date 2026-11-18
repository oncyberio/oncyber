import styled from "styled-components";
import { SITE_NAME } from "@utils/siteMeta";
import {
    featuredNames,
    plainText,
    spaceCreator,
    SpaceForSearch,
} from "@utils/structuredData";

/**
 * The text of a space page: its name, creator, description and what it
 * shows. A space is a canvas, so without this the page holds no words for
 * a screen reader, a search engine or an AI assistant that reads the HTML.
 * It is rendered on the server and kept out of sight and out of the tab
 * order; the 3D interface shows the same details.
 */
export default function SpaceSummary({
    space,
    featuring = [],
}: {
    space: SpaceForSearch;
    featuring?: string[];
}) {
    const name = plainText(space?.info?.headline);
    if (!name) return null;
    const creator = spaceCreator(space);
    const paragraphs = String(space.info?.description ?? "")
        .slice(0, 2000)
        .split(/\n\s*\n/)
        .map((paragraph) => plainText(paragraph))
        .filter(Boolean);
    const names = featuredNames(featuring);
    return (
        <Hidden aria-label="About this space">
            <h1>{name}</h1>
            <p>
                3D space
                {creator && (
                    <>
                        {" by "}
                        <a href={creator.path} tabIndex={-1}>
                            {creator.name}
                        </a>
                    </>
                )}
                {" on "}
                <a href="/" tabIndex={-1}>
                    {SITE_NAME}
                </a>
                .
            </p>
            {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
            ))}
            {names.length > 0 && (
                <p>Featuring {names.slice(0, 30).join(", ")}.</p>
            )}
        </Hidden>
    );
}

const Hidden = styled.section`
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
`;
