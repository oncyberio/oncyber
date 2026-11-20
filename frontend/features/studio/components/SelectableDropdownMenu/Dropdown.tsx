import {
    brandMenuPanel,
    brandMenuRow,
} from "@features/studio/styles/brandMenu";
import IconImg from "@ui/components/IconImg";
import React, { CSSProperties } from "react";
import styled from "styled-components";
import { OptionItem } from "../../types";
import { classes } from "@utils/js";
import { tx } from "@components/context/I18nContext";

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
                            size={14}
                        />
                        <span className="title">{tx(it.title)}</span>
                    </button>
                );
            })}
        </Container>
    );
}

const Container = styled.div<{ noSelect?: boolean }>`
    ${brandMenuPanel}
    min-width: 160px;

    & > .item {
        ${brandMenuRow}

        &.center {
            justify-content: center;
        }

        & .check-icon {
            order: 2;
            ${(props) => (props.noSelect ? "display: none;" : "")}
            visibility: hidden;
            filter: invert(1);
        }

        &.active {
            color: var(--oc-ink);
        }

        &.active > .check-icon {
            visibility: visible;
        }

        & .title {
            white-space: nowrap;
        }
    }
`;
