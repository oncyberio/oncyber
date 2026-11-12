import { usePresence } from "framer-motion";
import { Card } from "../Card";
import { usePreset } from "../../usePresets";

export function Preset({ preset, onChange }) {
    //
    const props = usePreset({ preset, onChange });

    return <Card {...props} />;
}
