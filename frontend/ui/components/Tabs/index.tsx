import { CSSProperties, FunctionComponent } from "react";
import styled from "styled-components";
import { Circle } from "../Separator";

interface TabsProps {
    tabs: Array<{
        title?: string;
        name: string;
        icon?: string;
        Title?: FunctionComponent;
    }>;
    separator: "none" | "circle";
    active: string;
    setActive: (active) => void;
    mode: "dark" | "light";
    style?: any;
}

export default function Tabs({
    tabs,
    separator,
    active,
    setActive,
    mode,
    style = {},
}: TabsProps) {
    // enableTheme
    return (
        <Container style={style} className={mode}>
            {tabs.map((tab, index) => {
                const { title, name, icon, Title } = tab;
                return (
                    <TabWrapper
                        className={mode}
                        active={active === name}
                        key={name}
                        onClick={() => {
                            console.log(name);
                            setActive(name);
                        }}
                    >
                        <span
                            style={{
                                marginRight: separator === "circle" ? 12 : 24,
                            }}
                        >
                            {title ? title : null}
                            {Title ? <Title /> : null}
                        </span>
                        {separator === "circle" && index !== tabs.length - 1 ? (
                            <Circle style={{ marginRight: 12, marginTop: 2 }} />
                        ) : null}
                    </TabWrapper>
                );
            })}
        </Container>
    );
}

Tabs.defaultProps = {
    tabs: [],
    separator: "none",
    active: "",
    setActive: () => {},
    mode: "light",
};

const Container = styled.div`
    display: flex;

    align-items: center;

    overflow-x: auto;

    font-size: 16px;

    font-weight: 500;

    text-align: left;

    & > div {
        display: flex;
        align-items: center;
    }
`;

const TabWrapper = styled.div<{
    active: boolean;
}>`
    cursor: pointer;

    span {
        white-space: nowrap;
    }

    &.dark {
        color: #777980;

        ${({ active }) =>
            active &&
            `
            color:#ffffff;
        `}
    }

    &.light {
        color: #777980;

        ${({ active }) =>
            active &&
            `
            color:#18191C;
        `}
    }
`;
