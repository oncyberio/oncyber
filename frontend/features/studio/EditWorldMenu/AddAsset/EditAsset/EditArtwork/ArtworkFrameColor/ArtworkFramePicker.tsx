import styled, { css } from "styled-components";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
const colors = ["#020202", "#5D4E43", "#CBA781"];
export function ArtworkFramePicker({
    value = "black-borderless",
    disabled = false,
    onChange,
}: {
    value?: string;
    disabled?: boolean;
    onChange: (color: string) => void;
}) {
    return (
        <Field>
            <Label className="component-label">Select Frame</Label>
            <BorderWrapper>
                <Colors style={{ padding: 0 }}>
                    {[
                        ["black-borderless", "Black backing, no frame"],
                        ["transparent-borderless", "Transparent, no frame"],
                        ...colors.map((color) => [color, `Frame ${color}`]),
                    ].map(([color, label]) => (
                        <ColorCircle
                            key={color}
                            type="button"
                            aria-label={label}
                            aria-pressed={value === color}
                            disabled={disabled}
                            selected={value === color}
                            color={color}
                            onClick={() => onChange(color)}
                        />
                    ))}
                    <ColorCircle
                        as="label"
                        selected={
                            !colors.includes(value) &&
                            /^#[a-f0-9]{6}$/i.test(value)
                        }
                        color="wheel"
                    >
                        <input
                            aria-label="Custom frame color"
                            style={{
                                opacity: 0,
                                width: "100%",
                                height: "100%",
                                cursor: disabled ? "default" : "pointer",
                            }}
                            type="color"
                            disabled={disabled}
                            value={
                                /^#[a-f0-9]{6}$/i.test(value)
                                    ? value
                                    : "#ffffff"
                            }
                            onChange={(event) => onChange(event.target.value)}
                        />
                    </ColorCircle>
                </Colors>
            </BorderWrapper>
        </Field>
    );
}
const BorderWrapper = styled.div`
    padding: 4px 5px;
    & > div {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 6px;
    }

    @media (max-width: 600px) {
        padding: 0;
        padding-left: 4px;
    }
`;

const Colors = styled.div`
    @media (max-width: 600px) {
        display: flex;
    }
`;

const ColorCircle = styled.button<{
    selected: boolean;
    color: string;
}>`
    width: 35px;
    height: 35px;
    min-width: 35px;
    min-height: 35px;
    cursor: pointer;

    ${({ color }) => {
        if (color === "black-borderless") {
            return css`
                background: linear-gradient(
                        to top left,
                        rgba(0, 0, 0, 0) 0%,
                        rgba(0, 0, 0, 0) calc(50% - 0.8px),
                        rgba(0, 0, 0, 1) 50%,
                        rgba(0, 0, 0, 0) calc(50% + 0.8px),
                        rgba(0, 0, 0, 0) 100%
                    ),
                    linear-gradient(
                        to top right,
                        rgba(0, 0, 0, 0) 0%,
                        rgba(0, 0, 0, 0) calc(50% - 0.8px),
                        rgba(0, 0, 0, 1) 50%,
                        rgba(0, 0, 0, 0) calc(50% + 0.8px),
                        rgba(0, 0, 0, 0) 100%
                    );
            `;
        } else if (color === "wheel") {
            return css`
                background: url(/images/color_wheel.png);
                background-size: 118%;
                background-position: center;
            `;
        } else if (color === "transparent-borderless") {
            return css`
                background: url(/images/checker.png);
                background-size: contain;
            `;
        } else {
            return css`
                background: ${color};
            `;
        }
    }}
    border: ${(props) =>
        props.selected ? "2px solid #ffffff" : "1px solid #ececec"};

    transform: ${(props) => (props.selected ? "scale(1.1)" : "none")};

    padding: 1px;
    border-radius: 35px;
    margin-right: 2px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    @media (max-width: 600px) {
        width: 24px;
        height: 24px;
    }
`;
