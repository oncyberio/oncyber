import ChevronDown from "@ui/icons/ChevronDown";
import { useOnClickOutside } from "@hooks/useClickOutside";
import { forwardRef, useState, CSSProperties, useMemo, useEffect } from "react";
import { StyledDropdown, StyledDropdownProps } from "./styles";
import styled from "styled-components";

export type Item<T extends string = string> = {
    value: T;
    title: string;
    icon?: string;
    disabled?: boolean;
};

type DropdownProps = StyledDropdownProps & {
    style?: CSSProperties;
    onChange: Function;
    items: Array<Item>;
    disabled?: boolean;
    value: string;
    className?: string;
    listStyle?: any;
    itemStyle?: any;
    iconSize?: string;
    strokeColor?: string;
};

export type SvgItem<T extends string = string> = {
    value: T;
    title: string;
    icon?: any;
    disabled?: boolean;
};

const Dropdown = forwardRef(
    (props: DropdownProps, ref: React.Ref<HTMLDivElement>) => {
        const {
            isHidden,
            items,
            onChange,
            value,
            disabled,
            className,
            listStyle,
            itemStyle,
            iconSize = "20px",
            strokeColor,
            ...rest
        } = props;

        const [toggle, setToggle] = useState(true);

        const selectedItem =
            items.find((element) => element.value === value) || items[0];

        // const [selectedItem, setSelectedItem] = useState<Item>(defaultValue);

        // useEffect(() => {
        //     setSelectedItem(
        //         items.find(
        //             (element) =>
        //                 element.value.toLowerCase() === value.toLowerCase()
        //         ) || items[0]
        //     );
        // }, [value]);

        const hasIcons = useMemo(() => {
            items.some((it) => it.icon != null);
        }, [items]);

        const handleChange = (item: Item) => {
            //setSelectedItem(item);
            setToggle((prev) => !prev);
            onChange(item.value);
        };

        const { clickRef } = useOnClickOutside({
            handler: (e) => {
                setToggle(true);
            },
        });

        return (
            <StyledDropdown
                {...rest}
                isHidden={toggle}
                ref={clickRef}
                className={className}
            >
                <div
                    onClick={() => setToggle((prev) => !prev)}
                    className={`label ${disabled ? "disabled" : ""}`}
                >
                    {selectedItem.icon ? (
                        <ItemIcon src={selectedItem.icon} size={iconSize} />
                    ) : (
                        <div />
                    )}
                    <span style={{ display: "inline-block", width: "90%" }}>
                        {selectedItem?.title}
                    </span>
                    <ChevronDown style={{ minWidth: 12 }} />
                </div>
                <ul style={listStyle || {}}>
                    {items.map((item, index) => (
                        <Li
                            style={itemStyle || {}}
                            key={index}
                            className={item?.disabled && "disabled"}
                            onClick={() =>
                                !item?.disabled && handleChange(item)
                            }
                        >
                            {item.icon ? (
                                <ItemIcon src={item.icon} size={iconSize} />
                            ) : (
                                <div />
                            )}
                            <ItemText>{item.title}</ItemText>
                        </Li>
                    ))}
                </ul>
            </StyledDropdown>
        );
    }
);

Dropdown.defaultProps = {
    strokeColor: "#5D5F65",
};

export default Dropdown;

const Li = styled.li`
    display: grid;
    grid-template-columns: 0fr 1fr;
    align-items: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;

    div {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        width: 100%;
    }

    :hover {
        background-color: #f5f5f5;
    }
`;

const ItemIcon = styled.img<{ size: string }>`
    width: ${({ size }) => size};
    height: ${({ size }) => size};
    margin-right: 0.5rem;
`;

const ItemText = styled.div`
    display: inline-block;
    font-size: 14px;
`;
