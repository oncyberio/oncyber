/**
 * The icon beside a step of a multi-step form. In a file of its own so
 * that a form elsewhere (the account dashboard) can use it without
 * importing every form of the space's settings, and the date picker and
 * charts those bring.
 */
import styled from "styled-components";
import IconImg from "@ui/components/IconImg";

const IconBtn = styled.div<{ active: boolean; isLight: boolean }>`
    width: 24px;
    height: 24px;
    background: transparent;
    flex-shrink: 0;

    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;

    & > .icon {
        filter: invert(1);
        opacity: ${(props) => (props.active ? 1 : 0.65)};
    }
`;

export function stepIcon(name: string) {
    return ({ active, isLight }) => {
        return (
            <IconBtn isLight={isLight} className="btn-icon" active={active}>
                <IconImg className="icon" name={name} size={16} />
            </IconBtn>
        );
    };
}
