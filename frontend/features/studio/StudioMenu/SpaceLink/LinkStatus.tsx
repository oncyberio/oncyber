import Spinner from "@ui/components/Spinner";
import IconImg from "@ui/components/IconImg";

import type { LinkState } from "../context/useCustomLinkEditor";

export type { LinkState };

export interface LinkStatusProps {
    status: LinkState;
    onCopy: () => void;
}

export function LinkStatus({ status, onCopy }: LinkStatusProps) {
    //

    if (status === "success") {
        return (
            <IconImg size={14} name="check" style={{ filter: "invert(1)" }} />
        );
    }

    if (status === "loading") {
        return <Spinner width={14} />;
    }

    if (status === "error") {
        return (
            <IconImg
                size={14}
                name="x-circle"
                style={{ filter: "invert(1)" }}
            />
        );
    }

    if (status === "copy") {
        return (
            <div onClick={onCopy} style={{ cursor: "pointer" }}>
                <IconImg
                    size={14}
                    name="copy"
                    style={{ filter: "invert(1)" }}
                />
            </div>
        );
    }
}
