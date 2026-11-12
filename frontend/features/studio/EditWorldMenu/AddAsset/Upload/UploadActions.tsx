import { SelectableDropdownMenu } from "@features/studio/components/SelectableDropdownMenu";
import IconImg from "@ui/components/IconImg";
import styled from "styled-components";
import { useEditWorld } from "../../context/WorldEditContext";
import { UploadOpt } from "../shared/AssetTypes";

const actions = [
    { title: "Rename", value: "rename" },
    { title: "Delete", value: "delete" },
] as const;

export type UploadAction = typeof actions[number]["value"];

export interface UploadActionsProps {
    onAction: (action: UploadAction) => unknown;
}

export function UploadActions({ onAction }) {
    //

    const { addTogglerRef } = useEditWorld();

    return (
        <SelectableDropdownMenu
            caption={caption}
            align="center"
            items={actions as any}
            value={null}
            onChange={onAction}
            addTogglerRef={(el) => {
                addTogglerRef(UploadOpt.value, el);
            }}
        />
    );
}

const Caption = styled.div`
    filter: invert(1);
`;

const caption = (
    <Caption>
        <IconImg size={20} name="more-vertical" />
    </Caption>
);
