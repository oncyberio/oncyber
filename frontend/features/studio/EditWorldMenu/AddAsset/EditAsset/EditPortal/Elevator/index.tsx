import Tabs from "@ui/components/Tabs";
import { useState } from "react";
import PortalController from "../shared/PortalController";
import LevelsController from "./LevelsController";

export default function Elevator() {
    //
    const [active, setActive] = useState("edit");

    return (
        <div>
            <Tabs
                style={{ marginBottom: 18 }}
                tabs={[
                    { title: "Edit Portal", name: "edit" },
                    { title: "Levels", name: "levels" },
                ]}
                active={active}
                setActive={(e) => setActive(e)}
            />

            {active === "edit" ? <PortalController /> : null}

            {active === "levels" ? <LevelsController /> : null}
        </div>
    );
}
