import React, { createContext, useContext, useState } from "react";
import theme from "@ui/theme";
import { ThemeProvider as StyledThemeProvider } from "styled-components";

import darkTheme from "../../ui/theme/themes/dark";
import lightTheme from "../../ui/theme/themes/light";
import { useIsoLayoutEffect } from "@components/hooks/useIsoLayoutEffect";

export const ThemeContext = createContext({
    isLightTheme: true,
    toggleTheme: () => {},
    setLightMode: (light: boolean) => {},
});

export const ThemeProvider = ({ children }): React.ReactElement => {
    const [light, setLight] = useState(true);

    useIsoLayoutEffect(() => {
        try {
            const localTheme = JSON.parse(
                localStorage.getItem("theme") || '{"light":true}'
            );

            setLight(localTheme?.light);
        } catch (err) {
            console.log(err);
        }
    }, []);

    const toggleTheme = () => {
        localStorage.setItem("theme", JSON.stringify({ light: !light }));
        setLight(!light);
    };

    const setLightMode = (light: boolean) => {
        localStorage.setItem("theme", JSON.stringify({ light }));
        setLight(light);
    };

    return (
        <ThemeContext.Provider
            value={{
                isLightTheme: light,
                toggleTheme,
                setLightMode,
            }}
        >
            <StyledThemeProvider
                theme={{
                    ...theme,
                    ...(light ? lightTheme : darkTheme),
                }}
            >
                {children}
            </StyledThemeProvider>
        </ThemeContext.Provider>
    );
};

export const useCyberTheme = () => useContext(ThemeContext);

export default ThemeProvider;
