import { Fragment, ReactNode } from "react";
import Link from "next/link";
import CodeBlock from "./CodeBlock";

/**
 * A small Markdown renderer for the docs pages: headings, paragraphs, lists,
 * tables, fenced code, inline code, bold and links. No raw HTML is rendered.
 *
 * A block between `:::details Summary` and `:::` renders as a closed
 * dropdown, for technical detail most readers can skip.
 */

type Block =
    | { type: "heading"; level: number; text: string }
    | { type: "paragraph"; text: string }
    | { type: "list"; ordered: boolean; items: string[] }
    | { type: "table"; head: string[]; rows: string[][] }
    | { type: "code"; lang: string; code: string }
    | { type: "details"; summary: string; blocks: Block[] };

const DETAILS_OPEN = /^:::details\s+(.*)$/;
const DETAILS_CLOSE = /^:::\s*$/;

export function slugify(text: string) {
    return text
        .toLowerCase()
        .replace(/[`*]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

const cells = (line: string) =>
    line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim());

export function parseBlocks(source: string): Block[] {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const blocks: Block[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) {
            i++;
            continue;
        }
        const details = line.match(DETAILS_OPEN);
        if (details) {
            const inner: string[] = [];
            let inFence = false;
            i++;
            while (
                i < lines.length &&
                (inFence || !DETAILS_CLOSE.test(lines[i]))
            ) {
                if (lines[i].startsWith("```")) inFence = !inFence;
                inner.push(lines[i++]);
            }
            i++;
            blocks.push({
                type: "details",
                summary: details[1].trim(),
                blocks: parseBlocks(inner.join("\n")),
            });
            continue;
        }
        const fence = line.match(/^```(\w*)/);
        if (fence) {
            const code: string[] = [];
            i++;
            while (i < lines.length && !lines[i].startsWith("```"))
                code.push(lines[i++]);
            i++;
            blocks.push({
                type: "code",
                lang: fence[1],
                code: code.join("\n"),
            });
            continue;
        }
        const heading = line.match(/^(#{1,4})\s+(.*)$/);
        if (heading) {
            blocks.push({
                type: "heading",
                level: heading[1].length,
                text: heading[2],
            });
            i++;
            continue;
        }
        if (
            line.trim().startsWith("|") &&
            lines[i + 1]?.match(/^\s*\|[\s|:-]+\|\s*$/)
        ) {
            const head = cells(line);
            const rows: string[][] = [];
            i += 2;
            while (i < lines.length && lines[i].trim().startsWith("|"))
                rows.push(cells(lines[i++]));
            blocks.push({ type: "table", head, rows });
            continue;
        }
        const item = /^(\s*)([-*]|\d+\.)\s+/;
        if (item.test(line)) {
            const ordered = /^\s*\d+\./.test(line);
            const items: string[] = [];
            while (
                i < lines.length &&
                lines[i].trim() &&
                !lines[i].startsWith(":::")
            ) {
                if (item.test(lines[i])) items.push(lines[i].replace(item, ""));
                else items[items.length - 1] += ` ${lines[i].trim()}`;
                i++;
            }
            blocks.push({ type: "list", ordered, items });
            continue;
        }
        const text: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() &&
            !/^(#{1,4}\s|```|:::|\s*([-*]|\d+\.)\s)/.test(lines[i]) &&
            !lines[i].trim().startsWith("|")
        )
            text.push(lines[i++].trim());
        blocks.push({ type: "paragraph", text: text.join(" ") });
    }
    return blocks;
}

function inline(text: string): ReactNode[] {
    const out: ReactNode[] = [];
    const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = pattern.exec(text))) {
        if (match.index > last) out.push(text.slice(last, match.index));
        if (match[1] !== undefined)
            out.push(<code key={key++}>{match[1]}</code>);
        else if (match[2] !== undefined)
            out.push(<strong key={key++}>{inline(match[2])}</strong>);
        else {
            const href = match[4];
            const internal = href.startsWith("/") && !href.startsWith("//");
            const safe = internal || /^https?:\/\//.test(href);
            out.push(
                !safe ? (
                    match[3]
                ) : internal ? (
                    <Link key={key++} href={href}>
                        {inline(match[3])}
                    </Link>
                ) : (
                    <a key={key++} href={href} target="_blank" rel="noreferrer">
                        {inline(match[3])}
                    </a>
                )
            );
        }
        last = pattern.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

export function headingsOf(source: string) {
    return parseBlocks(source)
        .filter(
            (block): block is Extract<Block, { type: "heading" }> =>
                block.type === "heading" && block.level === 2
        )
        .map((block) => ({ id: slugify(block.text), text: block.text }));
}

export default function Markdown({ source }: { source: string }) {
    return <>{renderBlocks(parseBlocks(source))}</>;
}

function renderBlocks(blocks: Block[]): ReactNode {
    return (
        <>
            {blocks.map((block, index) => {
                switch (block.type) {
                    case "heading": {
                        const Tag = `h${block.level}` as "h1";
                        return (
                            <Tag key={index} id={slugify(block.text)}>
                                {inline(block.text)}
                            </Tag>
                        );
                    }
                    case "paragraph":
                        return <p key={index}>{inline(block.text)}</p>;
                    case "list": {
                        const Tag = block.ordered ? "ol" : "ul";
                        return (
                            <Tag key={index}>
                                {block.items.map((item, n) => (
                                    <li key={n}>{inline(item)}</li>
                                ))}
                            </Tag>
                        );
                    }
                    case "table":
                        return (
                            <div className="table" key={index}>
                                <table>
                                    <thead>
                                        <tr>
                                            {block.head.map((cell, n) => (
                                                <th key={n}>{inline(cell)}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {block.rows.map((row, r) => (
                                            <tr key={r}>
                                                {row.map((cell, n) => (
                                                    <td key={n}>
                                                        {inline(cell)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    case "code":
                        return (
                            <CodeBlock
                                key={index}
                                lang={block.lang}
                                code={block.code}
                            />
                        );
                    case "details":
                        return (
                            <details key={index} className="details">
                                <summary>{inline(block.summary)}</summary>
                                {renderBlocks(block.blocks)}
                            </details>
                        );
                    default:
                        return <Fragment key={index} />;
                }
            })}
        </>
    );
}
