 import {
    Box3,
    BoxGeometry,
    BufferGeometry,
    DoubleSide,
    EdgesGeometry,
    LineSegments,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    PerspectiveCamera,
    PlaneGeometry,
    Quaternion,
    Raycaster,
    Vector3,
} from "three";

import { LineMaterial } from '@3utils/lines/linematerial2.js';

import { RoomParameters } from "@uitypes/roomParameters";
import { ArtworkContainer } from "..";
import { SpaceArtwork } from "@3artwork/abstract";
import { TYPES } from "@3artwork/constants";
import { CURRENT_SPACE, IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import { TextSpaceArtwork } from "../../meshes/text/textspaceartwork";
import { disposeObject3D, getSelectionHandle } from "@components/_3DExhibit-v2/three/utils/three";

import PipeLineMesh from '@3abstract/pipelinemesh'
import PipeLineLines from '@3abstract/pipelinelines'

import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

import Emitter from '@3emitter'

import Events from '@3events'

import { placeOnSurface } from "../../../../utils/surfacePlacement";


const lineWidth = 4

type BoundingRectField = `${"min" | "max"}${"X" | "Y"}`;
type CornerName = Exclude<`${"top" | "bottom" | ""}${"Left" | "Right" | ""}`, ""> ;

type Corner = { x: BoundingRectField; y: BoundingRectField };

let corners: Record<CornerName, Corner> = {

    top: { x: null, y: "maxY" },
    bottom: { x: null, y: "minY" },
    Left: { x: "maxX", y: null },
    Right: { x: "minX", y: null },

    topLeft: { x: "minX", y: "maxY" },
    topRight: { x: "maxX", y: "maxY" },
    bottomLeft: { x: "minX", y: "minY" },
    bottomRight: { x: "maxX", y: "minY" },
};

type MagnetName = "top" | "bottom" | "center" | "space1" | "space2";

class BoundingRect {
    public minX: number;
    public minY: number;
    public maxX: number;
    public maxY: number;

    copy(br: BoundingRect) {
        this.minX = br.minX;
        this.minY = br.minY;
        this.maxX = br.maxX;
        this.maxY = br.maxY;
    }

    scale(cornerName: CornerName, scale: number) {
        let corner = corners[cornerName];
        if(corner.x != null) {
            this[corner.x] *= scale;
        }
        if(corner.y != null) {
            this[corner.y] *= scale;
        }
    }

    getWidth() {
        return Math.abs(this.maxX - this.minX);
    }

    getHeight() {
        return Math.abs(this.maxY - this.minY);
    }
}

const raycaster = new Raycaster();

function getPointer(event: PointerEvent, domElement: HTMLElement) {
    if (domElement.ownerDocument.pointerLockElement) {
        return {
            x: 0,
            y: 0,
            button: event.button,
        };
    } else {
        const rect = domElement.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: (-(event.clientY - rect.top) / rect.height) * 2 + 1,
            button: event.button,
        };
    }
}

const tmpBox = new Box3();

const vOffset = new Vector3()

const tmpVec1 = new Vector3();
const tmpVec2 = new Vector3();
const tmpVec3 = new Vector3();
const tmpVec4 = new Vector3();

const tmpMat1 = new Matrix4();

const unitScale = new Vector3(1, 1, 1);

const tmpBRect1 = new BoundingRect();

const unitDirections: Record<CornerName, Vector3> = {
    top: new Vector3(0, 1, 0),
    bottom: new Vector3(0, -1, 0),
    Left: new Vector3(1, 0, 0),
    Right: new Vector3(-1, 0, 0),
    topLeft: new Vector3(-1, 1, 0),
    topRight: new Vector3(1, 1, 0),
    bottomLeft: new Vector3(-1, -1, 0),
    bottomRight: new Vector3(1, -1, 0),
};

const cursorStyle: Record<CornerName, string> = {
    top: "n-resize",
    bottom: "n-resize",
    Left: "w-resize",
    Right: "w-resize",
    topLeft: "nw-resize",
    topRight: "ne-resize",
    bottomLeft: "ne-resize",
    bottomRight: "nw-resize",
};

function isSideCorner(corner: CornerName) {
    return corner === "top" || corner === "bottom" || corner === "Left" || corner === "Right"
}

function getMesh(object: Object3D) {
    let mesh = (object.getObjectByName("artwork_border") ||
        (object as any).raycastMesh || (object as any).mesh) as Mesh;

        return mesh

}

// get the bounding box in local coordinates of object
function getLocalBBox(object: Object3D, target: Box3) {
    const mesh = getMesh(object)
    const geometry =  mesh.geometry as BoxGeometry;
    let width = geometry.parameters.width * mesh.scale.x;
    let height = geometry.parameters.height * mesh.scale.y;
    // let depth = geometry.parameters.depth;
    target.min.set(-width / 2, -height / 2, 0);
    target.max.set(width / 2, height / 2, 0);
    return target;
}

// get the bounding box in local & scaled coordinates of object
function getScaledBBox(object: Object3D, target: Box3) {
    let mesh = getMesh(object);
    let geometry = mesh.geometry as BoxGeometry;
    let width = geometry.parameters.width * mesh.scale.x * object.scale.x;
    let height = geometry.parameters.height * mesh.scale.y * object.scale.y;
    // let depth = geometry.parameters.depth;
    target.min.set(-width / 2, -height / 2, 0);
    target.max.set(width / 2, height / 2, 0);
    return target;
}

// get the bounding box in world coordinates
function getGlobalBBox(mesh: Mesh, target: Box3) {
    if (mesh.geometry.boundingBox == null) {
        mesh.geometry.computeBoundingBox();
    }
    target.copy(mesh.geometry.boundingBox);
    target.applyMatrix4(mesh.matrixWorld);
    return target;
}

function getLocalBRect(object: Object3D, target: BoundingRect) {
    let mesh = getMesh(object);
    let geometry = mesh.geometry as BoxGeometry;

    let width = geometry.parameters.width * mesh.scale.x;
    let height = geometry.parameters.height * mesh.scale.y;

    target.minX = -width / 2;
    target.minY = -height / 2;
    target.maxX = width / 2;
    target.maxY = height / 2;
    return target;
}

// TODO: provides a more flexible heuristic to select compatible objects
// Right now we rely on the fact that all objects has the same Euler order
// We select only exhibits that look in the same direction
function canAlign(e1: Object3D, e2: Object3D) {
    let r1 = e1.rotation;
    let r2 = e2.rotation;
    return (
        r1.order === r2.order &&
        Math.abs(r1.x - r2.x) < 0.01 &&
        Math.abs(r1.y - r2.y) < 0.01 &&
        Math.abs(r1.z - r2.z) < 0.01
    );
}

type TransformMode = "scale" | "translate";
type AxisName = "X" | "Y" | "XY";
type ScaleMode = "Scale" | "FontWidth";

type UIHints = Record<MagnetName, LineHint>;

let axisAdjust: Record<AxisName, Vector3> = {
    X: new Vector3(1, 0, 0),
    Y: new Vector3(0, 1, 0),
    XY: new Vector3(1, 1, 0),
};

let axisCursor: Record<AxisName, string> = {
    X: "w-resize",
    Y: "n-resize",
    XY: "move",
};

// Used for typed for..in iterations
// see https://stackoverflow.com/questions/59656190/define-key-type-for-object-in-for-in
let key: CornerName;

interface MagnetData {
    box: Box3;
    boxInScaled: Box3;
    object: SpaceArtwork;
}

// Cache for local boxes
const bbCache = new WeakMap<SpaceArtwork, MagnetData>();


type AttachedObject = Object3D & {
    dragStart?: () => void
    dragEnd?: () => void
    showSelected?: ( val: boolean ) => void;
    updateCoords?: (val: boolean) => void;
}

export class SnapTransformControls extends Object3D {
    private _positionStart = new Vector3();
    private _quaternionStart = new Quaternion();
    private _quaternionStartInv = new Quaternion();
    private _scaleStart = new Vector3();
    private _scaledBoxStart = new Box3();

    private pointStart = new Vector3();
    private pointEnd = new Vector3();

    private magnets: Array<MagnetData> = [];

    private uiHints: UIHints;

    private _isDragging = false;
    private _axis: AxisName = "XY";
    private plane: PipeLineMesh;
    private magnetSelectBox: Box3 = new Box3();

    private resizeHandles: Record<CornerName, Handle> = {
        top: null,
        bottom: null,
        Left: null,
        Right: null,
        topLeft: null,
        topRight: null,
        bottomLeft: null,
        bottomRight: null,
    };
    private moveHandle: Handle;

    private currentHandle: Handle;
    private handles: Array<Handle> = [];
    private raycastedHandles: Array<Mesh> = [];

    private sceneSnapMeshes: Array<Mesh> = []

    private maxGap: number;

    public maxTranslateSnapDistance = Infinity;

    public autoHandleCursor = false

    public enabled = false;
    public locked = false;
    public isUniformScale = true;
    public object: AttachedObject;
    public scaleMode: ScaleMode = "Scale";

    constructor(
        public camera: PerspectiveCamera,
        public domElement: HTMLElement,
        public container: ArtworkContainer | null,
        public roomParameters: RoomParameters
    ) {
        super();
        let depth = roomParameters?.placeholderSize?.[2] || 0.04;

        this.maxGap = depth * 1.5;

        const geometry = new BoxGeometry(100000, 100000, depth * 10);
        // geometry.rotateX(Math.PI / 2);
        this.plane = new PipeLineMesh(
            geometry,
            new MeshBasicMaterial({
                color: 0xffff00,
                side: DoubleSide,
                transparent: true,
                opacity: 0.3,
                toneMapped: false,
            }),
            {
                visibleOnOcclusion: false,
                visibleOnMirror   : false
            }
        );

        this.plane.visible = false

        this.add(this.plane);
        getGlobalBBox(this.plane, this.magnetSelectBox);

        let handleSize = depth * 2.5;

        for (key in corners) {
            let handle = Handle.createResizeHandle(handleSize, key);
            this.resizeHandles[key] = handle;
            this.handles.push(handle);
            this.raycastedHandles.push(handle.raycastPlane);
        }
        this.moveHandle = Handle.createMoveHandle(1);
        this.moveHandle.visible = false;
        this.handles.push(this.moveHandle);
        this.raycastedHandles.push(this.moveHandle.raycastPlane);

        this.uiHints = LineHint.createHintLines();
        Object.keys(this.uiHints).forEach((key) => {
            let ui = this.uiHints[key];
            ui.visible = false;
            this.add(ui);
        });


        if(!CURRENT_SPACE.roomParameters.isFuture) {

            const scene = CURRENT_SPACE.space.scene

            scene.spaceScene.traverse(obj => {

                if(obj.visible &&
                    // @ts-ignore
                    obj.isMesh &&
                    obj !== scene.background) {

                        this.sceneSnapMeshes.push(obj)
                }
            })
        }



        domElement.style.touchAction = "none";
        domElement.addEventListener("pointerdown", this.onPointerDown);

        if(!IS_MOBILE) {
            domElement.addEventListener("pointermove", this.onPointerHover);
        }

        domElement.addEventListener("pointerup", this.onPointerUp);

        Emitter.on(Events.MIRROR, this.onMirror)
    }

    onMirror = ( val ) => {

        this.setVisible( !val )
    }

    get dragging() {
        return this._isDragging;
    }

    set dragging(value: boolean) {
        let oldValue = this._isDragging;
        this._isDragging = value;
        if (oldValue !== value) {
            this.dispatchEvent({
                type: "dragging-changed",
                value,
            });

            if(value) {
                this.object.dragStart?.()
            }
            else {
                this.object.dragEnd?.()
            }
        }
    }

    get axis() {
        return this._axis;
    }

    set axis(_axis: AxisName) {
        if (!this.enabled || this._isDragging) return;
        this._axis = _axis;
    }

    getMode(): TransformMode {
        return this.currentHandle?.handleMode;
    }

    getCursor() {
        if (this.currentHandle == null || this.object == null) return null;
        if(this.locked) return "not-allowed"
        if (this.currentHandle.handleMode === "translate") {
            return axisCursor[this._axis];
        } else if (this.currentHandle.handleMode === "scale") {
            return cursorStyle[this.currentHandle.handleCorner];
        }
    }

    attach(object: AttachedObject) {
        //
        this.object = object;

        this.isUniformScale = (object as any).isUniformScale ?? true;

        this.updateMatrixWorld(true);

        this.showSelectionHandles();

        return this;
    }

    detach() {
        if (this.object != null) {
            this.hideSelectionHandles();
            this.object = null;
            this.magnets = [];
        }
    }

    setVisible( val ) {

        if (this.object != null) {

            this.object?.showSelected?.(val)

            if( val == false ) {

                for (let i = 0; i < this.handles.length; i++) {

                    this.object.remove(this.handles[i])
                    // this.handles[i].visible = false
                }

            }

            else {

                for (let i = 0; i < this.handles.length; i++) {

                    this.object.add(this.handles[i])
                }
            }
        }
    }

    hitSceneMeshes(event: PointerEvent) {

        let snapMeshes = this.sceneSnapMeshes

        if(CURRENT_SPACE.roomParameters.isFuture) {

            snapMeshes = CURRENT_SPACE.space.kitbash.raycastMeshes
        }

        let point = getPointer(event, this.domElement);
        raycaster.setFromCamera(point, this.camera);
        const intersects = raycaster.intersectObjects(snapMeshes, false)

        return intersects?.[0]
    }

    hitTest(event: PointerEvent, objects: Array<Object3D>) {
        let point = getPointer(event, this.domElement);
        raycaster.setFromCamera(point, this.camera);
        return raycaster.intersectObjects(objects, false);
    }

    showSelectionHandles() {

        // console.log( this.object )

        const isTextArtwork = this.object instanceof TextSpaceArtwork

        for (let i = 0; i < this.handles.length; i++) {
            //
            let handle = this.handles[i];

            if(isTextArtwork && (handle.handleCorner === "top" || handle.handleCorner === "bottom")) {
                // don't show top/bottom for text artwork
                continue;
            }
            this.object.add(handle);
        }

        this.object?.showSelected?.(true)
    }

    hideSelectionHandles() {
        //
        for (let i = 0; i < this.handles.length; i++) {
            //
            this.object.remove(this.handles[i]);
        }

        this.object?.showSelected?.(false)

    }

    canSnapTo(artwork: SpaceArtwork) {

        return artwork.mediaType != TYPES.PLACEHOLDER && artwork.mediaType !== TYPES.MODEL
    }

    getAdjacentArtworks(object: Object3D) {
        this.updatePlane();
        this.magnets = [];
        this.container?.artworks.forEach((it) => {
            if (
                it === object ||
                !this.canSnapTo(it) ||
                !it.isVisibleToCamera ||
                !canAlign(object, it)
            )
                return;

            if (this.magnetSelectBox.containsPoint(it.position)) {
                let magnet = bbCache.get(it);
                if (magnet == null) {
                    magnet = {
                        box: new Box3(),
                        boxInScaled: new Box3(),
                        object: it,
                    };
                    getLocalBBox(it, magnet.box);
                    bbCache.set(it, magnet);
                }
                this.magnets.push(magnet);
            }
        });
    }

    updatePlane() {
        this.plane.position.copy(this.object.position);
        this.plane.quaternion.copy(this.object.quaternion);
        this.plane.updateMatrixWorld();
        getGlobalBBox(this.plane, this.magnetSelectBox);
    }

    snapTranslate() {
        Object.keys(this.uiHints).forEach((key) => {
            let ui: LineHint = this.uiHints[key];
            ui.visible = false;
        });

        const matInv = tmpMat1.copy(this.object.matrixWorld).invert();

        const scaledBox = getScaledBBox(this.object, tmpBox);
        const curMin = scaledBox.min;
        const curMax = scaledBox.max;

        let minCurY = curMin.y;
        let centerCurY = this.object.position.y;
        let maxCurY = curMax.y;

        // Get the magnet bbox in local scaled space of the selected object
        // So that we can reason in 2d like canvas
        this.magnets.forEach((m) => {
            m.boxInScaled.min
                .copy(m.box.min)
                .applyMatrix4(m.object.matrixWorld)
                .applyMatrix4(matInv)
                .multiply(this.object.scale);

            m.boxInScaled.max
                .copy(m.box.max)
                .applyMatrix4(m.object.matrixWorld)
                .applyMatrix4(matInv)
                .multiply(this.object.scale);
        });

        // Sort by x-proximity
        this.magnets.sort((m1, m2) => {
            let d1 = Math.abs(
                (m1.boxInScaled.max.x + m1.boxInScaled.min.x) / 2
            );
            let d2 = Math.abs(
                (m2.boxInScaled.max.x + m2.boxInScaled.min.x) / 2
            );
            return d1 - d2;
        });

        // 1- Snap on Y-axis
        let ui: LineHint;
        for (let i = 0; i < this.magnets.length && ui == null; i++) {
            let m = this.magnets[i];

            const min = m.boxInScaled.min;
            const max = m.boxInScaled.max;

            let minY = min.y;
            let centerY = m.object.position.y;
            let maxY = max.y;

            const leftMostX = Math.min(curMin.x, min.x);
            const rightMostX = Math.max(curMax.x, max.x);
            const zUi = curMin.z;

            // center/top/bottom Y clamp
            let snap = centerY - centerCurY;
            if (Math.abs(snap) < this.maxGap) {
                this.object.position.y += snap;
                ui = this.uiHints.center;
                ui.start.copy(this.object.position).setY(centerY);
                ui.end.copy(m.object.position);
                ui.update();
                ui.visible = true;
            } else {
                snap = minY - minCurY;
                if (Math.abs(snap) < this.maxGap) {
                    this.object.position.y += snap;
                    ui = this.uiHints.bottom;
                    this.updateHorzHint(
                        ui,
                        leftMostX,
                        rightMostX,
                        min.y - snap,
                        zUi
                    );
                } else {
                    snap = maxY - maxCurY;
                    if (Math.abs(snap) < this.maxGap) {
                        this.object.position.y += snap;
                        ui = this.uiHints.top;
                        this.updateHorzHint(
                            ui,
                            leftMostX,
                            rightMostX,
                            max.y - snap,
                            zUi
                        );
                    }
                }
            }
        }

        // 2- Snap spacing
        // split adjacent artworks into left and right ones
        let leftMagnets: MagnetData[] = [],
            rightMagnets: MagnetData[] = [];
        this.magnets.forEach((m) => {
            // Currently we snap-space only when the horz X axis crosses
            // the other artworks. Tried relaxing this condition and got some undesirable
            // results where the snap prioritizes other artworks that `seem closer` but
            // Visually they're not
            // Another idea could be give different weights to x and y distances and
            // set the y distance to a low value so that we can prioritize horizontally close artworks
            // For now it remains an edge case since in most of the cases we'll be snapping in horizontally
            // close artworks. We can adjust depending on user feedback
            if (!(m.boxInScaled.min.y < 0 && m.boxInScaled.max.y > 0)) return;
            if (m.boxInScaled.min.x > scaledBox.max.x) {
                rightMagnets.push(m);
            } else if (m.boxInScaled.max.x < scaledBox.min.x) {
                leftMagnets.push(m);
            }
        });
        const y = 0;
        let snapped = false;
        // case 1: object is in between the 2 adjacent artworks
        if (leftMagnets.length > 0 && rightMagnets.length > 0) {
            let left = leftMagnets[0];
            let right = rightMagnets[0];
            let snap = (left.boxInScaled.max.x + right.boxInScaled.min.x) / 2;
            if (Math.abs(snap) < this.maxGap) {
                snapped = true;
                tmpVec1.set(snap, 0, 0).applyQuaternion(this.object.quaternion);
                this.object.position.add(tmpVec1);
                // show hints
                this.updateHorzHint(
                    this.uiHints.space1,
                    left.boxInScaled.max.x - snap,
                    curMin.x,
                    y,
                    0
                );
                this.updateHorzHint(
                    this.uiHints.space2,
                    curMax.x,
                    right.boxInScaled.min.x - snap,
                    y,
                    0
                );
                this.uiHints.center.visible = false;
            }
        }

        // case 2: object is on the right of the 2 adjacent artworks
        if (!snapped && leftMagnets.length > 1) {
            let left = leftMagnets[1];
            let right = leftMagnets[0];

            let refDistanceX = right.boxInScaled.min.x - left.boxInScaled.max.x;
            let curDistanceX = scaledBox.min.x - right.boxInScaled.max.x;
            let snap = refDistanceX - curDistanceX;
            if (
                refDistanceX >= 0 &&
                curDistanceX >= 0 &&
                Math.abs(snap) < this.maxGap
            ) {
                snapped = true;
                tmpVec1.set(snap, 0, 0).applyQuaternion(this.object.quaternion);
                this.object.position.add(tmpVec1);
                // show hints
                this.updateHorzHint(
                    this.uiHints.space2,
                    curMin.x,
                    right.boxInScaled.max.x - snap,
                    y,
                    0
                );
                this.updateHorzHint(
                    this.uiHints.space1,
                    right.boxInScaled.min.x - snap,
                    left.boxInScaled.max.x - snap,
                    y,
                    0
                );

                this.uiHints.center.visible = false;
            }
        }

        // case 3: object is on the left of the 2 adjacent artworks
        if (!snapped && rightMagnets.length > 1) {
            let left = rightMagnets[0];
            let right = rightMagnets[1];
            let refDistanceX = right.boxInScaled.min.x - left.boxInScaled.max.x;
            let curDistanceX = left.boxInScaled.min.x - curMax.x;
            let snap = curDistanceX - refDistanceX;
            if (
                refDistanceX >= 0 &&
                curDistanceX >= 0 &&
                Math.abs(snap) < this.maxGap
            ) {
                snapped = true;
                tmpVec1.set(snap, 0, 0).applyQuaternion(this.object.quaternion);
                this.object.position.add(tmpVec1);
                // show hints
                this.updateHorzHint(
                    this.uiHints.space2,
                    curMax.x,
                    left.boxInScaled.min.x - snap,
                    y,
                    0
                );
                this.updateHorzHint(
                    this.uiHints.space1,
                    left.boxInScaled.max.x - snap,
                    right.boxInScaled.min.x - snap,
                    y,
                    0
                );

                this.uiHints.center.visible = false;
            }
        }
    }

    updateHorzHint(
        ui: LineHint,
        xStart: number,
        xEnd: number,
        y: number,
        z: number
    ) {
        ui.start
            .set(xStart, y, z)
            .applyQuaternion(this.object.quaternion)
            .add(this.object.position);
        ui.end
            .set(xEnd, y, z)
            .applyQuaternion(this.object.quaternion)
            .add(this.object.position);
        ui.update();
        ui.visible = true;
    }

    // endPoint is XY displacement world coordinates
    snapScale(delta: Vector3, cornerName: CornerName) {
        Object.keys(this.uiHints).forEach((key) => {
            let ui: LineHint = this.uiHints[key];
            ui.visible = false;
        });

        const matInv = tmpMat1
            .compose(
                this._positionStart,
                this._quaternionStart,
                this._scaleStart
            )
            .invert();

        const startMin = this._scaledBoxStart.min;
        const startMax = this._scaledBoxStart.max;

        const curBox = getLocalBBox(this.object, tmpBox);

        const curMin = curBox.min
            .applyMatrix4(this.object.matrixWorld)
            .applyMatrix4(matInv)
            .multiply(this._scaleStart);

        const curMax = curBox.max
            .applyMatrix4(this.object.matrixWorld)
            .applyMatrix4(matInv)
            .multiply(this._scaleStart);

        let dy = cornerName === "Left" || cornerName === "Right" ? delta.x : delta.y;

        this.magnets.sort((m1, m2) => {
            let d1 = m1.object.position.distanceToSquared(this.object.position);
            let d2 = m2.object.position.distanceToSquared(this.object.position);
            return d1 - d2;
        });

        let ui: LineHint;
        let scale: number;
        for (let i = 0; i < this.magnets.length; i++) {
            let m = this.magnets[i];

            const min = tmpVec3
                .copy(m.box.min)
                .applyMatrix4(m.object.matrixWorld)
                .applyMatrix4(matInv)
                .multiply(this._scaleStart);

            const max = tmpVec4
                .copy(m.box.max)
                .applyMatrix4(m.object.matrixWorld)
                .applyMatrix4(matInv)
                .multiply(this._scaleStart);

            let minY = min.y;
            let maxY = max.y;

            const leftMostX = Math.min(curMin.x, min.x);
            const rightMostX = Math.max(curMax.x, max.x);
            const zUi = curBox.min.z;

            if (cornerName === "bottomLeft" || cornerName === "bottomRight" || cornerName === "bottom") {
                let gap = minY - (startMin.y + delta.y);
                if (Math.abs(gap) < this.maxGap) {
                    dy = minY - startMin.y;

                    ui = this.uiHints.bottom;
                    ui.start
                        .set(leftMostX, min.y, zUi)
                        .applyQuaternion(this.object.quaternion)
                        .add(this._positionStart);
                    ui.end
                        .set(rightMostX, min.y, zUi)
                        .applyQuaternion(this._quaternionStart)
                        .add(this._positionStart);
                }
            } else if (cornerName === "topLeft" || cornerName === "topRight" || cornerName === "top") {
                let gap = maxY - (startMax.y + delta.y);
                if (Math.abs(gap) < this.maxGap) {
                    dy = maxY - startMax.y;

                    ui = this.uiHints.top;
                    ui.start
                        .set(leftMostX, max.y, zUi)
                        .applyQuaternion(this._quaternionStart)
                        .add(this._positionStart);
                    ui.end
                        .set(rightMostX, max.y, zUi)
                        .applyQuaternion(this._quaternionStart)
                        .add(this._positionStart);
                }
            }

            if (ui != null) {
                ui.update();
                ui.visible = true;
                break;
            }
        }

        if (cornerName === "bottomLeft" || cornerName === "bottomRight" || cornerName === "bottom") {
            scale = 1 + dy / 2 / startMin.y;
        } else if (cornerName === "topLeft" || cornerName === "topRight" || cornerName === "top") {
            scale = 1 + dy / 2 / startMax.y;
        } else if(cornerName === "Left") {
            scale = 1 + dy / 2 / startMax.x
        } else if(cornerName === "Right") {
            scale = 1 + dy / 2 / startMin.x
        }
        return scale;
    }

    hideMagnets() {
        // this.magnets.forEach((it) => {
        //     Object.keys(it.lines).forEach(
        //         (key) => (it.lines[key].visible = false)
        //     );
        // });
        Object.keys(this.uiHints).forEach((key) => {
            let ui = this.uiHints[key];
            ui.visible = false;
            this.add(ui);
        });
    }

    updateMatrixWorld(force: boolean) {
        //
        if (!this.enabled || this.object == null) return;

        this.object.updateWorldMatrix(false, true);

        this.updatePlane();

        getLocalBRect(this.object, tmpBRect1);


        for (let i = 0; i < this.handles.length; i++) {
            let handle = this.handles[i];
            handle.updateScale(tmpBRect1, this.object.scale);
            handle.showHovered(this.currentHandle === handle);
        }

        // Handle.updateSelectionBorder(this.object, tmpBRect1, this.object.scale)
        //.addScalar(0.1);
        // this.object.matrixWorld.decompose(
        //     this.plane.position,
        //     this.plane.quaternion,
        //     tmpVec3
        // );
        // Update handle positions

        // let adjust =
        //     (0 * this.resizeHandles.bottomLeft.handleSize) /
        //     (4 * this.object.scale.x);
        // getScaledBRect(this.object, tmpBRect1);

        // for (key in this.resizeHandles) {
        //     let handle = this.resizeHandles[key];
        //     let corner = corners[key];
        //     let dir = unitDirections[key];
        //     handle.position.set(
        //         tmpBRect1[corner.x] - adjust * dir.x,
        //         tmpBRect1[corner.y] - adjust * dir.y,
        //         0
        //     );
        //     handle.position
        //         .applyQuaternion(this.object.quaternion)
        //         .add(this.object.position);
        //     handle.quaternion.copy(this.object.quaternion);
        //     handle.showHovered(this.currentHandle === handle);
        // }
        // this.moveHandle.position.copy(this.object.position);
        // this.moveHandle.quaternion.copy(this.object.quaternion);
        // this.moveHandle.showHovered(this.currentHandle === this.moveHandle);
        super.updateMatrixWorld(force);
    }

    onPointerHover = (event: PointerEvent) => {
        if (!this.enabled || this.object == null || this._isDragging) {

            this.cursorHandler()

            return
        }

        this.currentHandle = null;

        const intersects = this.hitTest(event, this.raycastedHandles);

        if (intersects.length === 0) {
            this.cursorHandler()
            return
        };

        let object = intersects[0].object.userData.handle;

        if (object instanceof Handle) {
            this.currentHandle = object;
        }

        this.cursorHandler()

    };

    cursorHandler() {

        if(this.autoHandleCursor) {

            this.domElement.style.cursor = this.getCursor() || "default"
        }
    }


    _currentScale = new Vector3()

    surfaceGrabPoint = new Vector3()
    pointerLast = { x: 0, y: 0 }


    resetStart(hitPoint: Vector3) {

        this._positionStart.copy(this.object.position);
        this._quaternionStart.copy(this.object.quaternion);
        this._quaternionStartInv.copy(this.object.quaternion).invert();
        this.pointStart.copy(hitPoint).sub(this._positionStart);

        if(this.currentHandle.handleMode === "scale") {

            let cornerName = this.currentHandle.handleCorner

            if(this.object instanceof TextSpaceArtwork && (cornerName === "Left" || cornerName === "Right")) {
                this.scaleMode = "FontWidth"
                this._scaleStart.set(this.object.font.options.width, 1, 1)
            }
            else {
                this.scaleMode = "Scale"
                this._scaleStart.copy(this.object.scale);
            }
            this._currentScale.copy(this._scaleStart)

            getScaledBBox(this.object, this._scaledBoxStart);
        }
    }

    onPointerDown = (event: PointerEvent) => {
        if (
            !this.enabled ||
            this.locked ||
            this.object == null ||
            event.button !== 0
        )
            return;

        if(IS_MOBILE) {
           this.onPointerHover(event)
        }

        if(this.currentHandle == null) return

        let intersects = this.hitTest(event, [this.plane]);
        if (!intersects.length) return;
        let intersect = intersects[0];

        this.pointerLast.x = event.clientX;
        this.pointerLast.y = event.clientY;
        this.surfaceGrabPoint.copy(intersect.point);
        this.object.worldToLocal(this.surfaceGrabPoint);
        // The hit handle is a thick box; only its in-plane offset belongs to
        // the grab point. Text already has its own clearance from the wall.
        this.surfaceGrabPoint.z = 0;
        this.dragging = true;
        this.resetStart(intersect.point)

        this.domElement.setPointerCapture(event.pointerId);
        this.domElement.addEventListener("pointermove", this.onPointerMove);

        this.getAdjacentArtworks(this.object);
    };

    onPointerMove = (event: PointerEvent) => {
        if (
            !this.enabled ||
            this.object == null ||
            this.currentHandle == null ||
            !this._isDragging
        )
            return;

        this.pointerLast.x = event.clientX;
        this.pointerLast.y = event.clientY;

        if (this.currentHandle.handleMode === "translate" && this._axis === "XY") {
            const sceneIntersect = this.hitSceneMeshes(event);
            const distance = sceneIntersect
                ? this.object.getWorldPosition(tmpVec4).distanceTo(sceneIntersect.point)
                : Infinity;

            // Follow the surface under the pointer, even when it is parallel to
            // the previous wall. Keep the original grabbed point under the cursor.
            if (
                sceneIntersect &&
                distance < this.maxTranslateSnapDistance &&
                placeOnSurface(
                    this.object,
                    sceneIntersect,
                    this.surfaceGrabPoint,
                    raycaster.ray.direction
                )
            ) {
                this.getAdjacentArtworks(this.object);
                this.snapTranslate();
                this.updateMatrixWorld(true);
                this.resetStart(sceneIntersect.point);
                this.object.updateCoords?.(true);
                return;
            }
        }

        let intersects = this.hitTest(event, [this.plane]);
        if (!intersects.length) return;
        let intersect = intersects[0];
        this.pointEnd.copy(intersect.point).sub(this._positionStart);

        if (this.currentHandle.handleMode === "scale") {
            let cornerName = this.currentHandle.handleCorner;
            let direction = unitDirections[cornerName];

            vOffset
                .copy(this.pointEnd)
                .sub(this.pointStart)
                .applyQuaternion(this._quaternionStartInv)

            if(cornerName === "Left" || cornerName === "Right") {
                vOffset.multiply(axisAdjust.X)
            }
            else {
                if(cornerName === "top" || cornerName === "bottom") {
                    vOffset.multiply(axisAdjust.Y)
                }
            }

            let d = this.snapScale(vOffset, cornerName);

            const scaleV3 = this.getScaleVec3(cornerName, d)


            if(this.object instanceof TextSpaceArtwork &&  this.scaleMode === "FontWidth") {

                this._currentScale.copy(this._scaleStart).multiply(scaleV3)

                this.object.font.updateStyle({
                    width: this._currentScale.x
                })

                this.object.userData = {
                    ...this.object.userData,
                    width: this._currentScale.x
                }

                this.object.updateRaycastMesh()

                getScaledBBox(this.object, tmpBox)

                tmpVec1.copy(this._scaledBoxStart.max).multiply(direction)

                tmpVec2.copy(tmpBox.max).multiply(direction)
            }
            else {
                this._currentScale.copy(this._scaleStart).multiply(scaleV3)

                this.object.scale.copy(this._currentScale);

                // we need to shift the artwork position so that only the dragged corner
                // appears to have changed its position
                getLocalBBox(this.object, tmpBox);

                // unscaled position of the dragged corner
                tmpVec1.copy(tmpBox.max).multiply(direction);

                // new scaled position of the dragged corner
                tmpVec2.copy(tmpVec1).multiply(this.object.scale);

                // old scaled position of the dragged corner
                tmpVec1.multiply(this._scaleStart);
            }

            // displacement
            tmpVec2.sub(tmpVec1).applyQuaternion(this.object.quaternion);

            // if (d < 1) tmpVec2.multiplyScalar(-1);
            this.object.position.copy(this._positionStart).add(tmpVec2);



        } else if (this.currentHandle.handleMode === "translate") {

            // console.log("translate snap")
            vOffset
                .copy(this.pointEnd)
                .sub(this.pointStart);
            vOffset
                .applyQuaternion(this._quaternionStartInv)
                .multiply(axisAdjust[this._axis])
                .applyQuaternion(this._quaternionStart);
            this.object.position.copy(vOffset).add(this._positionStart);
            this.object.updateMatrixWorld();
            this.snapTranslate();
        }

        this.object.updateCoords?.(true)
    };

    onPointerUp = (event: PointerEvent) => {
        if (!this.enabled || this.locked || !this._isDragging) return;
        // A fast release can arrive beyond the final pointermove. Apply that
        // position before dragEnd records the undo/save command.
        if (
            this.currentHandle?.handleMode === "translate" &&
            (event.clientX !== this.pointerLast.x || event.clientY !== this.pointerLast.y)
        ) {
            this.onPointerMove(event);
        }
        this.dragging = false;
        this.hideMagnets();
        this.domElement.releasePointerCapture(event.pointerId);
        this.domElement.removeEventListener("pointermove", this.onPointerMove);
    };

    scaleV3 = new Vector3()

    getScaleVec3(cornerName: CornerName, delta: number) {

        if(!isSideCorner(cornerName) || this.isUniformScale) {
            this.scaleV3.set(delta, delta, 1)
        }
        else if(cornerName === "Left" || cornerName === "Right") {
            this.scaleV3.set(delta, 1, 1)
        }
        else {
            this.scaleV3.set(1, delta, 1)
        }
        return this.scaleV3
    }

    dispose() {
        this.enabled = false;

        this.domElement.removeEventListener("pointerdown", this.onPointerDown);
        this.domElement.removeEventListener("pointermove", this.onPointerMove);
        this.domElement.removeEventListener("pointerup", this.onPointerUp);

        Emitter.off(Events.MIRROR, this.onMirror)
    }
}

const handleStyle = {
    normal: {
        fill: 0xffffff,
        border: 0x0466c8,
    },
    hovered: {
        fill: 0xdddddd,
        border: 0x0466c8,
    },
};

let handleMaterial = new MeshBasicMaterial({
    side: DoubleSide,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    fog: false,
    toneMapped: false,
});

const lineMaterial = new LineMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: true,
    color: handleStyle.normal.border,
    opacity: handleStyle.normal.border,
    fog: false,
    toneMapped: false,
    lineWidth: lineWidth
});

const HANDLE_RENDER_ORDER = 999999;

class Handle extends PipeLineMesh {
    public isSideCorner: boolean;
    public border: PipeLineLines;
    public raycastPlane?: Mesh<BufferGeometry, MeshBasicMaterial>;

    constructor(
        public handleSize: number,
        public handleMode: TransformMode,
        public handleCorner?: CornerName
    ) {

        super(
            new PlaneGeometry(handleSize, handleSize),
            handleMaterial.clone(),
            {
                visibleOnOcclusion: false,
                visibleOnMirror   : false
            }
        );
        this.renderOrder = HANDLE_RENDER_ORDER;

        this.isSideCorner = isSideCorner(handleCorner)

        if(!this.isSideCorner) {
            this.renderOrder -= 10;
            this.border = createBorder(this.geometry);
            this.border.renderOrder = this.renderOrder + 2;
            this.add(this.border);
        }
        else {
            // this.material.color.setRGB(1, 0, 0)
            this.visible = false
        }
    }

    showHovered(isHovered: boolean) {

        if(this.isSideCorner || this.handleMode === "scale") return;

        const style = isHovered ? handleStyle.hovered : handleStyle.normal;
        this.material.color.setHex(style.fill);
        this.border.material.color.setHex(style.border);
    }

    updateScale(parentBRect: BoundingRect, parentScale: Vector3): void {

        let scaleX = 1 / parentScale.x;
        let scaleY = 1 / parentScale.y;

        if (this.handleMode === "scale") {

            let cornerName = this.handleCorner;
            let corner = corners[cornerName];

            this.position.set(
                corner.x != null ? tmpBRect1[corner.x] : 0,
                corner.y != null ? tmpBRect1[corner.y] : 0,
                0
            );

            const unscaledSizeX = this.handleSize / parentScale.x
            const unscaledSizeY = this.handleSize / parentScale.y

            if(cornerName === "Left" || cornerName === "Right") {
                scaleY = (parentBRect.getHeight() - unscaledSizeX  * 4) / this.handleSize
            }

            else if(cornerName === "top" || cornerName === "bottom") {
                scaleX = (parentBRect.getWidth() - unscaledSizeY * 4 )/ this.handleSize
            }

        } else if (this.handleMode === "translate") {
            scaleX = parentBRect.getWidth()
            scaleY = parentBRect.getHeight()
        }
        this.scale.set(scaleX, scaleY, 1)
    }

    static createResizeHandle(size: number, corner: CornerName) {

        let handle = new Handle(size, "scale", corner);
        handle.raycastPlane = new PipeLineMesh(handle.geometry, handle.material, {
            visibleOnOcclusion: false,
            visibleOnMirror: false
        } );
        if(!handle.isSideCorner) {
            handle.raycastPlane.scale.multiplyScalar(2);
        } else if(handle.handleCorner === "Left" || handle.handleCorner === "Right") {
            handle.raycastPlane.scale.setX(2)
        } else if(handle.handleCorner === "top" || handle.handleCorner === "bottom") {
            handle.raycastPlane.scale.setY(2)
        }
        handle.raycastPlane.visible = false;
        handle.raycastPlane.userData.handle = handle;
        handle.add(handle.raycastPlane);
        return handle;
    }

    static createMoveHandle(size: number) {
        let handle = new Handle(size, "translate");
        handle.raycastPlane =  new PipeLineMesh(handle.geometry, handle.material, { visibleOnOcclusion: false, visibleOnMirror: false });
        handle.raycastPlane.scale.multiplyScalar(0.8);
        handle.raycastPlane.visible = false;
        handle.raycastPlane.userData.handle = handle;
        handle.add(handle.raycastPlane);
        return handle;
    }

    // static createSelectionBorder(object: Object3D) {
    //     //
    //     const mesh = getMesh(object);

    //     const border = getSelectionHandle(mesh, handleStyle.normal.border, lineWidth);

    //     border.name = "selection-border";

    //     border.scale.copy(mesh.scale)

    //     object.add(border);

    //     object.userData.$$selectionBorder = border;
    // }


    // static destroySelectionBorder(object: Object3D) {
    //     //
    //     let border = object.userData.$$selectionBorder;

    //     if(border != null) {
    //         //
    //         object.remove(border);

    //         object.userData.$$selectionBorder = null;

    //         disposeObject3D(border);
    //     }
    // }

    // static getSelectionBorder(object: Object3D) {
    //     //
    //     return object.userData.$$selectionBorder;
    // }
}


function createBorder(geometry: BufferGeometry) {
    const edges = new EdgesGeometry(geometry);
    let geo = new LineSegmentsGeometry().fromEdgesGeometry( edges );
    const material = lineMaterial.clone();
    const border = new PipeLineLines(geo, material, {visibleOnOcclusion: false, visibleOnMirror: false});
    return border;
}

class LineHint extends PipeLineLines {
    private points: [Vector3, Vector3];

    constructor(
        public start: Vector3,
        public end: Vector3,
        material: LineMaterial
    ) {
        super(new LineSegmentsGeometry(), material, {visibleOnOcclusion: false, visibleOnMirror: false});
        this.start = start.clone();
        this.end = end.clone();
        this.points = [this.start, this.end];
        this.frustumCulled = false;
        this.renderOrder = Infinity;
        this.update();
    }

    update() {

        this.geometry.setPositions([this.points[0].x, this.points[0].y,this.points[0].z, this.points[1].x, this.points[1].y, this.points[1].z]);
        this.geometry.attributes.position.needsUpdate = true;
    }

    static createHintLines() {
        let start = new Vector3(0, 0, 0);
        let end = new Vector3(1, 0, 0);

        let material = new LineMaterial({
            color: 0xff0000,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            fog: false,
            toneMapped: false,
            linewidth: lineWidth * 0.5
        });

        let center = new LineHint(start, end, material);
        let top = new LineHint(start, end, material);
        let bottom = new LineHint(start, end, material);

        let space1 = new LineHint(start, end, material);
        let space2 = new LineHint(start, end, material);

        let lines = { center, top, bottom, space1, space2 };
        return lines;
    }
}

// DO Not remove, used for debug purposes

// function markObject(obj: SpaceArtwork) {
//     let mark = obj.getObjectByName("$$marker");
//     if (mark == null) {
//         let w =
//             (obj.raycastMesh.geometry as BoxGeometry).parameters.width / 20;
//         mark = new Mesh(
//             new SphereGeometry(w),
//             new MeshBasicMaterial({ color: 0x00dddd })
//         );
//         mark.name = "$$marker";
//         obj.add(mark);
//     }
//     mark.visible = true;
// }

// function unmarkObject(obj: SpaceArtwork) {
//     let mark = obj.getObjectByName("$$marker");
//     if (mark != null) {
//         mark.visible = false;
//     }

//     let lines = obj.getObjectByName("lines");
//     if (lines != null) {
//         lines.parent.remove(lines);
//     }
// }
