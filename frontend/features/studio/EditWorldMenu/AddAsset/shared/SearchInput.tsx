import { TextInput } from "@features/studio/styles/Input";
import styled from "styled-components";

export interface SearchInputProps {
    className?: string;
    style?: React.CSSProperties;
    placeholder?: string;
    value: string;
    onChange: (s: string) => unknown;
}

export function SearchInput({
    className = "",
    style = {},
    placeholder = "",
    value,
    onChange,
}: SearchInputProps) {
    //
    return (
        <TextInput
            className={className}
            style={style}
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
                onChange(e.target.value);
            }}
        />
    );
}
