import Check from "@ui/icons/Check";
import Spinner from "@ui/components/Spinner";
import CloseIcon from "@ui/icons/CloseIcon";
import { Copy } from "./Copy";
import IconImg from "@ui/components/IconImg";

import type { LinkState } from "../../../context/useCustomLinkEditor";

export type { LinkState };

export interface LinkStatusProps {
    link: string;
    status: LinkState;
    onCopy: () => void;
}

export function LinkStatus({ link, status, onCopy }: LinkStatusProps) {
    //

    if (status === "success") {
        return <IconImg name="check" style={{ filter: "invert(1)" }} />;
    }

    if (status === "loading") {
        return <Spinner width={24} />;
    }

    if (status === "error") {
        return <IconImg name="x-circle" style={{ filter: "invert(1)" }} />;
    }

    if (status === "copy") {
        return <Copy text={link} onCopy={onCopy} />;
    }
}
