import { RoundButton } from "@components/DesignSystem/buttons";
import { noop } from "@utils/js";
import { ReactNode } from "react";
import { getAlertIcon, AlertType } from "./shared";
import { DialogContent, DialogFooter, DialogMain } from "./styles";

export interface ConfirmProps {
    type?: AlertType;
    title?: ReactNode;
    message: ReactNode;
    yes?: ReactNode;
    no?: ReactNode;
    cancel?: ReactNode;
    onClose?: (action: boolean) => unknown;
}

export function Confirm({
    type = "None",
    title,
    message,
    yes = "OK",
    no = "Cancel",
    cancel,
    onClose = noop,
}: ConfirmProps) {
    //
    const icon = getAlertIcon(type);

    return (
        <DialogContent biggerTopPad={!title && !icon}>
            <DialogMain>
                {icon}
                {title && <h1 className="title">{title}</h1>}
                <p className="content">{message}</p>
            </DialogMain>
            <DialogFooter>
                {cancel && (
                    <RoundButton
                        className="btn secondary"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose(null);
                        }}
                    >
                        {cancel}
                    </RoundButton>
                )}
                <RoundButton
                    className="btn secondary"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose(false);
                    }}
                >
                    {no}
                </RoundButton>
                <RoundButton
                    className="btn primary"
                    onClick={(e) => {
                        //
                        e.stopPropagation();
                        onClose(true);
                    }}
                >
                    {yes}
                </RoundButton>
            </DialogFooter>
        </DialogContent>
    );
}
