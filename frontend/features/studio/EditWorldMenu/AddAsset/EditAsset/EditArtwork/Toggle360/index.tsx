import { useEventCallback } from "@components/hooks/useEventCallback";
import { useSyncState } from "@components/hooks/useSyncState";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import Spinner from "@ui/components/Spinner";
import { useState } from "react";

export function Toggle360() {
    //
    const selectedMesh = useSelectedArtwork();

    const { handleToggle360 } = useEditWorld();

    const [is360Active, toggle360] = useSyncState(
        selectedMesh?.userData?.mime_type === "panorama/jpg"
    );

    const [loading, setLoading] = useState(false);

    const handleToggle = useEventCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            //
            try {
                //
                const is360Active = e.target.checked;

                setLoading(true);

                await handleToggle360({ is360Active });

                toggle360(is360Active);
                //
            } finally {
                //
                setLoading(false);
            }
        },
        []
    );

    return (
        <Field inline={true}>
            <Label className="component-label"> Toggle 360 </Label>

            {!loading ? (
                <input
                    type="checkbox"
                    onChange={handleToggle}
                    checked={is360Active}
                />
            ) : (
                <Spinner width={18} />
            )}
        </Field>
    );
}
