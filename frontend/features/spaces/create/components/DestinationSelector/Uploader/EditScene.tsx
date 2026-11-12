import { useState, useMemo } from "react";

import { RoomParameters, Spline } from "@uitypes/roomParameters";
import styled from "styled-components";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { Experience, Kitbash, Stylekit } from "@uitypes/experience";
import { PhysicsGUI } from "./Guis/PhysicsGUI";
import { Exhibit3DUploader_Child as UploaderScene } from "@3/displyUI/UploaderScene";
import { Destination } from "@uitypes/destinations";
import { WorldState } from "@components/_3DExhibit-v2/utils/constants";
import { CinematicGUI } from "./Guis/CinematicGUI";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { uploadKitbashImages } from "utils/media/mediaUploader";
import { APP_STATES } from "@3constants";
import { KitbashGUI } from "./Guis/KitbashGUI";
import { useDialogTheme } from "@components/Dialogs";
import {
    ExhibitProvider,
    useCurrentExhibit,
} from "@features/studio/context/ExhibitContext";
import { ExhibitEditorProvider } from "@features/studio/context/ExhibitEditorContext";
import { HeaderNav } from "./HeaderNav";
import {
    getDefaultCyberkitDataFromRoom,
    getDefaultEmptyRoomData,
} from "@components/_3DExhibit-v2/three/factory/space/roomdatacompat";
import { useWorldHandler } from "@components/_3DExhibit-v2/hooks/useWorldHandler";
import Events from "@3events";

export interface EditSceneProps {
    destination: Destination;
    stylekit: Stylekit;
    submitAction: string;
    newUpload?: {
        fileURL: string;
    };
    onSubmit: (
        params: RoomParameters,
        kitbash: Kitbash,
        spline?: Spline
    ) => unknown;
    onCancel: () => unknown;
    spline: Spline;
}

if (typeof window != "undefined") {
    (window as any).$uploadKit = uploadKitbashImages;
}

type GuiState = "Settings" | "Cinematic" | "World";

function createExhibit(room, kitbash) {
    //
    const exhibit: Experience = {
        id: `room-test`,
        createdAt: new Date().toISOString(),
        number_of_visits: 0,
        info: {
            curator: "",
            room,
            heroImg: "",
            headline: "Edit physics",
        },
        editors: ["0x0000000000000000000000000000000000000000"],
        owner: "0x0000000000000000000000000000000000000000",
        artworks: {},
        portals: {},
    };

    if (kitbash) {
        exhibit.kitbash = kitbash;
    }

    return exhibit;
}

const EditScene_Child = ({
    destination,
    stylekit,
    spline,
    newUpload,
    exhibit,
    roomParameters,

    submitAction,
    onSubmit,
    onCancel,
}: EditSceneProps & {
    exhibit: Experience;
    roomParameters: RoomParameters;
}) => {
    // Used by GUI

    const { exhibitStore } = useCurrentExhibit();

    useDialogTheme("dark");

    useWorldHandler(Events.KITBASH_DEFAULT_DATA, (data) => {
        //
        if (!newUpload) return;

        exhibitStore.updateExhibit((draft) => {
            //
            Object.keys(data).forEach((id) => {
                //
                draft.kitbash[id] = structuredClone(data[id]);

                draft.kitbash[id]._version = Date.now();
            });
        });
    });

    const handleSubmit = useEventCallback(async () => {
        //
        const params = world.current.getRoomParameters();

        const spline = world.current.getCinematicSpline();

        let kitbash;

        if (params.isFuture) {
            //
            kitbash = world.current.getKitBashData();
        }

        onSubmit(params, kitbash, spline);
        //
    }, []);

    const world = useWorld();

    const [guiState, setGuiState] = useState<GuiState>("Settings");

    const handleSwitch = useEventCallback(async (opt: GuiState) => {
        if (opt === "Settings") {
            //
            await world.current.toggleMapControls({ enabled: false });

            await world.current.setState(APP_STATES.SPACE, {
                switch: "display",
            });

            setGuiState("Settings");
            //
        } else if (opt === "Cinematic") {
            //
            await world.current.toggleMapControls({ enabled: false });

            await world.current.setState(APP_STATES.CINEMATIC, {
                advanced: true,
                edit: true,
            });

            setGuiState("Cinematic");
            //
        } else if (opt === "World") {
            //
            await world.current.setState(APP_STATES.SPACE, {
                switch: "edit",
            });

            await world.current.toggleMapControls({ enabled: true });

            setGuiState("World");
        }
    }, []);

    return (
        <Container>
            <NavWrap>
                <HeaderNav
                    isFuture={roomParameters.isFuture}
                    guiState={guiState}
                    onSwitchUI={handleSwitch}
                    onSubmit={handleSubmit}
                />
            </NavWrap>

            {exhibit != null && (
                <>
                    <UploaderScene
                        key={exhibit.id}
                        isUploader
                        guiState={guiState}
                        exhibit={exhibit}
                        destination={null}
                        isSceneBackground
                        spline={spline}
                        uploaderParameters={roomParameters}
                        onSceneLoaded={() => {
                            //
                            if (roomParameters.isFuture) {
                                //
                                handleSwitch("World");
                            }
                        }}
                    >
                        {({ worldState }: { worldState: WorldState }) => {
                            //
                            if (
                                worldState.type != "SPACE_IDLE" &&
                                worldState.type != "SPACE_PLAYING"
                            ) {
                                return null;
                            }

                            if (guiState === "Settings") {
                                return (
                                    <PhysicsGUI
                                        submitAction={submitAction}
                                        handleSubmit={handleSubmit}
                                        handleCancel={onCancel}
                                    />
                                );
                            } else if (guiState === "Cinematic") {
                                return (
                                    <CinematicGUI
                                        submitAction={submitAction}
                                        handleSubmit={handleSubmit}
                                        handleCancel={onCancel}
                                    />
                                );
                            } else if (guiState === "World") {
                                return (
                                    <KitbashGUI
                                        submitAction={submitAction}
                                        handleSubmit={handleSubmit}
                                        handleCancel={onCancel}
                                    />
                                );
                            }
                        }}
                    </UploaderScene>
                </>
            )}
        </Container>
    );
};

export default function EditScene(props: EditSceneProps) {
    //
    const { destination, stylekit, newUpload } = props;

    // Used to render the 3D scene
    const roomParameters = useMemo(() => {
        //
        let result: RoomParameters = {
            ...destination.params,
        } as any;

        if (newUpload) {
            //
            delete result.paths;
            delete result.kitbash;

            result.uPath = newUpload;
        } else {
            result.paths = destination.paths;
        }

        return result;
        //
    }, []);

    const exhibit = useMemo(() => {
        //
        let kitbash: any = stylekit?.kitbash ?? {};

        if (roomParameters.isFuture) {
            //
            if (props.newUpload) {
                //
                kitbash = getDefaultEmptyRoomData();
                //
            } else {
                //
                kitbash = {
                    ...kitbash,
                    ...getDefaultCyberkitDataFromRoom(roomParameters, kitbash),
                };
            }
        }

        const res = createExhibit(destination.slug, kitbash);

        return res;
    }, []);

    return (
        <ExhibitProvider
            exhibit={exhibit}
            destination={roomParameters}
            mode="memory"
        >
            <ExhibitEditorProvider>
                <EditScene_Child
                    {...props}
                    exhibit={exhibit}
                    roomParameters={roomParameters}
                />
            </ExhibitEditorProvider>
        </ExhibitProvider>
    );
}

const Container = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
    width: 100vw;
    height: 100vh;
    color: #070707;
    background: linear-gradient(#fff, #fff);
`;

const NavWrap = styled.div`
    width: 100%;
    z-index: 200000000;
    position: fixed;

    .header-nav-close-icon {
        color: #fff !important;
    }

    .invertColor.logo {
        filter: invert(0) !important;
    }

    .links {
        color: #fff !important;

        img {
            filter: invert(0) !important;
        }
    }

    .users-dropdown {
        p.dropdown-username {
            color: #fff !important;
        }

        span.dropdown-wallet-address {
            color: rgba(255, 255, 255, 0.5) !important;
        }
    }
`;
