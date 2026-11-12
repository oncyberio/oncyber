import styled from "styled-components";

function ChevronDown(props) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
    );
}

const Icon = styled(ChevronDown)`
    position: absolute;
    left: 0;
    top: 0;
`;

const Container = styled.div`
    width: 100%;
    height: 0;
    padding-top: -100%;
`;

export default function StyledChevronDown({ size, ...props }) {
    return (
        <div
            style={{
                position: "relative",
                width: `${size}px`,
                height: `${size}px`,
            }}
        >
            <Container>
                <Icon {...props} />
            </Container>
        </div>
    );
}
