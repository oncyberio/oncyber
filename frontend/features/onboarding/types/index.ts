import { CSSProperties, ReactNode } from "react";
import { HTMLMotionProps } from "framer-motion";

export type ItemTutoModal = {
    img?: string;
    title: string;
    description: string;
    href?: string;
};

export type TutoModalProps = HTMLMotionProps<"div"> & {
    onNext?: Function;
    className?: string;
    learnMore?: boolean;
    pagination?: boolean;
    style?: CSSProperties;
    items: Array<ItemTutoModal> | ItemTutoModal;
    arrowPosition?: "left" | "bottom" | "right" | "top";
};

export type QuizModalProps = {
    title: string;
    skip?: () => void;
    items: Array<{
        id: string;
        title: string;
        preview: string;
        badge?: string;
        subTitle?: string;
        next: () => void;
    }>;
    skipTitle?: string;
    delay?: number;
    onBack?: () => void;
    startIndex?: number;
    type?: "buildMore" | "";
    style?: CSSProperties;
    children?: ReactNode;
    clickRef?: React.MutableRefObject<any>;
};
