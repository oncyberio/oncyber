import styled from "styled-components";

export function Layout({
    children,
    layout = "row",
    gap = 10,
    align = "center",
    justify = "start",
    wrap = "wrap",
    padding = 0,
}) {
    //

    return (
        <div
            style={{
                display: "flex",
                flexDirection: layout as any,
                alignItems: align,
                justifyContent: justify,
                gap,
                flexWrap: wrap as any,
                userSelect: "none",
                padding,
            }}
        >
            {children}
        </div>
    );
}
