import IconImg from "@ui/components/IconImg";
import styled from "styled-components";

export function Toolbar({ actions }) {
    //
    const handleClick =
        (action) =>
        (e: React.MouseEvent<HTMLButtonElement>): void => {
            //
            e.preventDefault();

            action(e);
        };

    return (
        <Container>
            {actions.map((action, i) => {
                //
                return (
                    <button
                        className="tb-btn"
                        key={i}
                        onClick={handleClick(action.onAction)}
                        disabled={action.disabled}
                    >
                        <IconImg
                            name={action.icon}
                            size={22}
                            style={{ filter: "invert(1)" }}
                        />
                    </button>
                );
            })}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    width: 100%;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    & > .tb-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 66px;
        height: 58px;
        border: none;
        outline: none;
        cursor: pointer;
        background-color: #3d3f46;
        border-radius: 6px;

        @media (max-width: 600px) {
            width: 100%;
        }

        &:hover {
            background-color: #2e2e2e;
        }

        &:disabled {
            opacity: 0.3;
            pointer-events: none;
            cursor: not-allowed;
            background-color: rgb(61, 63, 70, 0.5);
        }
    }
`;
