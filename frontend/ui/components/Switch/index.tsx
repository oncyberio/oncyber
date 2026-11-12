import React, {
    forwardRef,
    ReactNode,
    CSSProperties,
    useState,
    useEffect,
} from "react";
import { StyledSwitch, StyledSwitchProps, StyledButton } from "./styles";

type TagProps = StyledSwitchProps &
    React.HTMLAttributes<HTMLSpanElement> & {
        style?: CSSProperties;
        defaultSelected?: string;
        onSelect: (key: string) => void;
        items: Array<{
            key: string;
            title?: string;
            el?: React.ReactNode;
        }>;
    };

const Switch = forwardRef(
    (props: TagProps, ref: React.Ref<HTMLSpanElement>) => {
        const {
            items,
            defaultSelected,
            onSelect,
            innerBorderRadius,
            fontSize,
        } = props;

        const [selected, setSelected] = useState(
            defaultSelected || items[0]?.key || null
        );

        useEffect(() => {
            setSelected(defaultSelected);
        }, [defaultSelected]);

        const handleSelect = (key: string) => {
            setSelected(key);
            onSelect?.(key);
        };

        return (
            <StyledSwitch ref={ref} {...props}>
                {items?.map(({ title, el, key }) => (
                    <StyledButton
                        key={key}
                        onClick={() => handleSelect(key)}
                        isActive={key === selected}
                        fontSize={fontSize || "14px"}
                        innerBorderRadius={innerBorderRadius || "8px"}
                    >
                        {el || title}
                    </StyledButton>
                ))}
            </StyledSwitch>
        );
    }
);

Switch.defaultProps = {
    items: [],
};

export default Switch;
