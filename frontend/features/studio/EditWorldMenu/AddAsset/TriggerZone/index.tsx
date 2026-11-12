import { useEventCallback } from "@components/hooks/useEventCallback";

import { useEditWorld } from "../../context/WorldEditContext";
import React from "react";
import { TriggerZonePicker, SIT_ZONE_OPTION } from "./TriggerZonePicker";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { Component3DFactory } from "@components/_3DExhibit-v2/three/factory/space/kits/types";

const nonCompOpts = [SIT_ZONE_OPTION];

function componentOption(component: Component3DFactory) {
    //
    const info = component.getInfo();

    return {
        id: info.type,
        title: info.title,
        image: info.imageXL || info.image,
    };
}

export default function TriggerZone() {
    //

    const { handleAddTriggerZone, handleAddKitbash } = useEditWorld();

    const world = useWorld();

    const wrapper = world.current.getFutureWrapper();

    const components = wrapper.getFactoryOptions().triggerZone;

    const componentOpts = components
        .filter((it) => it.type === "@@Component")
        .map((it) => componentOption((it as any).factory));

    const options = nonCompOpts.concat(componentOpts);

    const handleAdd = useEventCallback(async (trigger, e: React.MouseEvent) => {
        //
        if (trigger === "SIT_ZONES") {
            //
            await handleAddTriggerZone({
                type: "sit",
                keepPlaceholder: e.shiftKey,
                autoSelect: true,
            });
        } else {
            //
            await handleAddKitbash({
                ctype: "media-placeholder",
                kit: "cyber",
                autoSelect: true,
            });
        }
        //
    }, []);

    return <TriggerZonePicker options={options} onAdd={handleAdd} />;
}
