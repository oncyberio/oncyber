import { UserContext } from "@components/context/UserContext";
import { useEffect, useContext } from "react";
import { preload } from "swr";
import { useCurrentExhibit } from "../context/ExhibitContext";
import { fetchUserExhibits } from "../utils";
import { fetchEditors } from "./Collab/Collaborate/utils";
import { CinematicProvider } from "./context/CinematicContext";
import { StudioMenuProvider } from "./context/StudioContext";
import { StudioToolbar } from "./StudioToolbar";

export default function StudioMenu() {
    //
    const { token, isAnonymous } = useContext(UserContext);

    const { exhibit, destination } = useCurrentExhibit();

    useEffect(() => {
        //
        if (!isAnonymous) {
            preload(`/user-exhibits/${token}`, () => fetchUserExhibits(token));

            preload(`exhibit_collabs/${exhibit.id}`, () =>
                fetchEditors(exhibit)
            );
        }

        if (process.env.NODE_ENV === "development") {
            //
            (window as any).$$duplicateSpace = (spaceId) => {
                //
                fetch(`/api/space/duplicate_dev`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({ spaceId }),
                })
                    .then((resp) => resp.json())
                    .then((data) => {
                        console.log(data);
                    });
            };
        }
        //
    }, [token]);

    return (
        <CinematicProvider>
            <StudioMenuProvider destination={destination}>
                <StudioToolbar />
            </StudioMenuProvider>
        </CinematicProvider>
    );
}
