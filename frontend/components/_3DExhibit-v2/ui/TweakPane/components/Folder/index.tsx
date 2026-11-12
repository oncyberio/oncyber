import React from "react";
import IconImg from "@ui/components/IconImg";
import { Container, Wrapper } from "./styles";
import { useEventCallback } from "@components/hooks/useEventCallback";

export default function Folder({ title, gui, children }) {
    const isVisible = gui.params.visible;

    const handleVisibleChange = useEventCallback((b: boolean) => {
        gui.toggle(b);
    }, []);

    return (
        <Container>
            <Wrapper
                onClick={() => {
                    handleVisibleChange(!isVisible);
                }}
            >
                <IconImg
                    className="icon"
                    name={isVisible ? "chevron-down" : "chevron-right"}
                    size={20}
                    mode="light"
                />
                <span>{title}</span>
            </Wrapper>
            <div
                className="folder"
                style={{
                    width: "100%",
                    paddingLeft: "18px",
                    paddingRight: "5px",
                }}
            >
                {isVisible && children}
            </div>
        </Container>
    );
}
