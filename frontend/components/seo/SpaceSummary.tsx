import styled from "styled-components";
import { SITE_NAME } from "@utils/siteMeta";
import { artworkLine, SpaceContent } from "@utils/spaceContent";
import {
    featuredNames,
    plainText,
    spaceName,
    spaceCreator,
    SpaceForSearch,
} from "@utils/structuredData";

/**
 * The text of a space page: its name, creator and description, the words
 * on its walls, the works it shows and where its portals lead. A space is
 * a canvas, so without this the page holds no words for a screen reader, a
 * search engine or an AI assistant that reads the HTML. It is rendered on
 * the server and kept out of sight and out of the tab order; the 3D
 * interface shows the same things.
 */
export default function SpaceSummary({
    space,
    featuring = [],
    content,
    gallery,
}: {
    space: SpaceForSearch;
    featuring?: string[];
    content?: SpaceContent;
    /** The gallery or world the space is built in, when it has a name. */
    gallery?: string;
}) {
    const name = spaceName(space);
    if (!name) return null;
    const creator = spaceCreator(space);
    const paragraphs = String(space.info?.description ?? "")
        .slice(0, 2000)
        .split(/\n\s*\n/)
        .map((paragraph) => plainText(paragraph))
        .filter(Boolean);
    // With the space's content read, its artists are known; the names from
    // the head tags mix in the titles of works, which are listed below.
    const names = content ? content.artists : featuredNames(featuring);
    const builtIn = plainText(gallery);
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
                .{builtIn && builtIn !== name && ` Built in ${builtIn}.`}
                {content?.visits > 0 &&
                    ` ${content.visits.toLocaleString("en-US")} visits.`}
                {content?.modified && (
                    <>
                        {" Updated "}
                        <time dateTime={content.modified}>
                            {content.modified}
                        </time>
                        .
                    </>
                )}
            </p>
            {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
            ))}
            {names.length > 0 && (
                <>
                    <h2>Artists and collections</h2>
                    <p>Featuring {names.slice(0, 40).join(", ")}.</p>
                </>
            )}
            {content?.texts.length > 0 && (
                <>
                    <h2>In this space</h2>
                    {content.texts.map((text, index) => (
                        <p key={index}>{text}</p>
                    ))}
                </>
            )}
            {content?.artworks.length > 0 && (
                <>
                    <h2>Works on show</h2>
                    <ul>
                        {content.artworks.map((work, index) => (
                            <li key={index}>
                                {artworkLine(work)}
                                {work.description && `: ${work.description}`}
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {content?.siblings?.length > 0 && (
                <>
                    <h2>More spaces by {creator?.name || "this creator"}</h2>
                    <ul>
                        {content.siblings.map((sibling) => (
                            <li key={sibling.id}>
                                <a href={sibling.path} tabIndex={-1}>
                                    {sibling.name}
                                </a>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {content?.portals.length > 0 && (
                <>
                    <h2>Portals to other spaces</h2>
                    <ul>
                        {content.portals.map((id) => (
                            <li key={id}>
                                <a href={`/spaces/${id}`} tabIndex={-1}>
                                    Space {id}
                                </a>
                            </li>
                        ))}
                    </ul>
                </>
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
