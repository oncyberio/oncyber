/**
 * What the page does for a framed world with its visitor's account, and the
 * one rule all of it follows: the session is lent for the space this page
 * opened and for no other (docs/plans/framed-worlds.md). A world reached
 * through a portal inside the frame is a place the page did not open: its
 * room is joined by name alone, nobody moderates it through this page, and
 * nothing is saved to it.
 *
 * Every answer a world gets about the account comes through here, so the
 * rule is written once.
 */
import type { RoomIdentity } from "./roomRelay";
import { answerWorldAccount } from "./worldAccountHost";
import { worldSpaceId } from "./worldLocation";
import { guestId } from "@utils/guestIdentity";

/** The page's visitor, read when an answer is needed. */
export interface PageSession {
    signedIn: boolean;
    userId: string;
    token: string;
    username?: string;
}

export interface PageAuthority {
    /** Whether a name or id a world gives is the space this page opened. */
    opened(label: unknown): Promise<boolean>;
    /** Who the page joins a room as. */
    identify(label: string): Promise<RoomIdentity>;
    /** Whether the visitor moderates the space with this name. */
    moderates(label: unknown): Promise<boolean>;
    /** An account call a world asks the page to make (./accountRelay). */
    account(name: unknown, data: unknown): Promise<unknown>;
}

export interface PageAuthorityDeps {
    /** The id of the space with this link or room label, or null. */
    spaceIdOf(label: string): Promise<string | null>;
    isMod(slug: string): Promise<boolean>;
    rpc(
        route: string,
        method: string,
        params: unknown[],
        options: { encode?: true; checksum?: boolean }
    ): Promise<unknown>;
    request: typeof fetch;
    origin(): string;
}

const browser: PageAuthorityDeps = {
    spaceIdOf: (label) => worldSpaceId({ link: label }),
    isMod: async (slug) => {
        const { default: SocialApi } = await import("@api/social/_api");
        return (await SocialApi.isMod({ slug })) === true;
    },
    rpc: async (route, method, params, options) =>
        (await import("@utils/rpc/client")).invokeRemoteRpcMethod(
            route,
            method,
            params,
            options
        ),
    request: (input, init) => fetch(input, init),
    origin: () => window.location.origin,
};

export function createPageAuthority(
    spaceId: string,
    session: () => PageSession,
    does: PageAuthorityDeps = browser
): PageAuthority {
    // A name is looked up once: a world asks about its own space often.
    const known = new Map<string, Promise<boolean>>();
    const opened = (label: unknown): Promise<boolean> => {
        if (typeof label !== "string" || !label || label.length > 200)
            return Promise.resolve(false);
        if (label === spaceId) return Promise.resolve(true);
        let answer = known.get(label);
        if (!answer) {
            answer = does.spaceIdOf(label).then(
                (id) => id === spaceId,
                () => false
            );
            known.set(label, answer);
            // A lookup that failed is asked again next time.
            void answer.then((here) => {
                if (!here) known.delete(label);
            });
        }
        return answer;
    };
    const signedIn = () => {
        const visitor = session();
        return visitor.signedIn && !!visitor.userId ? visitor : null;
    };
    return {
        opened,
        async identify(label) {
            const visitor = signedIn();
            if (!visitor) return { userId: guestId(), token: "" };
            return {
                userId: visitor.userId,
                token: (await opened(label)) ? visitor.token : "",
                username: visitor.username,
            };
        },
        async moderates(label) {
            if (!signedIn() || !(await opened(label))) return false;
            try {
                return await does.isMod(label as string);
            } catch {
                return false;
            }
        },
        account: (name, data) =>
            answerWorldAccount(name, data, {
                signedIn: !!signedIn(),
                spaceId,
                origin: does.origin(),
                opened,
                rpc: does.rpc,
                request: does.request,
            }),
    };
}
