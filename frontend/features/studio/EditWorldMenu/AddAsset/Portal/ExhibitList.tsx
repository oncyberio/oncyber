import { useEventCallback } from "@components/hooks/useEventCallback";
import Spinner from "@ui/components/Spinner";
import { Experience } from "@uitypes/experience";
import styled from "styled-components";
import { useEditWorld } from "../../context/WorldEditContext";
import { Preview, PreviewGrid } from "../shared/Preview";
import { ExhibitPreview } from "./ExhibitPreview";

export interface ExhibitListProps {
    exhibits: Experience[];
    isElevator: boolean;
}

export function ExhibitList({ exhibits, isElevator }: ExhibitListProps) {
    //
    const { handleAddPortal, addState, selectedMesh, lockedTargets } =
        useEditWorld();

    const handleAddClick = useEventCallback((exhibit, e) => {
        //
        handleAddPortal({
            targetExhibit: exhibit,
            keepPlaceholder: e.shiftKey,
            isElevator,
            source: "click",
            autoSelect: true,
        });
    }, []);

    const isTargetLocked = selectedMesh && lockedTargets.has(selectedMesh);

    return (
        <PreviewGrid className="yt-grid y-scroll" columns={2}>
            {exhibits.map((exhibit, index) => {
                //
                const title = exhibit.info?.headline || "Untitled";

                const key = exhibit.id;

                const isSubmitting =
                    addState.portal[key]?.state?.type === "Submitting";

                const img = (
                    <ExhibitPreview
                        key={key}
                        exhibit={exhibit}
                        name={title}
                        index={index}
                        draggable={true}
                        isSubmitting={isSubmitting}
                        isLocked={isTargetLocked}
                    />
                );

                return (
                    <Preview
                        key={index}
                        image={img}
                        title={title}
                        onClick={(e) => {
                            if (isSubmitting) {
                                return;
                            }
                            handleAddClick(exhibit, e);
                        }}
                        content={
                            isSubmitting ? (
                                <Loading>
                                    <Spinner />
                                </Loading>
                            ) : null
                        }
                    />
                );
            })}
        </PreviewGrid>
    );
}

const Loading = styled.div`
    position: absolute;
    z-index: 1;
    width: 100%;
    height: 100%;

    display: flex;
    align-items: center;
    justify-content: center;
`;
