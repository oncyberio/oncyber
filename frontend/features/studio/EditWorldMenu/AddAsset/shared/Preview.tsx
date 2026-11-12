import styled from "styled-components";
import { libraryCard } from "./Library";

export function Preview({
    image,
    title,
    content = null,
    onClick,
    label = "Add asset",
}) {
    //
    return (
        <PreviewWrapper>
            <PreviewImgWrapper
                role="button"
                tabIndex={0}
                aria-label={label}
                onClick={onClick}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onClick(e);
                    }
                }}
            >
                {image}
            </PreviewImgWrapper>
            <PreviewTitle>{title}</PreviewTitle>
            {content}
        </PreviewWrapper>
    );
}

const PreviewWrapper = styled.div`
    ${libraryCard}
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;

    cursor: pointer;
`;

export const PreviewImgWrapper = styled.div<{
    radius?: string;
}>`
    position: relative;
    border-radius: ${(props) => props.radius ?? "var(--studio-radius-preview)"};
    overflow: hidden;
    border: 1px solid var(--studio-line);
    background: var(--studio-inset);
    transition: border-color 150ms ease;
    &:hover {
        border-color: var(--studio-line-strong);
    }
`;

export const PreviewTitle = styled.div`
    margin: 0;
    font-weight: 400;
    font-size: 11px;
    color: var(--studio-secondary);
    line-height: 15px;
    padding: 3px 2px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

export const PreviewGrid = styled.div<{ columns: number }>`
    display: grid;
    grid-template-columns: ${(props) =>
        `repeat(${props.columns}, minmax(0, 1fr))`};
    gap: var(--studio-grid-gap);
`;
