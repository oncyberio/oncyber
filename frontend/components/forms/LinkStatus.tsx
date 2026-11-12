import Check from "@ui/icons/Check";
import Spinner from "@ui/components/Spinner";
import CloseIcon from "@ui/icons/CloseIcon";
import { Copy } from "./Copy";
import { useEffect, useState } from "react";

export interface LinkStatusProps {
    link: string;
    status: "copy" | "loading" | "error" | "success";
    onCopy: () => void;
}

export function LinkStatus({ link, status, onCopy }: LinkStatusProps) {
    //

    if (status === "success") {
        return <Check strokeColor="#48C9B0" style={{ marginTop: "5px" }} />;
    }

    if (status === "loading") {
        return <Spinner width={24} isLightTheme />;
    }

    if (status === "error") {
        return <CloseIcon color="#18191C" />;
    }

    if (status === "copy") {
        return <Copy text={link} onCopy={onCopy} />;
    }
}
