import { useEffect } from "react";
import type { GetStaticProps } from "next";
import Link from "next/link";
import styled from "styled-components";
import JsonLd from "@components/JsonLd";
import ExperienceControlIcon from "@ui/components/ExperienceControlIcon";
import CopyPromptButton, {
    contributePrompt,
} from "@features/docs/CopyPromptButton";
import Icon from "@features/landing-carousel/components/Icon";
import { experienceControl } from "@features/content-host/experienceChrome";
import Markdown from "@features/docs/markdown";
import type { FaqEntry } from "@features/docs/content";
import {
    actionButton,
    brandFoundation,
    outlineAction,
    whiteAction,
} from "@styles/brand";
import { baseTokens as base } from "@styles/tokens";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { SITE_SOCIALS, aboutStructuredData } from "@utils/structuredData";

interface Props {
    lead: string;
    faq: FaqEntry[];
}

/** What you can do here, each under one of the lobby's own marks. */
const FEATURES = [
    {
        icon: "explore",
        title: "Visit spaces",
        text: "Walk around a gallery or a world, read about each work on show, and step through portals into other spaces.",
    },
    {
        icon: "people",
        title: "Meet in the lobby",
        text: "The shared world everyone arrives in. See who is around and travel into spaces together.",
    },
    {
        icon: "mic",
        title: "Chat and talk",
        text: "Text chat and voice with the people around you, in the lobby and inside spaces.",
    },
    {
        icon: "avatar",
        title: "Bring your avatar",
        text: "Pick a built-in one, upload your own, or wear one you own. It comes with you everywhere.",
    },
    {
        icon: "emotes",
        title: "Say it with emotes",
        text: "Wave, dance and react. Your avatar does the talking when words are too slow.",
    },
    {
        icon: "more",
        title: "Make your own",
        text: "Open the Studio, pick a gallery or a world, place your work and publish. It has a link the moment it is live.",
    },
];

export const DISCORD_URL = SITE_SOCIALS.find((url) => url.includes("discord"));

const GITHUB_URL = "https://github.com/oncyberio/oncyber";

/** Where the team and the community are. */
const PLACES = [
    {
        name: "Discord",
        detail: "Talk to the team and other creators",
        href: DISCORD_URL,
    },
    {
        name: "X",
        detail: "@oncyber",
        href: "https://twitter.com/oncyber",
    },
    {
        name: "GitHub",
        detail: "oncyberio/oncyber",
        href: GITHUB_URL,
    },
    { name: "Docs", detail: "Run it, extend it, contribute", href: "/docs" },
];

/**
 * /about: what Oncyber is, in the lobby's own visual language. A quiet dark
 * canvas, panels with soft corners, mono section labels, the shared action
 * buttons, and the hand-shaped marks from the lobby dock as its pictures.
 */
export default function About({ lead, faq }: Props) {
    useEffect(() => {
        amplitude_logAnalyticsEvent("visit_about");
    }, []);
    return (
        <Page>
            <JsonLd id="about" data={aboutStructuredData(faq)} />
            <header className="about-top">
                {/* The way back, where a space has it and drawn the same. */}
                <Link href="/" className="back" aria-label="Back to Oncyber">
                    <Icon name="back" size={17} />
                </Link>
                <Link href="/" className="brand" aria-label="Oncyber home">
                    <img
                        className="symbol"
                        src="/brand/oncyber-original.svg"
                        alt=""
                    />
                    <img
                        className="wordmark"
                        src="/brand/oncyber-wordmark-white.png"
                        alt="Oncyber"
                    />
                </Link>
            </header>
            <main>
                <section className="hero">
                    {/* The mark a space shows beside its title, at the size
                        of a picture. */}
                    <ExperienceControlIcon
                        name="info"
                        size={56}
                        className="mark"
                    />
                    <p className="eyebrow">about</p>
                    <h1>A place on the web to make and visit 3D spaces.</h1>
                    <p className="lead">{lead}</p>
                    <div className="actions">
                        <CopyPromptButton
                            agents={["claude", "codex", "cursor"]}
                            className="action white"
                            prompt={contributePrompt}
                        />
                        <Link href="/" className="action">
                            Explore worlds
                        </Link>
                        <Link href="/?lobby=1" className="action">
                            Jump In
                        </Link>
                    </div>
                    <a
                        className="source"
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Open source on GitHub
                        <span aria-hidden="true"> ↗</span>
                    </a>
                </section>

                <section aria-labelledby="about-features">
                    <h2 id="about-features" className="label">
                        What you can do
                    </h2>
                    <ul className="features">
                        {FEATURES.map((feature) => (
                            <li key={feature.title}>
                                <ExperienceControlIcon
                                    name={feature.icon}
                                    size={36}
                                />
                                <h3>{feature.title}</h3>
                                <p>{feature.text}</p>
                            </li>
                        ))}
                    </ul>
                </section>

                <section aria-labelledby="about-questions">
                    <h2 id="about-questions" className="label">
                        Questions
                    </h2>
                    <dl className="questions">
                        {faq.map((entry) => (
                            <div key={entry.question}>
                                <dt>{entry.question}</dt>
                                <dd>
                                    <Markdown source={entry.markdown} />
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>

                <section aria-labelledby="about-places">
                    <h2 id="about-places" className="label">
                        Find us
                    </h2>
                    <ul className="places">
                        {PLACES.map((place) => {
                            const outside = /^https?:/.test(place.href);
                            return (
                                <li key={place.name}>
                                    <a
                                        href={place.href}
                                        {...(outside
                                            ? {
                                                  target: "_blank",
                                                  rel: "noreferrer",
                                              }
                                            : {})}
                                    >
                                        <strong>{place.name}</strong>
                                        <span>{place.detail}</span>
                                        <svg
                                            aria-hidden="true"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.6"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path
                                                d={
                                                    outside
                                                        ? "M7 17 17 7M9 7h8v8"
                                                        : "M4 12h16m-6-6 6 6-6 6"
                                                }
                                            />
                                        </svg>
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            </main>
            <footer className="about-foot">
                <span>© {new Date().getFullYear()} oncyber</span>
                <Link href="/privacy">Privacy</Link>
            </footer>
        </Page>
    );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
    const { aboutPage } = await import("@features/docs/content");
    const { lead, faq } = aboutPage();
    return { props: { lead, faq } };
};

const Page = styled.div`
    ${brandFoundation}
    position: relative;
    min-height: 100vh;
    background: var(--oc-canvas);
    color: var(--oc-secondary);
    &,
    * {
        box-sizing: border-box;
    }
    a {
        color: inherit;
        text-decoration: none;
    }
    a:focus-visible:not(.back) {
        outline: 2px solid var(--oc-accent);
        outline-offset: 3px;
        border-radius: ${base.radius.inset}px;
    }

    /* The centred identity, as on the landing. */
    .about-top {
        display: flex;
        justify-content: center;
        padding: 56px 24px 0;
    }
    .back {
        ${experienceControl}
        position: absolute;
        top: 24px;
        left: 24px;
    }
    .brand {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .brand .symbol {
        width: 34px;
        height: 34px;
    }
    .brand .wordmark {
        width: 108px;
        height: auto;
    }

    main {
        width: 100%;
        max-width: 960px;
        margin: 0 auto;
        padding: 0 24px 72px;
    }
    section {
        margin-top: 72px;
    }

    .hero {
        max-width: 720px;
        margin: 88px auto 0;
        text-align: center;
    }
    .hero .mark {
        display: block;
        margin: 0 auto;
        color: var(--oc-ink);
    }
    .eyebrow {
        margin: 12px 0 20px;
        font: 400 11px/16px var(--oc-mono);
        letter-spacing: 0.02em;
        color: var(--oc-muted);
    }
    h1 {
        margin: 0;
        color: var(--oc-ink);
        font-size: clamp(30px, 4.6vw, 48px);
        font-weight: 500;
        line-height: 1.12;
        letter-spacing: -0.02em;
        text-wrap: balance;
    }
    .lead {
        max-width: 600px;
        margin: 20px auto 0;
        font-size: 16px;
        line-height: 1.6;
        text-wrap: pretty;
    }
    .actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
        margin-top: 32px;
    }
    /* The shared action buttons: white for the one next step, the outline
       for the rest. */
    .action {
        ${actionButton}
        ${outlineAction}
    }
    .action.white {
        ${whiteAction}
    }
    /* Under the actions, where the code is. */
    .source {
        display: inline-block;
        margin-top: 20px;
        font: 400 12px/16px var(--oc-mono);
        letter-spacing: 0.02em;
        color: var(--oc-muted);
        transition: color 150ms ease;
    }
    .source:hover {
        color: var(--oc-ink);
    }
    /* The main action copies a prompt for a coding agent, under the marks
       of the agents it works in. */
    .copy-prompt {
        gap: 10px;
        padding-left: 12px;
        white-space: nowrap;
        cursor: pointer;
    }
    .copy-prompt .agents {
        display: flex;
        gap: 5px;
    }
    .copy-prompt img {
        display: block;
        width: 18px;
        height: 18px;
    }
    .copy-prompt img[data-white] {
        filter: invert(1);
    }
    /* The label keeps the width of its longer wording, so the row stays
       still when it changes to Copied. */
    .copy-prompt > span:last-child {
        display: inline-grid;
        text-align: left;
    }
    .copy-prompt > span:last-child::after {
        content: "Copy for AI";
        height: 0;
        overflow: hidden;
        visibility: hidden;
    }

    /* Section labels in the quiet mono voice. */
    .label {
        margin: 0 0 16px;
        font: 400 11px/16px var(--oc-mono);
        letter-spacing: 0.02em;
        color: var(--oc-muted);
    }

    /* What you can do: panels, each under one of the lobby's marks. */
    .features {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
    }
    .features li {
        padding: 24px;
        border: 1px solid var(--oc-line);
        border-radius: ${base.radius.panel}px;
        background: var(--oc-panel);
    }
    .features .experience-control-icon {
        color: var(--oc-ink);
        opacity: 1;
    }
    .features h3 {
        margin: 20px 0 6px;
        color: var(--oc-ink);
        font-size: 16px;
        font-weight: 500;
        line-height: 1.5;
    }
    .features p {
        margin: 0;
        font-size: 14px;
        line-height: 1.55;
    }

    /* Questions: one panel, a row each, hairlines between. */
    .questions {
        margin: 0;
        border: 1px solid var(--oc-line);
        border-radius: ${base.radius.panel}px;
        background: var(--oc-panel);
    }
    .questions > div {
        display: grid;
        grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
        gap: 24px;
        padding: 22px 24px;
    }
    .questions > div + div {
        border-top: 1px solid var(--oc-line);
    }
    .questions dt {
        color: var(--oc-ink);
        font-size: 15px;
        font-weight: 500;
        line-height: 1.5;
    }
    .questions dd {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
    }
    .questions dd p {
        margin: 0;
    }
    .questions dd p + p {
        margin-top: 10px;
    }
    .questions dd a {
        color: var(--oc-ink);
        text-decoration: underline;
        text-decoration-color: var(--oc-line-strong);
        text-underline-offset: 3px;
    }
    .questions dd a:hover {
        text-decoration-color: currentColor;
    }
    .questions dd code {
        font: 12px/1.5 var(--oc-mono);
        color: var(--oc-ink);
    }

    /* Find us: the account sidebar's rows. */
    .places {
        list-style: none;
        margin: 0;
        padding: 8px;
        border: 1px solid var(--oc-line);
        border-radius: ${base.radius.panel}px;
        background: var(--oc-panel);
    }
    .places a {
        display: grid;
        grid-template-columns: 120px minmax(0, 1fr) auto;
        align-items: center;
        gap: 16px;
        min-height: 56px;
        padding: 12px 16px;
        border-radius: ${base.radius.control}px;
        transition: background var(--oc-fast), color var(--oc-fast);
    }
    .places a:hover {
        background: var(--oc-surface);
        color: var(--oc-ink);
    }
    .places strong {
        color: var(--oc-ink);
        font-size: 15px;
        font-weight: 500;
    }
    .places span {
        font-size: 14px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .places svg {
        color: var(--oc-muted);
    }
    .places a:hover svg {
        color: var(--oc-ink);
    }

    .about-foot {
        display: flex;
        justify-content: center;
        gap: 24px;
        padding: 0 24px 48px;
        font: 400 11px/16px var(--oc-mono);
        color: var(--oc-muted);
    }
    .about-foot a:hover {
        color: var(--oc-ink);
    }

    @media (max-width: 860px) {
        .features {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .questions > div {
            grid-template-columns: minmax(0, 1fr);
            gap: 8px;
        }
    }
    @media (max-width: ${base.breakpoint.phone}px) {
        .about-top {
            padding-top: 40px;
        }
        .back {
            top: 22px;
            left: 16px;
        }
        /* The main action takes a row; the two ways in share the next. */
        .actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            max-width: 300px;
            margin-left: auto;
            margin-right: auto;
        }
        .actions .copy-prompt {
            grid-column: 1 / -1;
        }
        .brand .wordmark {
            display: none;
        }
        .brand .symbol {
            width: 30px;
            height: 30px;
        }
        main {
            padding: 0 20px 56px;
        }
        section {
            margin-top: 56px;
        }
        .hero {
            margin-top: 56px;
        }
        .features {
            grid-template-columns: minmax(0, 1fr);
            gap: 12px;
        }
        .features li,
        .questions > div {
            padding: 20px;
        }
        .features li,
        .questions,
        .places {
            border-radius: ${base.radius.card}px;
        }
        .places a {
            grid-template-columns: 84px minmax(0, 1fr) auto;
            padding: 12px;
        }
    }
`;
