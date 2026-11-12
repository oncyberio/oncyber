import Input from "@ui/components/Input";
import { useContext, useState, useEffect } from "react";
import styled from "styled-components";
import { useAssetsMenuContext } from "../../context/useAssetsMenuContext";

const ButtonArea = (props) => {
    const [websiteName, setWebsiteName] = useState(
        props.defaultName || "Website Name"
    );

    const { close } = useAssetsMenuContext();

    let buttonStyle = {
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        padding: "8px 24px",
        borderRadius: "30px",
        fontSize: "15px",
        fontWeight: "500",
        width: "min-content",
        color: "#777980",
        border: "1px solid #E0E0E0",
        whiteSpace: "nowrap",
    };

    let disabledStyle = {
        ...buttonStyle,
        backgroundColor: "#cdcdcd",
        color: "#fff",
    };

    return (
        <div
            style={{
                marginTop: "20px",
                width: "100%",
            }}
        >
            <Separator />
            <div
                style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "15px",
                }}
            >
                <button
                    style={{
                        ...buttonStyle,
                        backgroundColor: "#fff",
                        color: "#000",
                        cursor: "pointer",
                    }}
                    onClick={() => {
                        close();
                    }}
                >
                    Cancel
                </button>
                {
                    props?.disabled ? (
                        <button style={disabledStyle}>Add Website</button>
                    ) : (
                        <button
                            style={{
                                ...buttonStyle,
                                border: "1px solid #000",
                                backgroundColor: "#000",
                                color: "#fff",
                                cursor: "pointer",
                            }}
                            onClick={() => {
                                if (!props?.disabled) props.click();
                            }}
                        >
                            Add Website
                        </button>
                    ) //Need cursor
                }
            </div>
        </div>
    );
};
const Separator = styled.div`
    width: 100%;
    height: 1.3px;
    background: #f1f1f7;
    margin-bottom: 20px;
`;

export default ButtonArea;
