import Input from "@ui/components/Input";
import { useContext, useState, useEffect } from "react";
import styled from "styled-components";
import ButtonArea from "./buttonsArea";
const DownArea = (props) => {
    const [websiteName, setWebsiteName] = useState(
        props.defaultName || "Website Name"
    );

    return (
        <div
            style={{
                width: "100%",
                marginTop: "10px",
            }}
        >
            {/* <Input
                placeholder={props.defaultName || "Website Name"}
                background="#fff"
                color="#000"
                style={{
                    width: "100%",
                    fontWeight: "500",
                }}
                value={websiteName}
                onChange={(e) => {
                    setWebsiteName(e.target.value);
                }}
            ></Input> */}
            <ButtonArea
                click={() => {
                    props.click(websiteName);
                }}
            />
        </div>
    );
};
const Separator = styled.div`
    width: 100%;
    height: 1.3px;
    background: #f1f1f7;
    margin-bottom: 20px;
`;

export default DownArea;
