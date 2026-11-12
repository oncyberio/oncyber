import { studioMenuItem } from "@features/studio/styles/primitives";
import IconImg from "@ui/components/IconImg";
import React, { CSSProperties } from "react";
import styled from "styled-components";
import { OptionItem } from "../../types";
import { classes } from "@utils/js";

//
export interface DropdownProps<K> {
    isShowing?: boolean;
    items: Array<OptionItem<K>>;
    value: K | K[];
    align?: "center" | "left" | "right";
    onChange: (type: K) => void;
}

export function Dropdown<K>({
    isShowing,
    items,
    value,
    align = "left",
    onChange,
}: DropdownProps<K>) {
    //
    const handleItemClick = (type: K) => (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(type);
    };

    return (
        <Container className="s-dropdown" noSelect={value == null}>
            {items.map((it, index) => {
                //
                const isSelcted = Array.isArray(value)
                    ? value.includes(it.value)
                    : value != null && value == it.value;

                return (
                    <button
                        type="button"
                        aria-pressed={isSelcted}
                        key={index}
                        className={classes({
                            item: true,
                            [align]: true,
                            active: isSelcted,
                        })}
                        onClick={handleItemClick(it.value)}
                    >
                        <IconImg
                            className="check-icon"
                            name="check"
                            size={12}
                        />
                        <span className="title">{it.title}</span>
                    </button>
                );
            })}
        </Container>
    );
}

const Container = styled.div<{ noSelect?: boolean }>`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 4px;
    gap: 2px;
    min-width: 100px;
    box-shadow: var(--panel-shadow);
    border: var(--panel-border);
    overflow: hidden;
    border-radius: var(--studio-radius-card);

    background: var(--panel-bg);
    color: var(--panel-text-secondary);

    & > .item {
        ${studioMenuItem}
        display: flex;
        flex-direction: row;
        gap: 6px;
        align-items: center;
        justify-content: flex-start;
        padding: 8px 10px;
        font: 13px/20px var(--studio-font, sans-serif);
        cursor: pointer;
        width: 100%;

        &.center {
            justify-content: center;
        }

        &.right {
            justify-content: flex-end;
        }

        & .check-icon {
            ${(props) => (props.noSelect ? "display: none;" : "")}
            visibility: hidden;
            filter: invert(1);
        }

        &.active > .check-icon {
            visibility: visible;
        }

        & .title {
            white-space: nowrap;
        }

        transition: 0.2s;
        &:hover {
            background: var(--panel-bg-hover);
            color: white;
        }
    }
`;
