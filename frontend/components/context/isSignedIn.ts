/**
 * The one answer to "is this visitor signed in to an account?".
 *
 * `authenticated` alone is not that answer: it is also true for an anonymous
 * visitor editing a draft in the studio (their id is "anon" and they hold no
 * token). Screens used to add their own checks on top of it, each a little
 * different. Read `isSignedIn` from `UserContext` instead; screens move over
 * as they are touched.
 *
 * A visitor is signed in when all four hold:
 * - the session was authenticated (`authenticated`),
 * - it is not the anonymous draft session (`!isAnonymous`),
 * - it belongs to an account (`user.id`),
 * - and it holds that account's token (`token`).
 *
 * This is the strictest of the checks screens made before (the one in
 * `features/destinations/index.tsx`). In the three states a visitor can
 * really be in (signed out, anonymous draft, signed in) every earlier
 * variant gives the same answer as this one; they only differed on states
 * that should not happen, such as an id left behind without a token.
 */
export interface SessionFacts {
    authenticated?: boolean;
    isAnonymous?: boolean;
    user?: { id?: string } | null;
    token?: string | null;
}

export function selectIsSignedIn(session: SessionFacts): boolean {
    return !!(
        session?.authenticated &&
        !session.isAnonymous &&
        session.user?.id &&
        session.token
    );
}
