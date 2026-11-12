import IconImg from "@ui/components/IconImg";
import { IconBtn } from "@features/studio/styles/Button";
export function LockTransformControl({
    locked,
    disabled = false,
    onChange,
}: {
    locked: boolean;
    disabled?: boolean;
    onChange: () => void;
}) {
    return (
        <IconBtn
            disabled={disabled}
            onClick={onChange}
            aria-label={`${locked ? "Unlock" : "Lock"} asset position`}
        >
            <IconImg
                name={locked ? "lock" : "unlock"}
                size={14}
                style={{ filter: "invert(1)" }}
                title={`${locked ? "Unlock" : "Lock"} asset position`}
            />
        </IconBtn>
    );
}
