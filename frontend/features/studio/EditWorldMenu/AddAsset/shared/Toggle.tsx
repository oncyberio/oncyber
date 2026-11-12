import { useEventCallback } from "@components/hooks/useEventCallback";
import styled from "styled-components";

export function Toggle({ value, onChange }) {
    //
    const handleToggleOnHD = useEventCallback(() => {
        onChange(true);
    }, []);

    const handleToggleOffHD = useEventCallback(() => {
        onChange(false);
    }, []);

    return (
        <StyledToggler>
            <ToggleButton toggle={value} onClick={handleToggleOnHD}>
                On
            </ToggleButton>
            <ToggleButton toggle={!value} onClick={handleToggleOffHD}>
                Off
            </ToggleButton>
        </StyledToggler>
    );
}

export const ToggleButton = styled.button<{ toggle: boolean }>`
    width: 40px;
    height: 24px;
    font-size: 12px;
    font-weight: 500;
    justify-content: center;
    background-color: ${(props) => (props.toggle ? "#ffffff" : "#3D3F46")};
    color: ${(props) => (props.toggle ? "#27282C" : "#F1F1F7")};
    border: none;
    cursor: pointer;
`;

export const StyledToggler = styled.div`
    display: flex;
    flex-direction: row;

    & > :not(:last-child) {
        border-right: none;
        border-radius: 6px 0 0 6px;
    }
    & > :last-child {
        border-left: none;
        border-radius: 0 6px 6px 0;
    }

    & > .off {
        border: 1px solid;
    }
`;
