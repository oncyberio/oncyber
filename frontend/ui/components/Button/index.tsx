import { forwardRef } from "react";
import { ButtonProps } from "@ui/types";
import { StyledButton } from "./styles";
import Spinner from "@ui/components/Spinner";

const Button = forwardRef(
    (props: ButtonProps, ref: React.Ref<HTMLButtonElement>) => (
        <StyledButton ref={ref} {...props}>
            {props.isLoading ? (
                <Spinner style={{margin: '0 auto'}} isLightTheme={props.isLightTheme} />
            ) : (
                <>
                    {props.icon && props.icon}
                    <span>{props.title}</span>
                </>
            )}
        </StyledButton>
    )
);

export default Button;
