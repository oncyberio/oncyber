import React from "react";
import styled from "styled-components";
import { Dropdown, DropdownProps } from "./Dropdown";
import { CustomDropdown, CustomDropdownProps } from "../CustomDropdown";

export type SelectableDropdownMenuProps<K> = {
    items: DropdownProps<K>["items"];
    value: K | K[];
    align?: DropdownProps<K>["align"];
    onChange: (value: K) => unknown;
    addTogglerRef?: (el: HTMLElement) => unknown;
} & Omit<CustomDropdownProps, "children">;

export function SelectableDropdownMenu<K>(
    props: SelectableDropdownMenuProps<K>
) {
    //
    const { items, value, align, onChange, ...rest } = props;

    return (
        <CustomDropdown {...rest}>
            {({ toggle }) => {
                return (
                    <Dropdown
                        items={items}
                        value={value}
                        align={align}
                        onChange={(type) => {
                            toggle(false);
                            onChange(type);
                        }}
                    />
                );
            }}
        </CustomDropdown>
    );
}

const Container = styled.div`
    position: relative;
`;
