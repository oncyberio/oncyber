import { Experience } from "@uitypes/experience";
import exhibit from "pages/api/exhibit";
import React, { createContext, useContext } from "react";

interface ExhibitContextState {
    exhibit: Experience;
}

const ExhibitContext = createContext<ExhibitContextState>(null);

export const ExhibitProvider: React.FC<ExhibitContextState> = ({
    exhibit,
    children,
}) => {
    return (
        <ExhibitContext.Provider value={{ exhibit }}>
            {children}
        </ExhibitContext.Provider>
    );
};

export function useCurrentExhibit() {
    return useContext(ExhibitContext);
}
