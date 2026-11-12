import React from "react";
import { Container, Wrapper } from "./styles";
import IconImg from "@ui/components/IconImg";

const Collapse = React.memo(({ collapsed, title, onToggle }: any) => {
    //
    // console.log("rendering Folder header...", title);

    return (
        <Wrapper
            onClick={() => {
                //
                onToggle();
            }}
        >
            <IconImg
                className="icon"
                name={!collapsed ? "chevron-down" : "chevron-right"}
                size={20}
                mode="light"
            />
            <span>{title}</span>
        </Wrapper>
    );
});

export function Folder({ title, collapsed, onToggle, children, style = {} }) {
    //
    return (
        <Container style={style}>
            <Collapse title={title} collapsed={collapsed} onToggle={onToggle} />
            <div
                className="folder"
                style={{
                    display: collapsed ? "none" : "block",
                    width: "100%",
                    paddingLeft: "18px",
                    paddingRight: "5px",
                }}
            >
                {children}
            </div>
        </Container>
    );
}
