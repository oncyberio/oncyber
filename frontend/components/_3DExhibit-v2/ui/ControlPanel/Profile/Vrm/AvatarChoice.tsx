import React from "react";
import styled from "styled-components";
import { LegacyCloudinaryNextImage } from "@components/CloudinaryNextImage";

export default function AvatarChoice({
    name,
    image,
    selected,
    onSelect,
}: {
    name: string;
    image?: string;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <Choice
            type="button"
            aria-label={`Use ${name}`}
            aria-pressed={selected}
            onClick={onSelect}
            title={name}
        >
            <span className="avatar-choice-image">
                <LegacyCloudinaryNextImage
                    alt=""
                    width={88}
                    height={88}
                    src={image || "/images/opensea-black.png"}
                    objectFit="cover"
                    onError={(event: any) => {
                        event.target.srcset = "/images/opensea-black.png";
                        event.onerror = null;
                    }}
                />
                {selected && (
                    <span className="avatar-choice-check" aria-hidden="true">
                        ✓
                    </span>
                )}
            </span>
            <span className="avatar-choice-name">{name}</span>
        </Choice>
    );
}

const Choice = styled.button`
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    min-width: 0;
    padding: 5px;
    gap: 6px;
    border: 1px solid transparent;
    border-radius: 12px;
    background: transparent;
    color: var(--oc-secondary, #c2c2bd);
    transition: background 120ms ease, color 120ms ease;
    text-align: left;
    .avatar-choice-image {
        position: relative;
        display: block;
        overflow: hidden;
        aspect-ratio: 1;
        width: 100%;
        border-radius: 8px;
        background: var(--oc-surface, #242424);
    }
    .avatar-choice-image > span {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
    }
    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .avatar-choice-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11px;
        line-height: 16px;
        padding: 0 2px 2px;
    }
    && .avatar-choice-check {
        position: absolute;
        right: 4px;
        bottom: 4px;
        display: grid !important;
        place-items: center;
        width: 18px !important;
        height: 18px !important;
        border-radius: 50%;
        background: #f3f3f1;
        color: #191919;
        font-size: 11px;
        font-weight: 500;
    }
    &:hover,
    &[aria-pressed="true"] {
        background: var(--oc-surface, #242424);
        color: var(--oc-ink, #f3f3f1);
    }
    &[aria-pressed="true"] {
        border-color: #ffffff18;
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;
