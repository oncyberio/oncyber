import { UserContext } from "@components/context/UserContext";
import { updateUser } from "@utils/saveToDb";
import { useRouter } from "next/router";

import { useContext, useEffect } from "react";

class RecommendationStack {
    stack: any[] = [];

    inited = false;

    changed = false;

    constructor() {
        if (typeof window === "undefined") return;

        const recommend = JSON.parse(localStorage.getItem("recommend") || "[]");

        this.stack = recommend;
    }

    init(stack) {
        if (this.inited) return;

        this.stack = stack || this.stack;

        this.inited = true;
    }

    static get stack() {
        const recommend = JSON.parse(localStorage.getItem("recommend") || "[]");

        return recommend;
    }

    push(item) {
        if (this.stack.includes(item)) {
            this.changed = false;

            return;
        }

        this.changed = true;

        if (this.stack.length === 5) {
            this.stack.shift();
        }

        this.stack.push(item);
    }

    pop() {
        return this.stack.pop();
    }

    peek() {
        return this.stack[this.stack.length - 1];
    }

    isEmpty() {
        return this.stack.length === 0;
    }

    printStack() {
        console.log("==== Stack: ", this.stack);
    }

    synclocal() {
        // localStorage.setItem("recommend", JSON.stringify(this.stack));
    }

    async sync(userId, dispatch) {
        if (!this.changed) return;

        localStorage.setItem("recommend", JSON.stringify(this.stack));

        if (userId) {
            await updateUser("", { visitedSpaces: this.stack }, userId);

            dispatch({
                type: "UPDATE_USER_DATA",
                payload: { visitedSpaces: this.stack },
            });
        }
    }
}

export const LocalRecommendationStack = new RecommendationStack();

export default function useSyncRecommend(props) {
    const router = useRouter();

    const { dispatch } = useContext(UserContext);

    useEffect(() => {
        LocalRecommendationStack.init(props?.user?.visitedSpaces);

        LocalRecommendationStack.printStack();

        if (
            router.pathname === "/spaces/[id]" ||
            router.pathname === "/[slug]"
        ) {
            if (props.experience) {
                LocalRecommendationStack.push(props.experience.id);

                LocalRecommendationStack.sync(props.userId, dispatch);
            }
        }
    }, [router.pathname]);

    return null;
}
