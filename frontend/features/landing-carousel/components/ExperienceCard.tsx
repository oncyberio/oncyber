import {
    AnchorHTMLAttributes,
    forwardRef,
    useState,
    useEffect,
    useRef,
} from "react";
import Link from "@components/InAppLink";
import styled from "styled-components";
import { LandingCard } from "../types";
import { creatorLabel, roomLabel } from "../data";
import Icon from "./Icon";
import { useActivitySignal } from "../activity";
import { coverSources } from "../coverSources";

export function CoverImage({ card }: { card: LandingCard }) {
    const [failed, setFailed] = useState<string[]>([]);
    const image = useRef<HTMLImageElement>(null);
    const signal = useActivitySignal();
    const url = coverSources(card).find((source) => !failed.includes(source));
    useEffect(() => {
        const element = image.current;
        if (!element || !url) return;
        // Lazy images outside the viewport must not keep the logo running.
        const observer = new IntersectionObserver(([entry]) => {
            signal(entry.isIntersecting && !element.complete);
        });
        observer.observe(element);
        return () => {
            observer.disconnect();
            signal(false);
        };
    }, [url, signal]);
    if (!url)
        return (
            <div className="cover-placeholder" aria-hidden="true">
                <svg viewBox="0 0 100 100" width="64" height="64">
                    <circle
                        cx="50"
                        cy="50"
                        r="34"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                    />
                </svg>
            </div>
        );
    return (
        <img
            ref={image}
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => signal(false)}
            onError={() => {
                signal(false);
                setFailed((previous) => [...previous, url]);
            }}
        />
    );
}

interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
    card: LandingCard;
    flat?: boolean;
    featured?: boolean;
    /** The corner arrow opens the space in a new tab; the card body stays in-page. */
    arrowOpensNewTab?: boolean;
}

const ExperienceCard = forwardRef<HTMLAnchorElement, Props>(
    function ExperienceCard(
        { card, flat, featured, arrowOpensNewTab = false, ...props },
        ref
    ) {
        const status =
            card.destinationStatus ||
            {
                free: "Free",
                owned: "Owned",
                uncollected: "Not collected",
                checking: "Checking…",
                scan: "Your scan",
            }[card.templateStatus];
        const creator = card.buildStatus ? "" : creatorLabel(card.creator);
        const content = (
            <Card
                as={card.href ? "a" : "article"}
                ref={ref}
                $flat={flat}
                $featured={featured}
                data-template-status={card.templateStatus}
                data-opening={card.opening || undefined}
                aria-busy={card.opening || undefined}
                data-destination-status={card.destinationStatus}
                aria-description={status}
                aria-label={
                    card.actionLabel
                        ? card.actionLabel
                        : card.id.startsWith("template-")
                        ? `Use ${card.title} template`
                        : card.buildStatus
                        ? card.href
                            ? `Build a ${card.title.toLowerCase()} in Studio`
                            : `${card.title} — ${card.buildStatus}`
                        : `Enter ${card.title}`
                }
                aria-disabled={!card.href || undefined}
                {...props}
            >
                {flat && <CoverImage card={card} />}
                <div className="card-shade" />
                {card.opening && (
                    <div className="card-loading" role="status">
                        <span className="card-spinner" aria-hidden="true" />
                        <span>Creating your space…</span>
                    </div>
                )}
                <div className="card-top">
                    {status ? (
                        <span className="template-pill">{status}</span>
                    ) : (
                        <span />
                    )}
                    {card.href && (
                        <span
                            className="enter-arrow"
                            {...(arrowOpensNewTab &&
                            // Studio build and template cards keep their own flow.
                            !/^(template|build)-/.test(card.id)
                                ? {
                                      title: "Open in a new tab",
                                      "data-new-tab": true,
                                      onClick: (event: React.MouseEvent) => {
                                          // Stop the card's in-page travel and
                                          // the link's own navigation.
                                          event.preventDefault();
                                          event.stopPropagation();
                                          window.open(
                                              card.href,
                                              "_blank",
                                              "noopener"
                                          );
                                      },
                                  }
                                : {})}
                        >
                            <Icon name="arrow" size={16} />
                        </span>
                    )}
                </div>
                <div className="card-caption">
                    <div className="caption-title">
                        <h2>
                            {card.title}
                            {creator && (
                                <span className="by"> by {creator}</span>
                            )}
                        </h2>
                        {featured && card.buildStatus && (
                            <span>{card.buildStatus}</span>
                        )}
                    </div>
                    <div className="card-meta">
                        <span>
                            {card.buildStatus
                                ? featured
                                    ? card.description
                                    : card.buildStatus
                                : featured
                                ? card.description || roomLabel(card.room)
                                : roomLabel(card.room)}
                        </span>
                        {!card.buildStatus && (
                            <span>
                                {Intl.NumberFormat("en", {
                                    notation: "compact",
                                    maximumFractionDigits: 1,
                                }).format(card.visits)}{" "}
                                visits
                            </span>
                        )}
                    </div>
                </div>
            </Card>
        );
        return card.href ? (
            <Link
                href={card.href}
                prefetch={false}
                legacyBehavior
                passHref
                spaceEntrance={
                    !card.buildStatus && !card.id.startsWith("template-")
                        ? { title: card.title, image: card.imageUrls[0] }
                        : undefined
                }
            >
                {content}
            </Link>
        ) : (
            content
        );
    }
);
export default ExperienceCard;

const Card = styled.a<{ $flat?: boolean; $featured?: boolean }>`
    position: absolute;
    display: block;
    top: 0;
    left: 0;
    min-width: 0;
    overflow: hidden;
    color: #fff;
    font-family: var(--oc-font);
    font-variant-numeric: tabular-nums;
    text-decoration: none;
    isolation: isolate;
    border-radius: var(--oc-radius-card);
    cursor: pointer;
    &[aria-disabled="true"] {
        cursor: default;
    }
    background: ${({ $flat }) => ($flat ? "#161a1c" : "transparent")};
    -webkit-tap-highlight-color: transparent;
    img {
        width: 100%;
        height: calc(100% - var(--caption-height, 54px));
        object-fit: cover;
        position: absolute;
        inset: 0;
        transition: transform var(--oc-enter) var(--oc-ease);
    }
    .cover-placeholder {
        position: absolute;
        inset: 0 0 var(--caption-height, 54px);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 12px;
        font-size: 12px;
        color: #8b979a;
        background: #000;
    }
    .card-shade {
        position: absolute;
        inset: 0;
        background: linear-gradient(
            180deg,
            #00000012,
            transparent 55%,
            #00000030
        );
    }
    .card-loading {
        position: absolute;
        inset: 0 0 var(--caption-height, 54px);
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        background: #0b0d0eb3;
        backdrop-filter: blur(6px);
        color: #f8f8f8;
        font-size: 12px;
        font-weight: 500;
        animation: card-loading-in var(--oc-fast) ease-out both;
    }
    .card-spinner {
        width: 22px;
        height: 22px;
        border: 2px solid #ffffff33;
        border-top-color: #fff;
        border-radius: 50%;
        animation: card-spin 0.8s linear infinite;
    }
    @keyframes card-loading-in {
        from {
            opacity: 0;
        }
    }
    @keyframes card-spin {
        to {
            transform: rotate(360deg);
        }
    }
    &[data-opening] {
        cursor: progress;
    }
    &[data-opening] .card-top {
        opacity: 0;
    }
    .card-top {
        position: absolute;
        top: 12px;
        left: 16px;
        right: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        opacity: 0;
        transition: opacity var(--oc-fast);
    }
    &:hover .card-top,
    &:focus-visible .card-top {
        opacity: 1;
    }
    &[data-template-status] .card-top,
    &[data-destination-status] .card-top {
        opacity: 1;
    }
    .template-pill {
        display: inline-flex;
        align-items: center;
        min-height: 26px;
        padding: 4px 10px;
        border: 1px solid #ffffff30;
        border-radius: 999px;
        background: #17191bd9;
        color: #f8f8f8;
        backdrop-filter: blur(8px);
        font-size: 11px;
        font-weight: 500;
        line-height: 1.4;
        white-space: nowrap;
    }
    .enter-arrow {
        display: flex;
        padding: 6px;
        border: 1px solid #ffffff66;
        border-radius: 50%;
        opacity: 0;
        transform: translate(-3px, 3px);
        transition: opacity var(--oc-standard), transform var(--oc-standard);
    }
    .card-caption {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: var(--caption-height, 54px);
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 10px 20px;
        background: var(--oc-paper);
        color: var(--oc-paper-ink);
        border-radius: 0 0 var(--oc-radius-card) var(--oc-radius-card);
        box-shadow: inset 0 1px 0 #00000005;
    }
    .caption-title {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 16px;
    }
    .caption-title > span {
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 40%;
    }
    .card-caption::after {
        content: "";
        position: absolute;
        inset: 0;
        box-sizing: border-box;
        padding: 0 1px 2px;
        border-radius: inherit;
        background: var(--oc-selection);
        -webkit-mask: linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
        opacity: 0;
        transition: none;
    }
    &[data-selected="true"] .card-caption::after {
        opacity: 1;
        transition: opacity var(--oc-standard) ease-out;
    }
    h2 {
        font-family: var(--oc-font);
        font-size: 14px;
        line-height: 1.4;
        letter-spacing: -0.01em;
        font-weight: 500;
        margin: 0 0 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    h2 .by {
        color: var(--oc-paper-muted);
        font-weight: 400;
    }
    .card-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        color: var(--oc-paper-muted);
        font-size: 12px;
        line-height: 1.5;
    }
    .card-meta span:first-child {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .card-meta span:last-child {
        white-space: nowrap;
    }
    .card-meta span:nth-child(2) {
        font-family: var(--oc-mono);
        font-size: 10px;
    }
    &:hover .enter-arrow,
    &:focus-visible .enter-arrow {
        opacity: 1;
        transform: translate(0);
    }
    &:hover img {
        transform: scale(1.035);
    }
    &:focus-visible {
        outline: 2px solid var(--oc-accent);
        outline-offset: -3px;
    }
    ${({ $featured }) =>
        $featured &&
        `
        .card-caption { padding: 12px clamp(18px, 2vw, 32px); }
        h2 { font-size: clamp(16px, 1.2vw, 20px); margin-bottom: 6px; }
        .card-meta, .caption-title > span { font-size: clamp(12px, 1vw, 14px); }
        .card-meta span:nth-child(2) { font-size: 11px; }
    `}
    @media (max-width: 700px) {
        .card-caption {
            padding: 8px ${({ $featured }) => ($featured ? "16px" : "12px")};
        }
        .card-top {
            left: 10px;
            right: 10px;
            top: 10px;
        }
        .card-meta {
            font-size: ${({ $featured }) => ($featured ? "12px" : "11px")};
            gap: 4px;
        }
        .card-meta span:nth-child(2) {
            display: none;
        }
        h2 {
            font-size: ${({ $featured }) => ($featured ? "16px" : "12px")};
        }
    }
    @media (prefers-reduced-motion: reduce) {
        &[data-selected="true"] .card-caption::after,
        img,
        .enter-arrow {
            transition: none;
        }
        .card-spinner {
            animation-duration: 2.4s;
        }
    }
`;
