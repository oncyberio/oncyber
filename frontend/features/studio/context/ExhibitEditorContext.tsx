import {
    createContext,
    useRef,
    useMemo,
    useContext,
    useSyncExternalStore,
    MutableRefObject,
    useEffect,
    useState,
} from "react";
import { useSafeContext } from "@components/hooks/useSafeContext";
import { UserContext } from "@components/context/UserContext";
import { ExhibitEditorService } from "../services/editor";
import { useCurrentExhibit } from "./ExhibitContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { Overlay } from "@features/studio/styles/Overlay";
import ReactPortal from "@components/Snackbar/Portal";

export interface ExhibitEditorProps {
    children: React.ReactNode;
}

type ExhibitEditorState = ExhibitEditorService;

const ExhibitEditorContext = createContext<ExhibitEditorState>(null);

export function ExhibitEditorProvider({ children }: ExhibitEditorProps) {
    //
    const { user, token, isAnonymous } = useContext(UserContext);

    const world = useWorld();

    const { exhibit, exhibitStore } = useCurrentExhibit();

    const [isApplyingKit, setIsApplyingKit] = useState(false);

    const editorService = useMemo(() => {
        //
        if (world.current == null || exhibitStore == null) return;

        const userId = user.id;

        return new ExhibitEditorService({
            exhibitStore,
            userId,
            isAnonymous,
            token,
            world: world.current,
        });
    }, [world.current, exhibitStore, user?.id]);

    useEffect(() => {
        //
        if (editorService == null) return;

        editorService.startRealtime();

        editorService.on("apply-kit", handleApplyKit);

        function handleApplyKit(opts) {
            //
            setIsApplyingKit(opts.status === "start");
        }

        return () => {
            //
            editorService.stopRealtime();

            editorService.off("apply-kit", handleApplyKit);
        };
        //
    }, [editorService]);

    return (
        <ExhibitEditorContext.Provider value={editorService}>
            {isApplyingKit && (
                <ReactPortal>
                    <Overlay>Applying new kit...</Overlay>
                </ReactPortal>
            )}
            {children}
        </ExhibitEditorContext.Provider>
    );
}

export function useEditorService() {
    return useSafeContext(ExhibitEditorContext);
}

export function useEditorState(editorService: ExhibitEditorService) {
    //

    return useSyncExternalStore(
        editorService.subscribeState,
        editorService.getState,
        () => editorService.getState()
    );
}
