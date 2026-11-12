import IconImg from "@ui/components/IconImg";
import { Tool } from "@features/studio/styles/Toolbar";

export function tool(name: string, disabled = false, toggled = false) {
    //
    return (
        <Tool
            className="tool-btn"
            state={toggled ? "toggled" : null}
            disabled={disabled}
        >
            <IconImg className="tool-icon" name={name} size={22} />
        </Tool>
    );
}
