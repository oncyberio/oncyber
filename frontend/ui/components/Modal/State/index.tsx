import React, {
    forwardRef,
    ReactNode,
    CSSProperties,
    ReactElement,
} from "react";
import Pending from "ui/icons/Pending";
import CheckCircle from "ui/icons/CheckCircle";
import { StyledModal, StyledModalProps } from "../styles";

export type StateProps = StyledModalProps &
    React.HTMLAttributes<HTMLDivElement> & {
        type?: string;
        title?: string;
        children?: ReactNode;
        description?: string;
        footer?: ReactElement;
        style?: CSSProperties;
    };

const State = forwardRef(
    (props: StateProps, ref: React.Ref<HTMLDivElement>) => {
        const { title, description, footer, children, type, ...rest } = props;
        return (
            <StyledModal ref={ref} {...rest}>
                <div>
                    {type === "success" ? (
                        <CheckCircle color="#292929" />
                    ) : type === "pending" ? (
                        <Pending className="pending" />
                    ) : null}
                    <h1>{title}</h1>
                    <p>{description}</p>
                    {children && children}
                </div>
                {footer && <footer>{footer}</footer>}
            </StyledModal>
        );
    }
);

State.defaultProps = {
    title: "Success!",
    description: "",
    footer: null,
    type: "success",
};

export default State;
