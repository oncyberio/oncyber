import { TweakPane } from "@components/_3DExhibit-v2/ui/TweakPane";
import { physicsGUI } from "@3gl/globals/physicsgui";

export function PhysicsGUI({ submitAction, handleSubmit, handleCancel }) {
    //
    return <TweakPane {...physicsGUI} />;
}
