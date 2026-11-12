// @ts-check
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useDispatcher } from "./Dispatcher";

export function useAction({ label, onAction: _onAction }) {
    //
    const dispatcher = useDispatcher();

    const onAction = useEventCallback((e) => {
        //
        dispatcher.dispatch({
            run() {
                //
                return _onAction(e);
            },
        });
    }, []);

    return onAction;
}

export function useActionList(actions) {
    //
    const dispatcher = useDispatcher();

    return actions.map((it) => {
        //
        const _onAction = it.onAction;

        const onAction = useEventCallback((e) => {
            //
            dispatcher.dispatch({
                run() {
                    //
                    return _onAction(e);
                },
            });
        }, []);

        return { ...it, onAction };
    });
}
