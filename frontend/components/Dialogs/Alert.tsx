import { RoundButton } from "@components/DesignSystem/buttons";
import { noop } from "@utils/js";

import { ReactNode } from "react";
import { AlertType, getAlertIcon } from "./shared";
import { DialogContent, DialogFooter, DialogMain } from "./styles";

export interface AlertProps {
    type?: AlertType;
    title?: ReactNode;
    message: ReactNode;
    action?: ReactNode;
    onClose?: () => unknown;
}

export function Alert({
    type = "None",
    title,
    message,
    action = "Ok",
    onClose = noop,
}: AlertProps) {
    //
    const icon = getAlertIcon(type);

    return (
        <DialogContent biggerTopPad={!title && !icon}>
            <DialogMain>
                {icon}
                {title && <h1 className="title">{title}</h1>}
                <p className="content">{message}</p>
            </DialogMain>
            {action && (
                <DialogFooter>
                    <RoundButton
                        className="btn primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                    >
                        {action}
                    </RoundButton>
                </DialogFooter>
            )}
        </DialogContent>
    );
}
