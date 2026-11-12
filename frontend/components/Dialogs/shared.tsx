import IconImg from "@ui/components/IconImg";
import Check from "@ui/icons/CheckCircle";
import Close from "@ui/icons/CloseCircle";
import Info from "@ui/icons/InfoCircle";
//import Question from "@ui/icons/QuestionMarkCircle";
import Warning from "@ui/icons/Warning";

export type AlertType =
    | "Success"
    | "Danger"
    | "Info"
    | "Warning"
    | "Question"
    | "None"
    | "Lock";

const size = 48;

export function getAlertIcon(type: AlertType) {
    //
    // if (type === "None") return null;

    if (type === "Success")
        return (
            <IconImg className="dialog-icon" name="check-circle" size={48} />
        );

    if (type === "Info")
        return <IconImg className="dialog-icon" name="info" size={48} />;

    if (type === "Danger")
        return <IconImg className="dialog-icon" name="x-circle" size={48} />;

    // if (type === "Question") return <Question {...size} color="#18191c" />;

    if (type === "Warning")
        return <IconImg className="dialog-icon" name="x-octagon" size={48} />;

    if (type === "Lock")
        return <IconImg className="dialog-icon" name="lock" size={48} />;

    return null;
}
