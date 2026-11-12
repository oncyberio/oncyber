import type { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import styled, { css } from "styled-components";
import {
    actionSpec,
    brandFoundation,
    outlineAction,
    pillAction,
} from "@styles/brand";
import { baseTokens as base } from "@styles/tokens/base";
import Markdown, { headingsOf } from "@features/docs/markdown";
import CopyPromptButton from "@features/docs/CopyPromptButton";
import type { DocPage } from "@features/docs/content";

interface Props {
    doc: DocPage;
    nav: { slug: string; title: string }[];
}

const href = (slug: string) => (slug ? `/docs/${slug}` : "/docs");

export default function DocsPage({ doc, nav }: Props) {
    const headings = headingsOf(doc.body);
    const index = nav.findIndex((entry) => entry.slug === doc.slug);
    const previous = nav[index - 1];
    const next = nav[index + 1];
    return (
        <Page>
            <Head>
                <title>{`${doc.title} · Oncyber docs`}</title>
                <meta name="description" content={doc.description} />
                <link
                    rel="alternate"
                    type="text/markdown"
                    href={`${href(doc.slug)}.md`}
                />
            </Head>
            <header className="docs-top">
                <Link href="/" className="brand" aria-label="Oncyber home">
                    <img
                        src="/brand/oncyber-wordmark-white.png"
                        alt="Oncyber"
                    />
                </Link>
                <Link href="/docs" className="section">
                    Docs
                </Link>
                <CopyPromptButton />
                <a
                    className="source"
                    href="https://github.com/oncyberio/oncyber"
                    target="_blank"
                    rel="noreferrer"
                >
                    GitHub ↗
                </a>
            </header>
            <div className="docs-layout">
                <nav className="docs-nav" aria-label="Docs">
                    {nav.map((entry) => (
                        <Link
                            key={entry.slug}
                            href={href(entry.slug)}
                            aria-current={
                                entry.slug === doc.slug ? "page" : undefined
                            }
                        >
                            {entry.slug ? entry.title : "Overview"}
                        </Link>
                    ))}
                </nav>
                <main className="docs-body">
                    <Markdown source={doc.body} />
                    <footer className="docs-pager">
                        {previous ? (
                            <Link href={href(previous.slug)} className="prev">
                                <span>Previous</span>
                                {previous.slug ? previous.title : "Overview"}
                            </Link>
                        ) : (
                            <span />
                        )}
                        {next && (
                            <Link href={href(next.slug)} className="next">
                                <span>Next</span>
                                {next.title}
                            </Link>
                        )}
                    </footer>
                </main>
                {headings.length > 1 && (
                    <aside className="docs-toc" aria-label="On this page">
                        <span>On this page</span>
                        {headings.map((heading) => (
                            <a key={heading.id} href={`#${heading.id}`}>
                                {heading.text.replace(/`/g, "")}
                            </a>
                        ))}
                    </aside>
                )}
            </div>
        </Page>
    );
}

export const getStaticPaths: GetStaticPaths = async ({ locales }) => {
    const { allDocs } = await import("@features/docs/content");
    const docs = allDocs();
    return {
        paths: (locales || [undefined]).flatMap((locale) =>
            docs.map((doc) => ({
                params: { slug: doc.slug ? [doc.slug] : [] },
                locale,
            }))
        ),
        fallback: false,
    };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
    const { allDocs } = await import("@features/docs/content");
    const docs = allDocs();
    const slug = ((params?.slug as string[]) || []).join("/");
    const doc = docs.find((entry) => entry.slug === slug);
    if (!doc) return { notFound: true };
    return {
        props: {
            doc,
            nav: docs.map(({ slug, title }) => ({ slug, title })),
        },
    };
};

const { radius, motion, focus, font } = base;
const ease = `${motion.fast}ms ${motion.ease}`;
const focusRing = css`
    outline: ${focus.width}px solid var(--oc-accent);
    outline-offset: ${focus.offset}px;
`;
const monoLabel = css`
    font: 400 ${font.size.micro}px / 1.5 var(--oc-mono);
    letter-spacing: 0.02em;
    color: var(--oc-muted);
    text-transform: uppercase;
`;

const Page = styled.div`
    ${brandFoundation}
    min-height: 100vh;
    background: var(--oc-canvas);
    color: var(--oc-secondary);
    font: 400 15px/1.65 var(--oc-font);

    a {
        color: inherit;
        transition: color ${ease}, background-color ${ease},
            text-decoration-color ${ease};
    }
    a:focus-visible,
    summary:focus-visible {
        ${focusRing}
    }

    /* Header */
    .docs-top {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 20px;
        height: 64px;
        padding: 0 32px;
        border-bottom: 1px solid var(--oc-line);
        background: color-mix(in srgb, var(--oc-canvas) 88%, transparent);
        backdrop-filter: blur(16px);
    }
    .brand {
        border-radius: ${radius.inset}px;
    }
    .brand img {
        display: block;
        width: 108px;
        height: auto;
    }
    .section {
        padding-left: 20px;
        border-left: 1px solid var(--oc-line);
        color: var(--oc-ink);
        font-size: ${font.size.body}px;
        text-decoration: none;
    }
    .copy-prompt {
        ${actionSpec}
        ${outlineAction}
        ${pillAction}
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin-left: auto;
        padding-left: 12px;
        cursor: pointer;
    }
    .copy-prompt .agents {
        display: flex;
        gap: 4px;
    }
    .copy-prompt img {
        display: block;
        width: 18px;
        height: 18px;
    }
    .source {
        padding: 8px 4px;
        border-radius: ${radius.inset}px;
        color: var(--oc-secondary);
        font-size: ${font.size.md}px;
        text-decoration: none;
    }
    .source:hover {
        color: var(--oc-ink);
    }

    /* Layout */
    .docs-layout {
        display: grid;
        grid-template-columns: 220px minmax(0, 720px) 200px;
        gap: 48px;
        justify-content: center;
        padding: 48px 32px 96px;
    }
    .docs-nav,
    .docs-toc {
        position: sticky;
        top: 112px;
        align-self: start;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .docs-nav a {
        padding: 8px 12px;
        border-radius: ${radius.control}px;
        font-size: ${font.size.body}px;
        line-height: 1.5;
        text-decoration: none;
    }
    .docs-nav a:hover {
        background: var(--oc-hover);
        color: var(--oc-ink);
    }
    .docs-nav a[aria-current="page"] {
        background: var(--oc-surface);
        color: var(--oc-ink);
    }
    .docs-toc {
        padding-left: 16px;
        border-left: 1px solid var(--oc-line);
    }
    .docs-toc span {
        margin-bottom: 8px;
        ${monoLabel}
    }
    .docs-toc a {
        padding: 4px 0;
        border-radius: ${radius.inset}px;
        font-size: ${font.size.md}px;
        color: var(--oc-muted);
        text-decoration: none;
    }
    .docs-toc a:hover {
        color: var(--oc-ink);
    }

    /* Content */
    .docs-body h1,
    .docs-body h2,
    .docs-body h3 {
        color: var(--oc-ink);
        font-weight: 500;
        line-height: 1.25;
        scroll-margin-top: 88px;
    }
    .docs-body h1 {
        margin: 0 0 20px;
        font-size: 40px;
        letter-spacing: -0.02em;
    }
    .docs-body h1 + p {
        margin-bottom: 24px;
        color: var(--oc-ink);
        font-size: 18px;
        line-height: 1.55;
    }
    .docs-body h2 {
        margin: 56px 0 16px;
        padding-top: 24px;
        border-top: 1px solid var(--oc-line);
        font-size: 22px;
        letter-spacing: -0.01em;
    }
    .docs-body h3 {
        margin: 32px 0 8px;
        font-size: 17px;
    }
    .docs-body p,
    .docs-body ul,
    .docs-body ol {
        margin: 0 0 16px;
    }
    .docs-body ul,
    .docs-body ol {
        padding-left: 20px;
    }
    .docs-body li + li {
        margin-top: 8px;
    }
    .docs-body li::marker {
        color: var(--oc-muted);
    }
    .docs-body strong {
        color: var(--oc-ink);
        font-weight: 500;
    }
    .docs-body a {
        border-radius: 2px;
        color: var(--oc-ink);
        text-decoration: underline;
        text-decoration-color: var(--oc-line-strong);
        text-underline-offset: 3px;
    }
    .docs-body a:hover {
        text-decoration-color: var(--oc-ink);
    }
    .docs-body code {
        padding: 1px 6px;
        border-radius: 6px;
        background: var(--oc-surface);
        color: var(--oc-ink);
        font: ${font.size.md}px / 1.5 var(--oc-mono);
    }
    .docs-body pre {
        margin: 0 0 20px;
        padding: 16px 20px;
        overflow-x: auto;
        border: 1px solid var(--oc-line);
        border-radius: ${radius.card}px;
        background: var(--oc-panel);
    }
    .docs-body pre code {
        padding: 0;
        background: none;
        color: var(--oc-secondary);
    }
    .docs-body .table {
        margin: 0 0 20px;
        overflow-x: auto;
    }
    .docs-body table {
        width: 100%;
        border-collapse: collapse;
        font-size: ${font.size.body}px;
    }
    .docs-body th,
    .docs-body td {
        padding: 10px 12px 10px 0;
        border-bottom: 1px solid var(--oc-line);
        text-align: left;
        vertical-align: top;
    }
    .docs-body th {
        ${monoLabel}
        font-weight: 400;
    }

    /* Dropdowns */
    .docs-body details {
        margin: 0 0 12px;
        border: 1px solid var(--oc-line);
        border-radius: ${radius.card}px;
        background: var(--oc-panel);
        overflow: hidden;
    }
    .docs-body summary {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 48px;
        padding: 0 20px;
        cursor: pointer;
        color: var(--oc-ink);
        font-size: ${font.size.body}px;
        font-weight: 500;
        list-style: none;
        border-radius: ${radius.card}px;
        transition: background-color ${ease};
    }
    .docs-body summary::-webkit-details-marker {
        display: none;
    }
    .docs-body summary::after {
        content: "";
        width: 8px;
        height: 8px;
        margin-left: auto;
        border-right: 1.5px solid var(--oc-muted);
        border-bottom: 1.5px solid var(--oc-muted);
        transform: translateY(-2px) rotate(45deg);
        transition: transform ${motion.standard}ms ${motion.ease};
    }
    .docs-body details[open] > summary::after {
        transform: translateY(2px) rotate(-135deg);
    }
    .docs-body summary:hover {
        background: var(--oc-hover);
    }
    .docs-body details[open] > summary {
        border-bottom: 1px solid var(--oc-line);
        border-radius: ${radius.card}px ${radius.card}px 0 0;
    }
    .docs-body summary:focus-visible {
        outline-offset: -${focus.width}px;
    }
    .docs-body details > :not(summary) {
        margin-left: 20px;
        margin-right: 20px;
    }
    .docs-body details > summary + * {
        margin-top: 20px;
    }
    .docs-body details > :last-child {
        margin-bottom: 20px;
    }
    .docs-body details > .table {
        margin: 0 20px 20px;
    }
    .docs-body details pre {
        background: var(--oc-canvas);
    }

    /* Previous and next */
    .docs-pager {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 64px;
    }
    .docs-pager a {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px 20px;
        border: 1px solid var(--oc-line);
        border-radius: ${radius.card}px;
        background: var(--oc-panel);
        color: var(--oc-ink);
        font-size: ${font.size.body}px;
        font-weight: 500;
        text-decoration: none;
    }
    .docs-pager a:hover {
        background: var(--oc-hover);
        border-color: var(--oc-line-strong);
    }
    .docs-pager a span {
        ${monoLabel}
    }
    .docs-pager .next {
        grid-column: 2;
        align-items: flex-end;
        text-align: right;
    }

    @media (prefers-reduced-motion: reduce) {
        *,
        *::after {
            transition: none !important;
        }
    }
    @media (max-width: 1100px) {
        .docs-layout {
            grid-template-columns: 200px minmax(0, 1fr);
        }
        .docs-toc {
            display: none;
        }
    }
    @media (max-width: 760px) {
        .docs-top {
            gap: 12px;
            padding: 0 16px;
        }
        .brand img {
            width: 88px;
        }
        .section {
            padding-left: 12px;
        }
        .copy-prompt .agents {
            display: none;
        }
        .docs-layout {
            display: block;
            padding: 0 16px 64px;
        }
        .docs-nav {
            position: static;
            flex-direction: row;
            gap: 4px;
            margin: 0 -16px 32px;
            padding: 12px 16px;
            overflow-x: auto;
            border-bottom: 1px solid var(--oc-line);
        }
        .docs-nav a {
            flex-shrink: 0;
        }
        .docs-body h1 {
            font-size: 30px;
        }
        .docs-body h1 + p {
            font-size: 16px;
        }
        .docs-body summary {
            min-height: 44px;
            padding: 0 16px;
        }
        .docs-body details > :not(summary),
        .docs-body details > .table {
            margin-left: 16px;
            margin-right: 16px;
        }
    }
`;
