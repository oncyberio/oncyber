/**
 * The space's artworks as world scripts see and change them. A script may
 * move, turn, resize or hide an artwork for as long as it runs: where each
 * was is remembered on the first change and put back when the script lets
 * go. Nothing is saved.
 */
import { Vector3, type Object3D } from "three";
import type { ArtworkInfo } from "../host";
import type { ArtworkProps } from "../protocol";
import { artworkId, artworkName, artworkType, liveArtworks } from "./facade";

interface ArtworkOriginal {
    object: Object3D;
    position: Vector3;
    rotation: Vector3;
    scale: Vector3;
    visible: boolean;
}

const v = new Vector3();

export function createArtworks() {
    const originals = new Map<string, ArtworkOriginal>();

    return {
        /** Each artwork as the space saved it, wherever a script has put it. */
        list(): ArtworkInfo[] {
            return liveArtworks()
                .slice(0, 500)
                .map((artwork) => {
                    // As the space saved it: where a script has moved or
                    // hidden an artwork, the script is told where it was,
                    // so a restart begins from the same place every time.
                    const original = originals.get(artworkId(artwork));
                    const object: Object3D = artwork;
                    const position = object.getWorldPosition(new Vector3());
                    if (original) {
                        position.copy(original.position);
                        object.parent?.localToWorld(position);
                    }
                    const scale = original ? original.scale : object.scale;
                    return {
                        id: artworkId(artwork),
                        name: artworkName(artwork),
                        type: artworkType(artwork),
                        position: [position.x, position.y, position.z],
                        rotation: original
                            ? [
                                  original.rotation.x,
                                  original.rotation.y,
                                  original.rotation.z,
                              ]
                            : [
                                  object.rotation.x,
                                  object.rotation.y,
                                  object.rotation.z,
                              ],
                        scale: [scale.x, scale.y, scale.z],
                        visible: original
                            ? original.visible
                            : object.visible !== false,
                    } as ArtworkInfo;
                })
                .filter((artwork) => artwork.id);
        },
        set(id: string, props: ArtworkProps) {
            const artwork = liveArtworks().find(
                (candidate) => artworkId(candidate) === id
            );
            if (!artwork) return;
            const object: Object3D = artwork;
            if (!originals.has(id))
                originals.set(id, {
                    object,
                    position: object.position.clone(),
                    rotation: new Vector3(
                        object.rotation.x,
                        object.rotation.y,
                        object.rotation.z
                    ),
                    scale: object.scale.clone(),
                    visible: object.visible,
                });
            if (props.position) {
                // Scripts speak world coordinates; artworks sit in a parent.
                v.fromArray(props.position);
                if (object.parent) object.parent.worldToLocal(v);
                object.position.copy(v);
            }
            if (props.rotation)
                object.rotation.set(
                    props.rotation[0],
                    props.rotation[1],
                    props.rotation[2]
                );
            if (props.scale) object.scale.fromArray(props.scale);
            if (props.visible != null) object.visible = props.visible;
        },
        /** Every artwork a script changed, back as the space has it. */
        reset() {
            originals.forEach((original) => {
                original.object.position.copy(original.position);
                original.object.rotation.set(
                    original.rotation.x,
                    original.rotation.y,
                    original.rotation.z
                );
                original.object.scale.copy(original.scale);
                original.object.visible = original.visible;
            });
            originals.clear();
        },
    };
}
