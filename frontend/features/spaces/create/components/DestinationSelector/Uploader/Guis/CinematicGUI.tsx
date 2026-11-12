import { TweakPane } from "@components/_3DExhibit-v2/ui/TweakPane";
import { cinematicGUI } from "@3gl/globals/customGui";

export function CinematicGUI({ submitAction, handleSubmit, handleCancel }) {
    //
    return <TweakPane {...cinematicGUI} />;
}
