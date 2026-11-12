import type { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import styled from "styled-components";
import { brandFoundation } from "@styles/brand";
import Markdown, { headingsOf } from "@features/docs/markdown";
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
                            <Link href={href(previous.slug)}>
                                ← {previous.slug ? previous.title : "Overview"}
                            </Link>
                        ) : (
                            <span />
                        )}
                        {next && (
                            <Link href={href(next.slug)}>{next.title} →</Link>
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

const Page = styled.div`
    ${brandFoundation}
    min-height: 100vh;
    background: var(--oc-canvas);
    color: var(--oc-secondary);
    font: 400 15px/1.65 var(--oc-font);

    a {
        color: inherit;
    }
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
        background: var(--oc-canvas);
    }
    .brand img {
        display: block;
        width: 104px;
        height: auto;
    }
    .section {
        padding-left: 20px;
        border-left: 1px solid var(--oc-line);
        color: var(--oc-ink);
        font-size: 14px;
        text-decoration: none;
    }
    .source {
        margin-left: auto;
        font-size: 13px;
        text-decoration: none;
    }
    .source:hover {
        color: var(--oc-ink);
    }
    .docs-layout {
        display: grid;
        grid-template-columns: 220px minmax(0, 720px) 200px;
        gap: 48px;
        justify-content: center;
        padding: 40px 32px 96px;
    }
    .docs-nav,
    .docs-toc {
        position: sticky;
        top: 104px;
        align-self: start;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .docs-nav a {
        padding: 6px 10px;
        border-radius: var(--oc-radius-inset, 8px);
        font-size: 14px;
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
    .docs-toc span {
        margin-bottom: 6px;
        font-family: var(--oc-mono);
        font-size: 10px;
        color: var(--oc-muted);
    }
    .docs-toc a {
        padding: 3px 0;
        font-size: 13px;
        color: var(--oc-muted);
        text-decoration: none;
    }
    .docs-toc a:hover {
        color: var(--oc-ink);
    }

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
        font-size: 36px;
        letter-spacing: -0.02em;
    }
    .docs-body h2 {
        margin: 48px 0 12px;
        font-size: 22px;
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
    .docs-body li + li {
        margin-top: 6px;
    }
    .docs-body strong {
        color: var(--oc-ink);
        font-weight: 500;
    }
    .docs-body a {
        color: var(--oc-ink);
        text-decoration: underline;
        text-decoration-color: var(--oc-line-strong);
        text-underline-offset: 3px;
    }
    .docs-body a:hover {
        text-decoration-color: var(--oc-ink);
    }
    .docs-body code {
        padding: 1px 5px;
        border-radius: 4px;
        background: var(--oc-surface);
        color: var(--oc-ink);
        font: 13px/1.5 var(--oc-mono);
    }
    .docs-body pre {
        margin: 0 0 20px;
        padding: 16px 18px;
        overflow-x: auto;
        border: 1px solid var(--oc-line);
        border-radius: var(--oc-radius-control, 12px);
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
        font-size: 14px;
    }
    .docs-body th,
    .docs-body td {
        padding: 9px 12px 9px 0;
        border-bottom: 1px solid var(--oc-line);
        text-align: left;
        vertical-align: top;
    }
    .docs-body th {
        color: var(--oc-ink);
        font-weight: 500;
    }
    .docs-pager {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-top: 64px;
        padding-top: 24px;
        border-top: 1px solid var(--oc-line);
        font-size: 14px;
    }
    .docs-pager a {
        text-decoration: none;
        color: var(--oc-ink);
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
            padding: 0 16px;
        }
        .docs-layout {
            display: block;
            padding: 0 16px 64px;
        }
        .docs-nav {
            position: static;
            flex-direction: row;
            gap: 4px;
            margin: 0 -16px 24px;
            padding: 12px 16px;
            overflow-x: auto;
            border-bottom: 1px solid var(--oc-line);
        }
        .docs-nav a {
            flex-shrink: 0;
        }
        .docs-body h1 {
            font-size: 28px;
        }
    }
`;
