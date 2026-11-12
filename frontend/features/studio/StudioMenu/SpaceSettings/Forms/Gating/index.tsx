import { useState } from "react";
import styled from "styled-components";

import { SpaceGatingSettings } from "./SpaceGatingSettings";
import { SpaceGatingRoomCapacity } from "./SpaceGatingRoomCapacity";
import {
    SpaceGatingProvider,
    useSpaceGatingEditor,
} from "../context/SpaceGatingContext";
import { SpaceGatingWhitelist } from "./SpaceGatingWhitelist";
import { SpaceGatingDate } from "./SpaceGatingDate";
import { SpaceGatingNfts } from "./SpaceGatingNft";
import { CurrentForm } from "./types";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { GatingData, GatingType } from "../types";
import { deepEqual } from "@utils/js";
import { useFormHandler } from "../context/ActionsContext";
import { noop } from "lodash";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { SpaceGatingPassword } from "./SpaceGatingPassword";

const keys: Record<CurrentForm, GatingType> = {
    GatingDate: "date",
    GatingNfts: "nftOwnership",
    GatingRoomCapacity: "roomCapacity",
    GatingWhitelist: "whitelist",
    GatingPassword: "password",
    GatingSettings: null,
};

export function Gating() {
    //
    const { exhibit } = useCurrentExhibit();

    const [currentForm, setCurrentForm] =
        useState<CurrentForm>("GatingSettings");

    const { gating, editGating } = useSpaceGatingEditor();

    const [initFormState, setInitFormState] = useState(exhibit);

    const cancelGatingEdit = useEventCallback((toggle) => {
        //
        const key = keys[currentForm];

        if (key == null) return;

        const state = initFormState.gating?.[key];

        if (!deepEqual(state, gating?.[key])) {
            editGating(
                {
                    [key]: state,
                },
                "undo"
            );
        }

        toggle(false);
        //
    }, []);

    // useFormHandler(null, cancelGatingEdit);

    const goto = (form: CurrentForm) => () => {
        setCurrentForm(form);
        setInitFormState(exhibit);
    };

    let content;

    if (currentForm === "GatingSettings") {
        content = <SpaceGatingSettings goto={goto} />;
    } else if (currentForm === "GatingRoomCapacity") {
        content = <SpaceGatingRoomCapacity initState={initFormState.gating} />;
    } else if (currentForm === "GatingWhitelist") {
        content = <SpaceGatingWhitelist initState={initFormState.gating} />;
    } else if (currentForm === "GatingDate") {
        content = <SpaceGatingDate initState={initFormState.gating} />;
    } else if (currentForm === "GatingNfts") {
        content = <SpaceGatingNfts initState={initFormState.gating} />;
    } else if (currentForm === "GatingPassword") {
        content = <SpaceGatingPassword initState={initFormState.gating} />;
    }

    return <Container>{content}</Container>;
}

const Container = styled.div``;
