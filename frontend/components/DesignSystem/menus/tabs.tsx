import styled from "styled-components";
import isEmpty from "lodash/isEmpty";

export default function Tabs({
    isActive,
    setActive,
    isLight,
    isSearch = null,
    tabs,
    filters = false,
    searchRadUser = null,
}) {
    return (
        <Container data-cy="home-tabs">
            {isSearch?.status || !isEmpty(searchRadUser?.username) ? (
                <div className="result">
                    <label>
                        Results for :{" "}
                        {isSearch?.keyword || searchRadUser?.username}
                    </label>
                </div>
            ) : (
                <div>
                    {Object.keys(tabs).map((tab, i) => {
                        return (
                            <NavButton
                                key={i}
                                isLight={isLight}
                                active={isActive == tab}
                                onClick={() => setActive(tab)}
                            >
                                {tabs[tab]}
                            </NavButton>
                        );
                    })}
                </div>
            )}
            {filters ? (
                <div
                    className="buttonFilters"
                    style={{ justifyContent: "flex-end" }}
                >
                    {/* <p>Filter by</p> */}
                    {/* <SelectButton
                        isLight={isLight}
                        name="typeLabels"
                        isActive={filterBy?.typeLabels}
                    >
                        Type/Labels
                    </SelectButton>
                    <SelectButton
                        isLight={isLight}
                        name="collection"
                        isActive={filterBy?.collection}
                        onClick={(e) =>
                            setFilterBy((prevState) => ({
                                ...filterBy,
                                collection: !prevState.collection,
                            }))
                        }
                    >
                        Collection
                    </SelectButton> */}
                    {/* <ListWrapper ref={destinationRef}>
                        <SelectButton
                            isLight={isLight}
                            isActive={toggleDestination}
                            onClick={(e) =>
                                setToggleDestination((toggle) => !toggle)
                            }
                        >
                            Destination
                        </SelectButton>
                        <MenuItems isHidden={!toggleDestination}>
                            {activeDestinations.map(({ name, slug }, index) => (
                                <Choice
                                    key={index}
                                    active={filterBy?.destination?.includes?.(
                                        slug
                                    )}
                                >
                                    <label htmlFor={slug}>{name}</label>
                                    <input
                                        id={slug}
                                        type="checkbox"
                                        value={slug}
                                        onChange={handleSelectDestination}
                                    />
                                </Choice>
                            ))}
                        </MenuItems>
                    </ListWrapper> */}
                </div>
            ) : (
                <div
                    className="buttonFilters"
                    style={{ justifyContent: "flex-end" }}
                >
                    {/* <Link href="/explore">
                        <a>
                            <p>
                                Explore More {"  "}
                            </p>
                        </a>
                    </Link> */}
                </div>
            )}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: 16px 0;

    & > div {
        display: flex;
        justify-content: flex-start;
        align-items: center;
        width: 100%;

        button {
            margin: 0 4px;
        }

        p {
            margin: 0;
            margin-right: 12px;
        }
    }

    .result {
        & > label {
            font-size: 20px;
            font-weight: 500;
        }
    }

    @media (max-width: 1200px) {
        margin: 0 0;
        padding: 16px 8px;
        // justify-content: space-between;
        .buttonFilters {
            display: none;
        }
    }

    @media (max-width: 550px) {
        padding: 8px;
        .buttonFilters {
            display: none;
        }
    }
`;

const NavButton = styled.div`
    text-align: center;
    border-radius: 50px;
    transition: 0.1s;
    margin-right: 24px;
    cursor: pointer;

    color: ${({ active, isLight }) =>
        active
            ? isLight
                ? "#000"
                : "#fff"
            : isLight
            ? "rgba(0, 0, 0, 0.3)"
            : "rgba(255, 255, 255, 0.3)"};
    font-size: 20px;
    font-weight: 500;

    display: flex;
    align-items: center;
    justify-content: center;

    img {
        width: 30px;
        margin-left: -10px;
    }

    &:hover {
        color: ${({ isLight }) => (isLight ? "#000" : "#fff")};
    }

    transition: 0.2s;

    @media (max-width: 650px) {
        font-size: 18px;
        margin-right: 16px;
    }

    @media (max-width: 500px) {
        font-size: 16px;
        margin-right: 12px;
    }
`;

const ListWrapper = styled.div`
    position: relative;
    color: white;
`;

const MenuItems = styled.div`
    overflow: auto;
    max-height: 150px;
    position: absolute;
    z-index: 1000;
    ${({ isEmpty }) => !isEmpty && "padding: 0.25px"};
    margin: 0;
    background-color: #101010;
    font-size: 1rem;
    line-height: 1.5rem;
    width: 150%;
    right: 0%;
    top: 120%;
    border-radius: 8px;
    transition: all 1s ease-in;
    padding: 8px 24px;
    filter: drop-shadow(0px 4px 40px rgba(0, 0, 0, 0.25));

    ${({ isHidden }) => isHidden && "display: none"};

    &::-webkit-scrollbar {
        width: 5px !important;
    }

    &::-webkit-scrollbar-thumb {
        border-radius: 8px;
        background-color: #333 !important;
    }

    @media (min-width: 640px) {
        font-size: 0.875rem;
        line-height: 1.25rem;
    }
`;

const Choice = styled.div`
    display: flex;
    justify-content: space-between;
    flex-direction: row;
    align-items: center !important;
    overflow: none !important;
    color: ${({ color }) => color};
    padding: 12px 0;

    & > input[type="checkbox"] {
        width: 12px;
        height: 12px;
        border: 1px solid transparent;

        background-color: rgba(255, 255, 255, 0.1);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
            0 4px 6px -2px rgba(0, 0, 0, 0.05);
        color: #fff;
        border-radius: 2px;
        padding: 10px 10px;
        margin: 0 0;
        margin-left: 10px;
        outline: none;
        -webkit-appearance: none;
        -moz-appearance: none;
    }

    input[type="checkbox"]:checked {
        background-color: #fff;
        border: 1px solid #bfc9ca;
    }

    & > label {
        opacity: ${({ active }) => (active ? "1" : "0.3")};
        font-size: 1rem;
        font-weight: 500;
    }
`;
