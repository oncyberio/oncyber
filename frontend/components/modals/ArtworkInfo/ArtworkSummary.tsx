import React, { useEffect, useId, useRef, useState } from "react";
import styled from "styled-components";

interface SummaryAsset {
    id?: string;
    name?: string;
    description?: string;
    collection?: { name?: string };
    token_id?: string | number;
    contract_address?: string;
}

/** The same compact metadata header in the in-world desktop and mobile views. */
export function ArtworkSummary({ asset }: { asset: SummaryAsset }) {
    const title =
        asset?.name ||
        (asset?.collection?.name &&
            `${asset.collection.name}${
                asset.token_id != null ? ` #${asset.token_id}` : ""
            }`) ||
        asset?.contract_address ||
        "Untitled artwork";
    const description =
        typeof asset?.description === "string" ? asset.description.trim() : "";
    const [expanded, setExpanded] = useState(false);
    const [overflows, setOverflows] = useState(description.length > 100);
    const rowRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLParagraphElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const descriptionId = useId();

    useEffect(() => {
        setExpanded(false);
    }, [
        asset?.id,
        asset?.contract_address,
        asset?.token_id,
        title,
        description,
    ]);

    useEffect(() => {
        if (expanded || !description) return;
        let alive = true;
        const measure = () => {
            const row = rowRef.current;
            const text = textRef.current;
            if (alive && row?.clientWidth && text)
                // Compare with the whole row so the toggle itself cannot cause
                // a fitting description to be treated as truncated.
                setOverflows(text.scrollWidth > row.clientWidth);
        };
        measure();
        const observer =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(measure)
                : null;
        if (rowRef.current) observer?.observe(rowRef.current);
        window.addEventListener("resize", measure);
        void document.fonts?.ready.then(measure);
        return () => {
            alive = false;
            observer?.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, [description, expanded]);

    return (
        <Summary
            className="artwork-summary"
            onKeyDown={(event) => {
                if (event.key !== "Escape" || !expanded) return;
                event.preventDefault();
                event.stopPropagation();
                setExpanded(false);
                toggleRef.current?.focus();
            }}
        >
            <h2 className="artwork-summary-title" title={title}>
                {title}
            </h2>
            {description && (
                <Description
                    ref={rowRef}
                    className="artwork-summary-description"
                    data-expanded={expanded || undefined}
                >
                    <p
                        ref={textRef}
                        className="text"
                        id={descriptionId}
                        role={expanded ? "region" : undefined}
                        aria-label={
                            expanded ? "Artwork description" : undefined
                        }
                        tabIndex={expanded ? 0 : undefined}
                    >
                        {description}
                    </p>
                    {(overflows || expanded) && (
                        <button
                            ref={toggleRef}
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={descriptionId}
                            onClick={() => setExpanded((value) => !value)}
                        >
                            {expanded ? "See less" : "See more"}
                        </button>
                    )}
                </Description>
            )}
        </Summary>
    );
}

const Summary = styled.div`
    width: 100%;
    min-width: 0;
    flex-shrink: 0;
    text-align: left;

    .artwork-summary-title {
        margin: 0;
        padding: 0;
        color: var(--oc-ink, #f3f3f1);
        font-size: var(--artwork-summary-title-size, 14px);
        font-weight: 500;
        line-height: var(--artwork-summary-title-leading, 20px);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
`;

const Description = styled.div`
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    margin-top: 4px;
    font-size: var(--artwork-summary-description-size, 12px);
    line-height: var(--artwork-summary-description-leading, 18px);

    .text {
        flex: 1;
        min-width: 0;
        margin: 0;
        color: var(--oc-secondary, #c2c2bd);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &[data-expanded] {
        align-items: flex-start;
        .text {
            max-height: min(180px, 25dvh);
            overflow-y: auto;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            overscroll-behavior: contain;
            scrollbar-width: thin;
        }
    }

    button {
        flex-shrink: 0;
        min-height: 24px;
        margin: -3px 0;
        padding: 3px 0;
        border: 0;
        border-radius: 2px;
        background: none;
        color: var(--oc-ink, #f3f3f1);
        font: inherit;
        white-space: nowrap;
        text-decoration: underline;
        text-underline-offset: 3px;
        cursor: pointer;
    }

    button:focus-visible,
    .text:focus-visible {
        outline: 1px solid var(--oc-accent, #f3f3f1);
        outline-offset: 3px;
    }

    @media (pointer: coarse) {
        button {
            min-height: 32px;
            margin-block: -7px;
            padding-block: 7px;
        }
    }
`;
