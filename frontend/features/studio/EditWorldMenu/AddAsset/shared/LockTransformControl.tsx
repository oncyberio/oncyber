import IconImg from "@ui/components/IconImg";
import { IconBtn } from "@features/studio/styles/Button";
import { tx } from "@components/context/I18nContext";
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
            aria-label={tx(
                locked ? "Unlock asset position" : "Lock asset position"
            )}
        >
            <IconImg
                name={locked ? "lock" : "unlock"}
                size={14}
                style={{ filter: "invert(1)" }}
                title={tx(
                    locked ? "Unlock asset position" : "Lock asset position"
                )}
            />
        </IconBtn>
    );
}
