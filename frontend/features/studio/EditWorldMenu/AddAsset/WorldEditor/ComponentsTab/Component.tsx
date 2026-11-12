import type {
    Component3DFactory,
    PresetData,
} from "@3factory/space/kits/types";
import { DRAG_MIMES, EDITION_ACTIONS } from "@3constants";
import { Card } from "../Card";
import { useEditWorld } from "../../../context/WorldEditContext";
import { useWorldCompenentManager } from "../../../hooks/worldHooks";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useContext, useMemo } from "react";
import styled from "styled-components";
import IconImg from "@ui/components/IconImg";
import { useEventCallback } from "@components/hooks/useEventCallback";
import Tooltip from "@ui/components/Tooltip";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { UserContext } from "@components/context/UserContext";

export function Component({
    component,
    preset,
}: {
    component: Component3DFactory;
    preset: PresetData;
}) {
    //
    const {
        handleAddKitbash,
        handleDeleteItems,
        handleDragStart,
        setSelectedItems,
        exhibit,
    } = useEditWorld();

    const { user } = useContext(UserContext);

    const componentManager = useWorldCompenentManager();

    const world = useWorld();

    const info = component.getInfo();

    const validateCreate = useMemo(() => {
        //
        return component.validateCreation(exhibit.kitbash);
    }, [component, exhibit.kitbash]);

    const isSingleton = component.isSingleton();

    const exists = exhibit.kitbash?.[info.type] != null;

    const canSelect = isSingleton ? exists : false;

    const canDelete = !component.isRequired() && exists && isSingleton;

    const canAdd = !(isSingleton && exists) && validateCreate.success;

    const candDrag = canAdd && component.isDraggable();

    const handleClick = () => {
        //

        if (!canAdd) {
            //
            if (isSingleton) {
                //
                const instance = componentManager.getComponentById(info.type);

                if (instance) {
                    amplitude_logAnalyticsEvent("start_edit_kit_component", {
                        user_id: user.id,
                        kit: exhibit?.info?.room,
                        type: info.type,
                        exhibitId: exhibit.id,
                        destination: exhibit?.info?.room,
                        ownerId: exhibit.owner,
                        collab: exhibit?.editors?.length > 1,
                    });

                    //
                    setSelectedItems([instance]);
                }
            }

            return;
        }

        handleAddKitbash({
            ctype: info.type,
            kit: "cyber",
            preset,
            autoSelect: true,
        });
    };

    const handleDrag = useEventCallback((e: React.MouseEvent) => {
        //
        handleDragStart(e as any, DRAG_MIMES.KITBASH, {
            previewUrl: info.image,
            asset: { type: info.type, kit: "cyber", preset },
            mime: DRAG_MIMES.KITBASH,
        });
    }, []);

    const handleDelete = useEventCallback((e) => {
        //
        if (canDelete) {
            //
            e.stopPropagation();

            const instance = componentManager.getComponentById(info.type);

            if (instance) {
                //
                handleDeleteItems([instance]);
            }
        }
    }, []);

    const actionIcon = canSelect ? "edit-opaque" : null;

    const overaly = (
        <Overlay>
            {canDelete && (
                <button
                    type="button"
                    aria-label={`Remove ${info.title}`}
                    className="delete"
                    onClick={handleDelete}
                >
                    <IconImg className="icon" name="x" size={14} />
                </button>
            )}
            {actionIcon && (
                <IconImg className="icon" name={actionIcon} size={16} />
            )}
        </Overlay>
    );

    const cta =
        canAdd && !canSelect ? (
            <IconImg
                className="icon"
                name="plus"
                size={20}
                style={{ filter: "invert(1)" }}
            />
        ) : null;

    let el = (
        <Card
            label={info.title}
            image={info.image}
            onClick={handleClick}
            onDrag={candDrag ? handleDrag : null}
            disabled={!canAdd && !canSelect}
            overlay={overaly}
            cta={cta}
        />
    );

    let tooltipText = validateCreate.message;

    if (tooltipText) {
        el = (
            <Tooltip text={tooltipText} orientation="right" isToggled={false}>
                {el}
            </Tooltip>
        );
    }

    return el;
}

const Overlay = styled.div`
    position: relative;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.2);

    display: flex;
    align-items: center;
    justify-content: center;

    & > .delete {
        position: absolute;
        top: 3px;
        right: 3px;

        width: 22px;
        height: 22px;
        padding: 0;
        border: 0;
        cursor: pointer;
        border-radius: 50%;
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
            opacity: 0.8;
        }
    }

    & > .icon {
        filter: invert(1);
    }
`;
