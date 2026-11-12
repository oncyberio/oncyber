import { CSSProperties } from "react";
import { libraryCard } from "../shared/Library";
import styled from "styled-components";

export function Card({
    image,
    cta = null,
    label,
    onDrag = null,
    overlay = null,
    disabled = false,
    onClick = null,
    width = null,
    height = null,
}) {
    let style: CSSProperties = {};

    if (width) {
        style.width = width;
    }

    if (height) {
        style.height = height;
    }

    return (
        <CardContainer
            className={disabled ? "disabled" : undefined}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={label}
            aria-disabled={disabled}
            onClick={disabled ? undefined : onClick}
            onKeyDown={(e) => {
                if (e.target !== e.currentTarget || disabled) return;
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick?.(e);
                }
            }}
            draggable={onDrag != null}
            onDragStart={onDrag}
        >
            <div className="card-wrapper" style={style}>
                <div className="img-wrapper" style={style}>
                    {image && <img src={image} alt={label} />}
                    {cta}
                </div>
                {overlay && <div className="overlay">{overlay}</div>}
            </div>
            <label className="label">{label}</label>
        </CardContainer>
    );
}

export const CardContainer = styled.div`
    ${libraryCard}
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    cursor: pointer;

    &.disabled {
        opacity: 0.3;
        pointer-events: none;
        cursor: not-allowed;
    }

    &:hover .img-wrapper > .icon,
    &:focus-within .img-wrapper > .icon {
        opacity: 0.85;
    }
    &:focus-within > .card-wrapper > .overlay {
        display: block;
    }

    & > .card-wrapper {
        position: relative;
        aspect-ratio: 1;
        width: 100%;

        & > .overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: none;
        }

        &:hover,
        &:focus-within {
            & > .overlay {
                display: block;
            }

            & > .img-wrapper {
                border-color: #797982;
            }
        }

        & > .img-wrapper {
            position: relative;
            aspect-ratio: 1;
            width: 100%;
            border: 1px solid var(--studio-line);
            border-radius: var(--studio-radius-preview);
            background: var(--studio-inset);
            transition: border-color 150ms ease;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;

            & > .icon {
                position: absolute;
                right: 5px;
                bottom: 5px;
                opacity: 0;
                transition: opacity 120ms ease;
            }

            & > img {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
        }
    }

    & > .label {
        width: 100%;
        text-align: left;
        color: var(--studio-secondary);
        margin: 0;
        padding: 3px 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-style: normal;
        font-weight: 400;
        font-size: 11px;
        line-height: 16px;
    }
`;
