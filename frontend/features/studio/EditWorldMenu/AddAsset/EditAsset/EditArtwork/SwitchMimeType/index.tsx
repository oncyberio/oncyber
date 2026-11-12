import { useState, useMemo } from "react";
import styled from "styled-components";
import Dropdown from "@ui/components/Dropdown";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { Asset } from "@uitypes/Asset";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";

const switchingItem = {
    title: "Switching...",
    value: "switching",
};

export function SwitchMimeType() {
    //
    const mesh = useSelectedArtwork();

    const { handleAddNft, exhibit } = useEditWorld();

    const [selectedType, setSelectedType] = useState(
        mesh?.userData?.mime_type || ""
    );

    const [isSwitching, setSwitching] = useState(false);

    async function handleChange(type) {
        //
        try {
            //
            setSwitching(true);

            const artwork = exhibit.artworks[mesh.userData.id];

            const asset = { ...artwork.data, mime_type: type } as Asset;

            await handleAddNft({ asset });

            setSelectedType(type);
        } finally {
            //
            setSwitching(false);
        }
    }

    const items = useMemo(() => {
        //
        return mesh.userData.files.map(({ type, url }) => ({
            title: type,
            value: type,
        }));
    }, [mesh.userData?.files]);

    return (
        <Field>
            <Label className="component-label">Change asset type</Label>
            <Dropdown
                disabled={isSwitching}
                onChange={handleChange}
                items={isSwitching ? [switchingItem] : items}
                value={isSwitching ? switchingItem.value : selectedType}
                overrideTheme={"dark"}
                style={{ width: "100%" }}
            />
        </Field>
    );
}
