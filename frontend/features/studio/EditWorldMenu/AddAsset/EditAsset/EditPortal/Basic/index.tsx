import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useSelectedPortal } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import styled from "styled-components";
import { ExhibitPreview } from "../../../Portal/ExhibitPreview";
import { PortalOpt } from "../../../shared/AssetTypes";

import PortalController, { Command } from "../shared/PortalController";

export default function Basic() {
    //
    const { uiDispatch } = useEditWorld();

    const portal = useSelectedPortal();

    let content;

    if (portal.portalData?.exhibit) {
        //
        const targetExhibit = portal.portalData.exhibit;

        const name = targetExhibit?.info?.headline || "Untitled";

        content = (
            <Field>
                <Label>Portal Currently Connected to “{name}”</Label>
                <Preview>
                    <ExhibitPreview
                        exhibit={targetExhibit}
                        name={name}
                        index={0}
                    />
                </Preview>
            </Field>
        );
    } else {
        content = (
            <>
                <Label>The space linked to this portal was deleted!!</Label>
                <Command
                    style={{ marginBottom: 18 }}
                    onClick={() => {
                        //
                        uiDispatch({ type: "opt-on", option: PortalOpt });
                    }}
                >
                    <strong>🔗 Click connect another space</strong>
                </Command>
            </>
        );
    }

    return (
        <Container>
            {content}
            <PortalController />
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const Preview = styled.div`
    width: 100%;
    border-radius: 8px;
    overflow: hidden;

    & > .preview-img {
        width: 100%;
        height: 150px;
        object-fit: cover;
        cursor: default;
    }
`;
