import { NButton } from "@features/studio/components/StudioButton";
import { useSpaceGatingEditor } from "../context/SpaceGatingContext";

export interface GatingCancelButtonProps {
    onClick: () => void;
}

export function GatingCancelButton({ onClick }) {
    const { saveState } = useSpaceGatingEditor();

    return (
        <NButton
            disabled={saveState.type === "Saving"}
            size="medium"
            className="cancel"
            overrideTheme={"light"}
            onClick={onClick}
        >
            Cancel
        </NButton>
    );
}

export interface GatingOkButtonProps {
    onClick: () => void;
}

export function GatingOkButton({ onClick }) {
    return (
        <NButton
            size="medium"
            onClick={onClick}
            overrideTheme={"light"}
            style={{ marginLeft: "5px" }}
        >
            Ok
        </NButton>
    );
}
