import { useState } from "react";
import Duplicate from "@ui/icons/Duplicate";

export interface CopyProps {
    text: string;
    onCopy: () => void;
}

export function Copy({ text, onCopy }) {
    //

    const copyToClipboard = () => {
        navigator.clipboard.writeText(text);
        onCopy();
    };

    return (
        <Duplicate
            style={{ marginTop: "5px" }}
            strokeColor={"#18191C"}
            onClick={copyToClipboard}
        />
    );
}
