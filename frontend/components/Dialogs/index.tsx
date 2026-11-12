import { useEventCallback } from "@components/hooks/useEventCallback";
import { useIsoLayoutEffect } from "@components/hooks/useIsoLayoutEffect";

import React, {
    ReactNode,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { Alert } from "./Alert";
import { Confirm } from "./Confirm";
import { Dialog, UserDialogProps } from "./Dialog";
import { AlertType } from "./shared";
import { ColorScheme, ColorSchemeName, DialogTheme } from "./styles";
import { Prompt, PromptProps } from "./Prompt";

let showDialogRef = null;

let closeDialogRef = null;

type DialogContextType = {
    showDialog: <T = any>(
        element: JSX.Element,
        opts?: UserDialogProps
    ) => Promise<T>;
    modals: any;
};

// Alerts, confirms and prompts are dark on every page (see `darkDialog`
// below). This is only the container scheme for a caller's own content shown
// with `showModal`: several of those are light panels that rely on a white
// container, so it stays light until a surface calls `useDialogTheme("dark")`.
const currentTheme = {
    value: "light" as DialogTheme,
};

/** The scheme of every alert, confirm and prompt, whatever the page. */
const darkDialog: DialogTheme = "dark";

export function useDialogTheme(theme: DialogTheme) {
    //
    useEffect(() => {
        //
        let prevValue = currentTheme.value;

        currentTheme.value = theme;

        return () => {
            //
            currentTheme.value = prevValue;
        };
        //
    }, []);
}

const DialogContext = React.createContext<DialogContextType>(null);

let uid = 0;

const baseZIndex = 1_000_000_000;

export function DialogProvider(props: { children: React.ReactNode }) {
    //
    const [modals, setModals] = useState([]);

    const onHide = (modalId) => {
        setModals((state) => {
            const modals = state.filter((it) => it.id !== modalId);

            if (modals.length === 0) {
                document.body.style.overflow = "";
            }

            return modals;
        });
    };

    const resolvers = useRef({});

    const handleShow = useEventCallback(
        (modal: JSX.Element, props: UserDialogProps = {}): Promise<any> => {
            return new Promise(function (resolve) {
                //
                let id = ++uid;
                resolvers.current[id] = resolve;

                document.body.style.overflow = "hidden";

                setModals((state) => {
                    return state.concat({
                        id,
                        userId: props.id,
                        index: id,
                        element: React.cloneElement(modal, {
                            onClose: (result) => handleResult(id, result),
                            close: () => onHide(id),
                        }),
                        props,
                    });
                });
            });
        },
        []
    );

    const handleClose = useEventCallback((id) => {
        //
        const modal = modals.find((it) => it.userId && it.userId === id);

        if (modal) {
            onHide(modal.id);
        }
    }, []);

    useIsoLayoutEffect(() => {
        showDialogRef = handleShow;
        closeDialogRef = handleClose;
    }, [handleShow, handleClose]);

    const modalContext: DialogContextType = {
        showDialog: handleShow,
        modals,
    };

    const handleResult = useEventCallback((id, result) => {
        const resolve = resolvers.current[id];
        onHide(id);
        resolve(result);
    }, []);

    const handleCancel = useEventCallback((id) => {
        //
        handleResult(id, undefined);
    }, []);

    return (
        <DialogContext.Provider value={modalContext}>
            {props.children}

            {modals.map(({ id, index, element, props }) => {
                //

                const { style, overlayStyle, escape, ...rest } = props;

                return (
                    <Dialog
                        key={index}
                        theme={currentTheme.value}
                        overlayStyle={{
                            ...overlayStyle,
                            zIndex: baseZIndex * 2 + index,
                        }}
                        style={{
                            ...style,
                            zIndex: baseZIndex * 2 + index + 1,
                        }}
                        onHide={() => handleCancel(id)}
                        onEscape={
                            escape
                                ? () => handleResult(id, escape.result)
                                : undefined
                        }
                        {...rest}
                    >
                        {element}
                    </Dialog>
                );
            })}
        </DialogContext.Provider>
    );
}

export const useDialog = () => {
    //
    const context = useContext(DialogContext);

    if (!context) {
        throw Error("useDialog needs to be called within DialogContext.");
    }

    return context;
};

export function showModal<T = any>(
    element: React.ReactNode,
    props?: UserDialogProps
): Promise<T> {
    //
    if (showDialogRef == null) {
        const msg = "Can't find DialogContext";
        console.error(msg);
        throw new Error(msg);
    }

    return showDialogRef(element, props);
}

let pendingId = 0;

export function createModal() {
    //
    if (showDialogRef == null) {
        const msg = "Can't find DialogContext";
        console.error(msg);
        throw new Error(msg);
    }

    let id = `pending-${++pendingId}`;

    let closePending = null;

    return (content: React.ReactNode, props?: UserDialogProps) => {
        //

        closePending?.();

        if (content == null) return;

        closePending = () => {
            closeDialogRef(id);
        };

        return showModal(content, { ...props, isModal: true, id });
    };
}

export function showConfirm(
    message: ReactNode,
    opts?: {
        title?: string;
        type?: AlertType;
        yes?: ReactNode;
        no?: ReactNode;
        cancel?: ReactNode;
    }
) {
    return showModal<boolean>(<Confirm message={message} {...opts} />, {
        style: { width: "480px" },
        isModal: true,
        theme: darkDialog,
        // Escape is the answer that changes nothing: Cancel when the confirm
        // offers one, otherwise "no".
        escape: { result: opts?.cancel ? null : false },
    });
}

const alertProps: UserDialogProps = {
    style: { width: "400px" },
    isModal: false,
    theme: darkDialog,
};

export function showInfo(message: string, title?: string) {
    return showModal<void>(
        <Alert type="Info" message={message} title={title} />,
        alertProps
    );
}

export function showError(message: string, title?: string) {
    return showModal<void>(
        <Alert type="Danger" message={message} title={title} />,
        alertProps
    );
}

export function showWarning(message: string, title?: string) {
    return showModal<void>(
        <Alert type="Warning" message={message} title={title} />,
        alertProps
    );
}

export function showSuccess(message: string, title?: string) {
    return showModal<void>(
        <Alert type="Success" message={message} title={title} />,
        alertProps
    );
}

export function showPrompt(props: Omit<PromptProps, "onClose">) {
    return showModal<string>(<Prompt {...props} />, {
        style: { width: 400, padding: 24 },
        isModal: true,
        theme: darkDialog,
        escape: { result: null },
    });
}
