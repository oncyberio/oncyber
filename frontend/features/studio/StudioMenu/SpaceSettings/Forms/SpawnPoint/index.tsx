import { UserContext } from "@components/context/UserContext";
import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useSnackbar } from "@components/Snackbar";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { Toggle } from "@features/studio/components/Toggle";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { useStudioMenu } from "@features/studio/StudioMenu/context/StudioContext";
import IconImg from "@ui/components/IconImg";
import { Experience, XYZ } from "@uitypes/experience";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { formatLocation, parseLocation } from "@utils/js";
import { updateExhibitParams } from "@utils/saveToDb";
import { useContext, useState } from "react";
import { Label } from "recharts";
import styled from "styled-components";
import { Input } from "../shared/Input";
import {
    Form,
    FormInfo,
    FormLabel,
    FormLabelWrapper,
    FormError,
    FormSep,
    FormLabelAction,
} from "../styles/Form";

const labelStyle = {
    fontWeight: 400,
    fontSize: "12px",
    lineHeight: "20px",
    color: "#7A7A7A",
};

function coordsToText(position: XYZ, rotation: XYZ) {
    //
    if (position == null || rotation == null) return "";

    return formatLocation(position, rotation.y);
}

function textToCoords(s: string) {
    //
    const res = parseLocation(s);

    if (res == null) return null;

    return {
        position: res.position,
        rotation: { x: 0, y: res._y, z: 0 },
    };
}

const defPosition = { x: 0, y: 0, z: 0 };
const defRotation = defPosition;

type SpaceParams = Experience["params"];

export function SpawnPoint() {
    //
    const { token } = useContext(UserContext);

    const world = useWorld();

    const [openSnackbar, closeSnackbar] = useSnackbar({
        position: "top-right",
    });

    const { destination } = useStudioMenu();

    const { exhibit, exhibitStore, userRole, baseAnalyticsEvent } =
        useCurrentExhibit();

    const params = exhibit.params || {};

    const defSpawn =
        coordsToText(
            destination.initialPlayerPosition,
            destination.initialPlayerRotation
        ) || "example: -6.04x2.88x-20.26x-1.68";

    const position = params?.initialPlayerPosition;

    const rotation = params?.initialPlayerRotation;

    const hasSpawn = position != null && rotation != null;

    const [spawnPoint, setSpawnPoint] = useState(
        coordsToText(position, rotation)
    );

    const [errors, setErrors] = useState<Record<string, string>>({});

    const [isSpawnEnabled, setSpawnEnabled] = useState(hasSpawn);

    const canEdit = userRole === "owner" || userRole === "admin-curator";

    const handleToggle = useEventCallback((enabled: boolean) => {
        //

        if (!canEdit) return;

        if (!enabled) {
            //
            setSpawnEnabled(false);

            setSpawnPoint("");

            exhibitStore.updateExhibitParams({
                initialPlayerPosition: undefined,
                initialPlayerRotation: undefined,
            });

            amplitude_logAnalyticsEvent(
                "disable_spawn_point",
                baseAnalyticsEvent
            );
            //
        } else {
            //
            setSpawnEnabled(true);

            amplitude_logAnalyticsEvent(
                "enable_spawn_point",
                baseAnalyticsEvent
            );
        }
        //
    }, []);

    const handleChange = useEventCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            //
            const value = e.target.value;

            setSpawnPoint(value);

            const coords = textToCoords(value.trim());

            if (coords == null) {
                //
                setErrors({
                    ...errors,
                    spawn: "Invalid input",
                });

                return;
            }

            setErrors({
                ...errors,
                spawn: null,
            });

            //
            exhibitStore.updateExhibitParams({
                initialPlayerPosition: coords.position,
                initialPlayerRotation: coords.rotation,
            });

            amplitude_logAnalyticsEvent("change_spawn_point", {
                ...baseAnalyticsEvent,
                useCurrentCoords: false,
            });
        },
        []
    );

    const handleUseCurrentCoords = useEventCallback(() => {
        //

        const { position, rotation } = world.current.getCurrentCoords();

        setSpawnPoint(coordsToText(position, rotation));

        setErrors({
            ...errors,
            spawn: null,
        });

        exhibitStore.updateExhibitParams({
            initialPlayerPosition: position,
            initialPlayerRotation: rotation,
        });

        amplitude_logAnalyticsEvent("change_spawn_point", {
            ...baseAnalyticsEvent,
            useCurrentCoords: true,
        });
    }, []);

    return (
        <Container>
            <Form>
                <FormInfo>Set custom spawn point</FormInfo>
                <FormLabelWrapper>
                    <FormLabel style={labelStyle}>
                        You can choose coordinates or set you current location
                        in the studio as a starting point
                    </FormLabel>
                    <Toggle
                        disabled={!canEdit}
                        value={isSpawnEnabled}
                        onChange={handleToggle}
                    />
                </FormLabelWrapper>
            </Form>
            <FormSep />
            <div
                className={`fields ${
                    !isSpawnEnabled || !canEdit ? "disabled" : ""
                }`}
            >
                <Form>
                    <Label>Paste coordinates</Label>
                    <Input
                        hasError={!!errors.spawn}
                        placeholder={defSpawn}
                        value={spawnPoint}
                        onChange={handleChange}
                    >
                        <IconImg
                            name="navigation-2"
                            size={20}
                            style={{ filter: "invert(0.5)" }}
                        />
                    </Input>
                    {errors.spawn ? (
                        <FormError>{errors.spawn}</FormError>
                    ) : null}
                </Form>

                <FormLabelAction
                    className="field-action"
                    onClick={handleUseCurrentCoords}
                >
                    <IconImg
                        name="navigation-2"
                        size={16}
                        style={{ filter: "invert(1)", paddingTop: "2px" }}
                    />
                    <span>Use my current locations</span>
                </FormLabelAction>
            </div>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;

    & > .fields {
        display: flex;
        flex-direction: column;
        gap: 16px;

        &.disabled {
            opacity: 0.3;
            pointer-events: none;
        }

        & .field-action {
            align-self: flex-start;
            flex: 0;
            display: flex;
            flex-direction: row;
            justify-content: flex-start;
            align-content: center;
            gap: 4px;
        }
    }
`;
