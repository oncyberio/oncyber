import { ReactElement, ReactNode } from "react";

export type StateAndColor = {
    state?: "danger" | "success" | "warning";
    color?: string;
    bg?: string;
    borderColor?: string;
    gradients?: [string, string];
};

export type Theme = "light" | "dark";

export type ButtonProps = React.ComponentPropsWithoutRef<"button"> &
    StateAndColor & {
        title?: string;
        wide?: boolean;
        variant?: "primary" | "secondary" | "ghost" | "float";
        size?: "xlarge" | "large" | "medium" | "small";
        uppercase?: boolean;
        icon?: (HTMLElement & SVGElement) | ReactNode | ReactElement;
        iconPosition?: "left" | "right";
        isLoading?: boolean;
        width?: string;
        height?: string;
    };
