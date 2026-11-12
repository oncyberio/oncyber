import { registerNavigationSave, trackNavigationSave } from "@utils/navigationSaves";
import {
    createContext,
    useState,
    useMemo,
    useContext,
    useEffect,
    useSyncExternalStore,
} from "react";
import useSWR from "swr";
import { Experience } from "@uitypes/experience";
import { useSafeContext } from "@components/hooks/useSafeContext";
import { UserContext } from "@components/context/UserContext";
import { ExhibitStore, ExhibitStoreMode } from "../services/ExhibitStore";
import { ExhibitRole } from "@uitypes/user";
import { UserRole, getUserRole } from "@utils/invite";
import { getExhibitEditors } from "@utils/saveToDb";
import { noop } from "@utils/js";
import { RoomParameters } from "@uitypes/roomParameters";
import { useRouter } from "next/router";

export interface SpaceSettingsProps {
    exhibit: Experience;
    destination: RoomParameters;
    mode?: ExhibitStoreMode;
    children: React.ReactNode;
}

export interface ExhibitContextState {
    exhibit: Experience;
    setExhibit: (exhibit: Experience) => void;
    destination: RoomParameters;
    setDestination: (destination: RoomParameters) => void;
    exhibitStore: ExhibitStore;
    userRole: ExhibitRole;
    roles: Record<string, ExhibitRole>;
    baseAnalyticsEvent: object;
}

const ExhibitContext = createContext<ExhibitContextState>(null);

export function ExhibitProvider({
    children,
    exhibit: _seed,
    destination: _destination,
    mode: _mode,
}: SpaceSettingsProps) {
    //
    const router = useRouter();

    const { user, userData, token, exhibits, isAnonymous } =
        useContext(UserContext);

    const [currentExhibit, setCurrentExhibit] = useState<Experience>(_seed);

    const [destination, setDestination] =
        useState<RoomParameters>(_destination);

    const exhibitId = currentExhibit.id;

    let mode: ExhibitStoreMode =
        _mode ?? (isAnonymous || currentExhibit?.mock ? "local" : "remote");

    // if (process.env.NODE_ENV === "development") {
    //
    if (router.query?.store === "memory") {
        //
        mode = "memory";
    }
    // }

    const [userExhibit, setUserExhibit] = useState(
        //
        mode !== "remote"
            ? null
            : userData?.exhibitIds?.find((it) => {
                  //
                  return it.id === exhibitId;
              })
    );

    const editorsResponse = useSWR(`exhibit-rols/${exhibitId}`, async () => {
        //
        if (mode !== "remote") return {};

        const response = await getExhibitEditors(exhibitId);

        let res: Record<string, UserRole> = {};

        if (response.success) {
            response.editors.forEach((it) => {
                //
                res[it.walletId.toLowerCase()] = getUserRole(it);
            });
        }

        return res;
    });

    const exhibitStore = useMemo(() => {
        //
        //console.log("ExhibitProvider: exhibitStore", exhibitId, currentExhibit);
        return new ExhibitStore({
            exhibit: currentExhibit,
            userId: user.id,
            token,
            mode,
        });
        //
    }, [exhibitId]);

    const exhibit = useSyncExternalStore(
        exhibitStore.subscribe,
        exhibitStore.getState,
        () => currentExhibit
    );

    const userRole = useMemo<ExhibitRole>(() => {
        //
        if (!user.id) return null;

        if (mode !== "remote" || exhibit.owner === user.id) return "owner";

        const isEditor = exhibit.editors.some(
            (it) => it.toLowerCase() === user.id.toLowerCase()
        );

        if (!isEditor) return null;

        // Default to co-curator if we don't have the latest role data
        if (userExhibit == null) {
            //
            return "co-curator";
        }

        return getUserRole(userExhibit);

        //
    }, [exhibit.owner, exhibit.editors, user.id, userExhibit]);

    const roles = useMemo(() => {
        let roles: Record<string, ExhibitRole> = {
            ...(editorsResponse.data || {}),
            [exhibit.owner.toLowerCase()]: "owner",
            [user.id.toLowerCase()]: userRole,
        };

        return roles;
    }, [exhibit.owner, user.id, editorsResponse.data]);

    const baseAnalyticsEvent = useMemo(() => {
        //
        return {
            exhibitId: exhibit.id,
            ownerId: exhibit.owner,
            collab: exhibit.editors?.length > 1,
            destination: exhibit.info?.room,
            user_id: user.id,
            exhibitName: exhibit.info?.headline,
            number_of_artworks: Object.keys(exhibit.artworks || {}).length,
        };
    }, [exhibit, user.id]);

    useEffect(() => {
        //
        const unwatchExhibit = exhibitStore.watchRemote();
        const unregisterSave = registerNavigationSave(() => exhibitStore.dispose());

        return () => {
            //
            unregisterSave();
            unwatchExhibit();
            void trackNavigationSave(exhibitStore.dispose()).catch(console.error);
        };
        //
    }, [exhibitStore]);

    const value = {
        exhibit,
        setExhibit: setCurrentExhibit,
        destination,
        setDestination,
        exhibitStore,
        userRole,
        roles,
        baseAnalyticsEvent,
    };

    return (
        <ExhibitContext.Provider value={value}>
            {children}
        </ExhibitContext.Provider>
    );
}

export function ReadOnlyExhibitProvider({
    children,
    exhibit: _seed,
    destination: _destination,
}: SpaceSettingsProps) {
    //
    const value = {
        exhibit: _seed,
        setExhibit: noop,
        destination: _destination,
        setDestination: noop,
        exhibitStore: null,
        userRole: null,
        roles: {},
        baseAnalyticsEvent: {},
    };

    return (
        <ExhibitContext.Provider value={value}>
            {children}
        </ExhibitContext.Provider>
    );
}

export function useCurrentExhibit() {
    return useSafeContext(ExhibitContext);
}
