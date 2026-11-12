import { Wrapper } from "./styles";

type SpinnerProps = {
    isLightTheme?: boolean;
    style?: object;
    width?: number;
    stroke?: string;
};

const Spinner = ({ isLightTheme, style, width, stroke }: SpinnerProps) => (
    <Wrapper
        width={width || "32"}
        height={width || "32"}
        viewBox="0 0 50 50"
        xmlns="http://www.w3.org/2000/svg"
        isLightTheme={isLightTheme}
        style={style}
        stroke={stroke || "#fff"}
    >
        <circle cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
    </Wrapper>
);

export default Spinner;
