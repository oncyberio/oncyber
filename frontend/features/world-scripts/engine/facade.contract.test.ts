/** @jest-environment node */
/**
 * What ./facade.ts expects of the engine, checked against the engine's own
 * source. The engine is JavaScript reached through singletons, most of what
 * the facade reads is optional by nature, and the engine cannot be loaded
 * in a test (it needs a GPU and its own build aliases): a renamed method
 * or field there would compile, load and then quietly do nothing here. So
 * each name the facade relies on is looked for where the engine defines
 * it, and this fails, by name, when one is gone.
 *
 * When a check here fails: the engine changed. Change ./facade.ts to
 * match (it is the only file that needs to), then this list.
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import Events from "../../../components/_3DExhibit-v2/three/events/events";
import { RenderDemand } from "../../../components/_3DExhibit-v2/three/utils/renderDemand";

const ENGINE = join(__dirname, "../../../components/_3DExhibit-v2/three");
const sources = new Map<string, string>();
const source = (file: string) => {
    if (!sources.has(file))
        sources.set(file, readFileSync(join(ENGINE, file), "utf8"));
    return sources.get(file);
};

/** A method, written `name(` or as a field `name = (` / `name = async (`. */
const method = (name: string) =>
    new RegExp(`^\\s*(async\\s+)?${name}\\s*(\\(|=\\s*(async\\s*)?\\()`, "m");
/** A field given a value in a constructor or a method. */
const field = (name: string) => new RegExp(`this\\.${name}\\s*=[^=]`);

// [what the facade does with it, the engine file, what must be in it]
const CONTRACT: Array<[string, string, RegExp[]]> = [
    [
        "worldHasScene: the scene leaves itself on the page as window.scene",
        "scene.js",
        [/window\.scene\s*=\s*this/],
    ],
    [
        "addToScene, removeFromScene, sceneColors: the scene is one object",
        "scene.js",
        [/export default new Scene\(\)/],
    ],
    [
        "currentCamera: Camera.current is the camera drawn through",
        "camera/index.js",
        [
            /set current\s*\(/,
            /get current\s*\(/,
            /export default new Camera\(\)/,
        ],
    ],
    [
        "collisionWorld: Camera.currentControls are the visitor's controls",
        "camera/index.js",
        [field("currentControls")],
    ],
    [
        "collisionWorld: the controls' `world` is their physics",
        "camera/controls/wasdcontrols/index.js",
        [/this\.world\s*=\s*new Physics/],
    ],
    [
        "collisionWorld: the physics' `collisions`",
        "camera/controls/physics/index.js",
        [field("collisions")],
    ],
    [
        "collisionWorld: the collisions' `worldOctree`",
        "camera/controls/physics/collisions/octreecollisions.js",
        [/this\.worldOctree\s*=\s*new TopOctree/],
    ],
    [
        "CollisionWorld: colliders are added, removed and updated; forgetCollider",
        "camera/controls/physics/lib/topoctree.js",
        [
            method("addCollider"),
            method("removeCollider"),
            method("updateDynOctree"),
            field("staticOctree"),
            /mesh\.userData\._collider\b/,
        ],
    ],
    [
        "CollisionWorld: the static tree's triangles can be walked",
        "camera/controls/physics/lib/baseoctree.js",
        [method("traverseTriangles")],
    ],
    [
        "mainPlayer, standAvatar: Players.main and Players.get(opts)",
        "factory/player/index.js",
        [method("get"), field("main"), /export default new Players\(\)/],
    ],
    [
        "standAvatar: what a player made by the factory can be asked",
        "factory/player/instance.js",
        [
            method("updatePlayer"),
            method("handleSit"),
            method("playEmote"),
            method("show"),
            method("hide"),
            method("scaleVRM"),
            method("dispose"),
            field("username"),
            field("avatar3D"),
            field("modelScale"),
            /opts\.isDummy/,
            /userData\.VRMMeshes/,
            /poolUsed/,
        ],
    ],
    [
        "standAvatar: a label or an avatar can be kept from the distance cut",
        "factory/player/instanceusername/index.js",
        [/wrapper\.ignoreLOD/],
    ],
    [
        "standAvatar: the messages a player is updated with",
        "factory/player/constants.js",
        [/export const UPDATE_USERNAME\b/, /export const UPDATE_CHAT\b/],
    ],
    [
        "loadAvatarFile, requestPooledAvatar",
        "gltf.js",
        [
            method("loadOnce"),
            method("requestPool"),
            /isHighQuality/,
            /export default new GLTF\(\)/,
        ],
    ],
    [
        "liveArtworks, teleport, worldModel, portalPlaceholders",
        "root.js",
        [
            method("getArtworks"),
            method("teleport"),
            /opts\.position/,
            field("currentSpace"),
            /export default new Root\(\)/,
        ],
    ],
    [
        "worldModel: a space's scene keeps the world's model as spaceScene",
        "factory/space/space.js",
        [field("spaceScene")],
    ],
    [
        "portalPlaceholders, DOOR_MESH_NAME: doors are found by mesh name",
        "factory/space/kits/classic/index.js",
        [/portalPlaceholders/, /Portal_Door_/],
    ],
    [
        "portalPlaceholders: a placeholder's door, its preview and its id",
        "factory/portal/portalplaceholder/index.js",
        [
            /portalDoor\b/,
            /previewMesh\b/,
            /originalPreviewMesh\b/,
            /portalId\b/,
        ],
    ],
    [
        "assignedPortalIds: an exhibit's portals, by placeholder",
        "factory/portal/index.js",
        [/exhibit\.portals/],
    ],
    [
        "artworkType: an artwork's mediaType",
        "factory/artwork/abstract.js",
        [field("mediaType")],
    ],
    [
        "worldCanvas, onMobile, standAvatar: the engine's constants",
        "constants.js",
        [
            /export var CANVAS\b/,
            /export var CURRENT_SPACE\b/,
            /\bIS_MOBILE\b/,
            /\bDEFAULT_PLAYER_AVATAR_PICTURE\b/,
            /\bCURRENT_STATE\b/,
            /\bAPP_STATES\b/,
        ],
    ],
    [
        "engineReady: the engine says when its loading animation is on",
        "shellconstants.js",
        [/export var CURRENT_STATE\b/, /INTRO: asConst\("INTRO"\)/],
    ],
    [
        "onUpdate: listeners can be taken off again",
        "events/emitter.js",
        [/prototype\.off\s*=/, /export default emitter/],
    ],
];

describe("what the engine facade expects of the engine", () => {
    test.each(CONTRACT)("%s (%s)", (_what, file, needs) => {
        const text = source(file);
        const missing = needs
            .filter((need) => !need.test(text))
            .map((need) => String(need));
        expect(missing).toEqual([]);
    });

    test("onUpdate: the engine's per-frame event", () => {
        expect((Events as any).UPDATE).toBe("update");
    });

    test("drawEveryFrame: a source can say it changes the picture every frame", () => {
        expect(typeof RenderDemand.setContinuous).toBe("function");
    });

    test("avatarCatalogue: the built-in avatars, with the default one", () => {
        const catalogue = JSON.parse(source("factory/player/vrms.json"));
        expect(typeof catalogue.sunshine?.url).toBe("string");
    });

    test("nothing else in world scripts reaches into the engine", () => {
        const root = join(__dirname, "..");
        const files = [
            ...readdirSync(root).map((name: string) => join(root, name)),
            ...readdirSync(__dirname).map((name: string) =>
                join(__dirname, name)
            ),
        ].filter(
            (file) =>
                /\.tsx?$/.test(file) &&
                !/\.test\.tsx?$/.test(file) &&
                !/engine[\\/](facade|worldUp)\.ts$/.test(file)
        );
        const reaching = files.filter((file) => {
            const text = readFileSync(file, "utf8");
            return (
                /from\s+["']@3\//.test(text) ||
                /_3DExhibit-v2/.test(text.replace(/\/\*[\s\S]*?\*\//g, "")) ||
                /window as any\)\.scene|window\.scene\b/.test(text)
            );
        });
        expect(reaching.map((file) => file.slice(root.length + 1))).toEqual([]);
    });
});
