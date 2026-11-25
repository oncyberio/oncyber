import { useEffect, useState, useContext } from "react";
import { UserContext } from "@components/context/UserContext";

const Error = dynamic(() => import("../../components/Error"));
// Shown in place of a space that doesn't exist (status 404).
const NotFoundPage = dynamic(
    () => import("@features/landing-carousel/NotFoundPage")
);

import { AuthServerSidePropsLite } from "../../utils/authServerSideProps";
import { rooms } from "../../utils/rooms";

import { fetchExhibitData } from "../../utils/ssr";
import { checkGating, GatingCheckResult } from "../../utils/checkGatingRules";

import dynamic from "next/dynamic";
import { Experience } from "@uitypes/experience";
import { RoomParameters } from "@uitypes/roomParameters";
import { isEmbeddedRuntime } from "@features/content-host/runtime";
import { isNativeRuntime, isSupportedRuntime } from "@utils/runtimeKind";

import SpaceSeo from "@components/seo/SpaceSeo";
import { notFoundLanding } from "@utils/serverside/notFoundLanding";

import {
    WORLD_FRAME,
    framedByAnotherSite,
    spaceFrameRole,
    type WorldFrameRole,
} from "@features/worlds/worldFrame";
import { useWorldVisitor } from "@features/worlds/useWorldVisitor";

const FramedWorld = dynamic(() => import("@features/worlds/FramedWorld"));
// The engine's side of a space (features/worlds/NativeSpace.tsx). Where
// worlds are framed, the site's page never draws one, so the engine is a
// chunk of its own that only a document drawing a world loads: the world
// host's, or an embed's. Where they are not framed it is part of this
// page, as it always was. The test is on the value written at build time,
// so the bundler keeps one branch and drops the other.
const NativeExhibit: typeof import("@features/worlds/NativeSpace").default =
    process.env.NEXT_PUBLIC_WORLD_ORIGIN
        ? dynamic(() => import("@features/worlds/NativeSpace"))
        : require("@features/worlds/NativeSpace").default;

const EmbeddedExperience = dynamic(
    () => import("@features/content-host/EmbeddedExperience"),
    { ssr: false }
);

export default function Exhibit(props: {
    experience: Experience;
    dest: RoomParameters;
    gatingError?: GatingCheckResult;
    getExhibitPath: (exhibit: Experience, pathname: string) => string;
    notFound?: { query: string };
    /** Set where worlds are framed: which side of the frame this page is. */
    worldFrameRole?: WorldFrameRole | null;
}) {
    const { isAnonInitialized } = useContext(UserContext);
    // In the site's frame, the world starts once the page has said who is
    // visiting (features/worlds).
    const visitor = useWorldVisitor(props.worldFrameRole === "world");
    // A visit that moves on inside an embed on another site: the server
    // only sees the first page, so the browser is asked for the rest.
    const [embedded, setEmbedded] = useState(false);
    useEffect(() => setEmbedded(framedByAnotherSite()), []);
    if (props.notFound) return <NotFoundPage {...(props as any)} />;
    if (!isAnonInitialized || !visitor.ready) return null;
    if (props.experience && !isSupportedRuntime(props.experience.runtime)) {
        return <Error statusCode={404} />;
    }
    if (isEmbeddedRuntime(props.experience?.runtime)) {
        return (
            <>
                {/* Embedded worlds are spaces too: same title, description,
                    address and text as a native gallery. */}
                <SpaceSeo
                    experience={props.experience}
                    destination={props.dest}
                    ownerName={props.experience.ownerName}
                    gated={!!props.gatingError}
                />
                <EmbeddedExperience
                    key={props.experience.id}
                    experience={props.experience}
                />
            </>
        );
    }
    // Where worlds are framed, the site's page is the frame around the
    // world and the world host serves the world itself (features/worlds).
    // A gated world is framed like any other: the page, which holds the
    // session, says whether its visitor is let in, and the world takes its
    // word (the gate is the world's own interface, as it is unframed).
    if (
        props.worldFrameRole === "page" &&
        !embedded &&
        WORLD_FRAME &&
        props.experience &&
        props.dest &&
        (props.gatingError as { type?: string } | null)?.type !== "other-error"
    ) {
        return (
            <>
                <SpaceSeo
                    experience={props.experience}
                    destination={props.dest}
                    ownerName={props.experience.ownerName}
                    gated={!!props.gatingError}
                />
                <FramedWorld
                    key={props.experience.id}
                    title={props.experience.info?.headline || "Untitled world"}
                    spaceId={props.experience.id}
                    frame={WORLD_FRAME}
                    gate={props.gatingError ?? { type: "success" }}
                    scripts={props.gatingError ? null : props.experience}
                />
            </>
        );
    }
    // In the site's frame the gate is the page's verdict, worked out with
    // the visitor's account; this host would only ever see a guest.
    const gatingError = visitor.gate
        ? visitor.gate.type === "success"
            ? null
            : (visitor.gate as GatingCheckResult)
        : props.gatingError;
    return (
        <NativeExhibit
            key={props.experience?.id}
            {...props}
            gatingError={gatingError}
        />
    );
}

export const getServerSideProps = AuthServerSidePropsLite(
    async ({ query, req, res, resolvedUrl }, user, token) => {
        // Links pasted with a trailing newline or space (".../spaces/<id>%0A")
        // still reach the space.
        const id = String(query.id ?? "");
        if (id.trim() !== id && id.trim()) {
            return {
                redirect: {
                    destination: `/spaces/${encodeURIComponent(id.trim())}`,
                    permanent: true,
                },
            };
        }

        let data = await fetchExhibitData(query.id, "id");
        let gatingError = null;

        if (data?.experience?.info?.customLink) {
            return {
                redirect: {
                    destination: "/" + data.experience.info.customLink,
                    permanent: true,
                },
            };
        }

        if (data.experience) {
            // solo mode should be cheked server side for safety
            let result = await checkGating(data.experience, user, 0);

            gatingError = result.type === "success" ? null : result;
        }

        if (!data.dest) {
            // In the case where it's null then destination doesn't exist/is deleted
            data.dest =
                (data.experience && rooms[data.experience?.info.room]) || null;
        }

        // No such space: a real 404, showing the landing to explore from.
        // Embedded experiences have no room, so no destination to require.
        if (
            !data.experience ||
            (isNativeRuntime(data.experience.runtime) && !data.dest)
        )
            return {
                ...data,
                ...(await notFoundLanding(res, query, resolvedUrl)),
            };

        return {
            ...data,
            gatingError,
            worldFrameRole: spaceFrameRole(req.headers),
        };
    }
);
