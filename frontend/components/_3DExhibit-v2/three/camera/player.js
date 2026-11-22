import { createTravelCameraResolver, advanceCompactTravelCamera, compactTravelCameraTarget } from "@features/lobby/worldTravelCamera";
import * as THREE from "three";
// @ts-check

import {

    ArrowHelper,
    Box3,
    Euler,
    MathUtils,
	Matrix4,
	PerspectiveCamera,

	Quaternion,

	Ray,

	Vector2,

	Vector3

} from 'three'

import {

    APP_STATES,

	CANVAS,

	DEBUG,

    DEFAULT_ADJUSTMENT_SPEED,

    FAST_ADJUSTMENT_SPEED,

    IS_MOBILE,

    MOBILE_FOLLOW_CONTOLS,

    MOBILE_FOLLOW_CONTOLS_1,

    MOBILE_FOLLOW_CONTOLS_2,

    ORIENTATION,

    PORTRAIT,

    SET_ADJUSTMENT_SPEED,

    SET_FAST_ADJUSTMENT_SPEED,

    USER_HEIGHT

} from '@3constants'

import Mediator from '@3mediator'

import Camera from 	'@3camera'

import emitter from '@3emitter'

import Events from '@3events'

import Players from "@3factory/player"

import { getDistance } from '../utils/spaceutils'

import Raycaster from '@3raycaster'

import {

    FAR,

    FOV,

    MAX_ZOOM_OUT,

    MIN_ZOOM_OUT,

    GET_CAMERA_HEIGHT,

    NEAR,

    walkNear,

    PLAYER_CAMERA_SENSITIVITY,

    PLAYER_TRANSITION_TYPE,

    CAMERA_HEIGHT

} from './constants'


import AbstractCamera from './abstract.js'

import { initCamera } from '../utils/camera'
import scene from '../scene'

// import Scene from "@3scene"

const playerForwardVector = new Vector3(0, 0, -1);

const cameraForwardVector = new Vector3(0, 0, -1);


const playerRotation = new Euler(0, 0, 0);

const cameraRotation = new Euler(0, 0, 0);

const cartv3 = new Vector3()

const nearFwd = new Vector3()

const nearRight = new Vector3()

const nearUp = new Vector3()

const nearCorner = new Vector3()

const nearRay = new Ray()

// gap left between the camera and an obstacle behind the avatar
const CAMERA_WALL_PADDING = 0.25

// how fast the camera radius eases in toward / back out from an obstacle (1/s)
const CAMERA_PULL_IN_RATE = 14

const CAMERA_RELEASE_RATE = 3

// how far ahead (seconds) the camera looks for walls swinging in behind
const CAMERA_LOOKAHEAD = 0.25

// when the straight-behind clearance is under CAMERA_RELIEF_BELOW, try these
// pitch offsets (degrees) and drift to one that gains CAMERA_RELIEF_GAIN
const CAMERA_RELIEF_BELOW = 3

const CAMERA_RELIEF_PITCHES = [15, -15, 30, -30, 45]

const CAMERA_RELIEF_GAIN = 0.75

const CAMERA_RELIEF_RATE = 3

// smallest near plane fitNearToWalls may shrink to
const MIN_FIT_NEAR = 0.02

class PlayerCamera extends AbstractCamera {

	constructor(fov, aspect, near, far) {

		super(fov, aspect, near, far)

        // this.collisionDistance = MAX_ZOOM_OUT

		this.resizeEvent = this.resize.bind(this)

		// this.position.copy(ORIGIN)

        this.isTransitioning = false

        this.isAdjustCamera = true;

        // this.arrowHelper = new ArrowHelper( new Vector3(0, 0, 0), new Vector3(0, 0, 0), 2, 0xff00ff );

        // scene.add(this.arrowHelper);

        // this.cameraarrowHelper = new ArrowHelper( new Vector3(0, 0, 0), new Vector3(0, 0, 0), 2, 0x00ffff );

        // scene.add(this.cameraarrowHelper);

        this.transitionType = ""; // "zoom-in" "zoom-out"

        this.cameraPosition = new Vector3();

        this.idealCameraPosition = new Vector3();

        this.idealCameraTarget = new Vector3();

        this.cameraTarget = new Vector3();

        this.sensitivity = new Vector2(PLAYER_CAMERA_SENSITIVITY, PLAYER_CAMERA_SENSITIVITY * 0.8);

        this.theta = 0;

        this.phi = 0;

        // For camera collisions

        this.originVec = new Vector3();

        this.rotationMatrix = new Matrix4();

        this.origin = new Vector3(0, 0, 0);

        this.playerCameraWorldDir = new Vector3();

        this.prevAdjustment = "";

        this.transitionRadius = 0;

        this.adjustmentSpeed =  DEFAULT_ADJUSTMENT_SPEED;

        window.changeAdjustmentSpeed = (type, speed) => {
            if (type === "default") {
                SET_ADJUSTMENT_SPEED(speed);

            }

            if (type === "fast") {
                SET_FAST_ADJUSTMENT_SPEED(speed);
            }
        }

        this.ray = new Ray();

        this.radius = 0;

        this.nearPlaneCorners = [
            new Vector3(),
            new Vector3(),
            new Vector3(),
            new Vector3(),
        ];


        this.cameraHeight = this.getCameraHeight()

        // this.arrowHelpers = [new ArrowHelper(), new ArrowHelper(), new ArrowHelper(), new ArrowHelper()]

        // Scene.add(...this.arrowHelpers)

		if( DEBUG ){
            // @ts-ignore
			window.camera = this
		}
        // const dir = new Vector3( 1, 2, 0 );

        // //normalize the direction vector (convert to vector of length 1)
        // dir.normalize();

        // const origin = new Vector3( 0, 0, 0 );
        // const length = 1;
        // const hex = 0xffff00;

        // this.arrowHelper = new ArrowHelper( dir, origin, length, hex );
        // scene.add( this.arrowHelper );
	}

    setState(STATE, opts){
		return new Promise((resolve)=>{

			switch (STATE) {

			    case APP_STATES.SPACE :

                    this.player = Players.main;

                    this.setSpace(opts.space, opts.roomParameters, true)

                    break;

                case APP_STATES.TELEPORT :

                    this.setSpace(opts.space, opts.roomParameters, false)

                    this._rotation = Players.main.rotation;

                    this._position = Players.main.position;

                    break;

			}

			resolve()
		})
	}

    /**
     *
     * @param { import('@gltypes').SpaceData } space
     * @param {  import('@uitypes/roomParameters').RoomParameters } roomParameters
     * @param { boolean } init
     */
    setSpace (space, roomParameters, init) {

        this.currentSpace = space;
        if (this.travelFraming) this.fov = this.travelFraming.baseFov;
        this.travelFraming = undefined;
        this.travelTargetOffset = undefined;

        // CAMERA_HEIGHT = Players.main.height;
        this.roomParameters = roomParameters;

        this.cameraDistance = new Vector3();


        this.near = this.baseNear = walkNear(this.roomParameters.near || this.currentSpace.near)

        this.far = this.roomParameters.far || this.currentSpace.far

        if( this.roomParameters.fog?.enabled == true ) {

            this.far =  this.roomParameters.fog.far
        }



        this.updateProjectionMatrix()

        if(init) {

            initCamera(this.roomParameters, this)
        }

    }

    // Helper function to output the corners of the camera
    initNearPlaneCorner() {

        const near = this.baseNear ?? this.near;

        const fov = this.getEffectiveFOV() * MathUtils.DEG2RAD;

        const heightHalf = Math.tan(fov * 0.5) * near; // near plain half height

        const widthHalf = heightHalf * this.aspect; // near plain half width

        this.nearPlaneCorners[0].set(-widthHalf, -heightHalf, 0);
        this.nearPlaneCorners[1].set(widthHalf, -heightHalf, 0);
        this.nearPlaneCorners[2].set(widthHalf, heightHalf, 0);
        this.nearPlaneCorners[3].set(-widthHalf, heightHalf, 0);

        return this.nearPlaneCorners;
    }

    setSensitivity(
        sensitivityX,
        sensitivityY = sensitivityX * .8
    ) {

        this.sensitivity = new Vector2(sensitivityX, sensitivityY);
    }

    move(deltaX, deltaY) {

        this.theta -= deltaX * (this.sensitivity.x / 2);

        this.theta %= 360;

        this.phi += deltaY * (this.sensitivity.y / 2);

        this.phi = Math.min(85, Math.max(-85, this.phi));
    }

    set _rotation(rotation) {

        this.theta = MathUtils.radToDeg(rotation.y)

        this.phi = -MathUtils.radToDeg(rotation.x)

        this.targetRadius = 0;
    }

    sphericalToVec3(r, theta, phi, out) {

        const cosPhiRadius = r * Math.cos((phi * Math.PI) / 180)

        out.set(
            cosPhiRadius * Math.sin((theta * Math.PI) / 180) ,
            r * Math.sin((phi * Math.PI) / 180),
            cosPhiRadius * Math.cos((theta * Math.PI) / 180)
        );
    }

    set _position(position) {

        this.targetRadius = 0;

        this.sphericalToVec3(this.targetRadius, this.theta, this.phi, cartv3)

        this.idealCameraPosition.set(
            position.x + cartv3.x,
            position.y + this.cameraHeight + cartv3.y,
            position.z + cartv3.z
        );

        this.idealCameraTarget.set(
            position.x,
            position.y + this.cameraHeight,
            position.z
        );

        this.cameraPosition.copy(this.idealCameraPosition)

        this.cameraTarget.copy(this.idealCameraTarget)
    }



    resize(w, h) {
        super.resize(w, h);
        if (this.travelFraming) {
            this.travelFraming.baseFov = this.fov;
            if (this.travelFraming.kind === "portal") {
                this.fov = this.travelFraming.fov;
                this.updateProjectionMatrix();
                return;
            }
            this.travelFraming.fov = Math.max(this.fov, 90);
            this.fov += (this.travelFraming.fov - this.fov) * this.travelFraming.blend;
            this.updateProjectionMatrix();
        }
    }

    updateTravelFraming(deltaTime) {
        const profile = this.travelFraming;
        if (!profile) return;
        if (profile.kind === "portal") {
            this.travelTargetOffset ??= new Vector3();
            this.travelTargetOffset.copy(profile.targetOffset)
                .applyAxisAngle(THREE.Object3D.DEFAULT_UP, MathUtils.degToRad(this.theta));
            this.cameraHeight = this.travelTargetOffset.y;
            if (Math.abs(this.fov - profile.fov) > 1e-5) {
                this.fov = profile.fov;
                this.updateProjectionMatrix();
            }
            return;
        }
        if (profile.blend < 0.0001) {
            this.fov = profile.baseFov;
            this.travelFraming = undefined;
            this.travelTargetOffset = undefined;
            this.updateProjectionMatrix();
            return;
        }
        this.travelCameraResolver ??= createTravelCameraResolver(THREE, (ray) => Camera.currentControls?.world?.rayIntersect(ray));
        const nativeHeight = this.cameraHeight;
        const origin = this.player.position.clone();
        origin.y += nativeHeight;
        this.sphericalToVec3(MAX_ZOOM_OUT, this.theta, this.phi, cartv3);
        const clearance = this.travelCameraResolver.safeDistance(origin, origin.clone().add(cartv3), {
            near: this.near, fov: profile.baseFov, aspect: this.aspect,
        });
        advanceCompactTravelCamera(profile, clearance, deltaTime);
        const target = compactTravelCameraTarget(profile, nativeHeight, MathUtils.degToRad(this.theta));
        this.travelTargetOffset ??= new Vector3();
        this.travelTargetOffset.set(target.x, target.y, target.z);
        const center = this.player.position.clone();
        center.y += target.y;
        const shifted = this.player.position.clone().add(this.travelTargetOffset);
        const side = Math.hypot(target.x, target.z);
        if (side > 1e-6) {
            const safeSide = this.travelCameraResolver.safeDistance(center, shifted, { near: this.near, fov: target.fov, aspect: this.aspect });
            this.travelTargetOffset.x *= safeSide / side;
            this.travelTargetOffset.z *= safeSide / side;
        }
        this.cameraHeight = target.y;
        if (Math.abs(this.fov - target.fov) > 1e-5) {
            this.fov = target.fov;
            this.updateProjectionMatrix();
        }
    }

    cameraCollision = () => {
        const maxDistance = this.travelFraming?.kind === "portal"
            ? this.travelFraming.radius : MAX_ZOOM_OUT;
        const world = Camera.currentControls?.world;
        if (!world) return maxDistance;
        // Normal walking uses master's collision: it pulls in early and
        // steadily, so the eased radius stays smooth. The travel resolver
        // below can drop to 0 for a frame in tight corridors.
        if (!this.travelFraming) return this.walkCameraCollision(world);
        this.sphericalToVec3(maxDistance, this.theta, this.phi, cartv3);
        const target = this.player.getWorldCenterPoint();
        target.y += this.cameraHeight;
        const center = target.clone();
        if (this.travelFraming && this.travelTargetOffset) {
            target.x += this.travelTargetOffset.x;
            target.z += this.travelTargetOffset.z;
        }
        this.cameraDistance.copy(target).add(cartv3);
        this.travelCameraResolver ??= createTravelCameraResolver(THREE, (ray) => Camera.currentControls?.world?.rayIntersect(ray));
        let distance = this.travelCameraResolver.safeDistance(target, this.cameraDistance, {
            near: this.near, fov: this.getEffectiveFOV(), aspect: this.aspect,
        });
        if (this.travelFraming) {
            const endpoint = target.clone().addScaledVector(cartv3, distance / Math.max(maxDistance, 1e-6));
            const length = endpoint.distanceTo(center);
            const direct = this.travelCameraResolver.safeDistance(center, endpoint, { near: this.near, fov: this.getEffectiveFOV(), aspect: this.aspect });
            if (direct < length) distance *= direct / Math.max(length, 1e-6);
        }
        return distance;
    }

    walkCameraCollision(world, theta = this.theta, phi = this.phi, lead = null) {

        const maxZoomOut = MAX_ZOOM_OUT

        this.sphericalToVec3(maxZoomOut, theta, phi, cartv3)

        const playerCenter = Players.main.getWorldCenterPoint();

        playerCenter.y += this.cameraHeight

        // lead: where the avatar will be shortly, for look-ahead probes
        if (lead) playerCenter.add(lead)

        this.cameraDistance.copy(playerCenter).add(cartv3)

        let distance = maxZoomOut;

        const nearPlaneCorners = this.initNearPlaneCorner();

        const direction = this.playerCameraWorldDir
            .subVectors(this.cameraDistance, playerCenter)
            .normalize();

        this.rotationMatrix.lookAt(this.origin, direction, this.up);

        for (let i = 0; i < nearPlaneCorners.length; i++) {

            // probe a box half the near plane's size: fitNearToWalls handles
            // the edges, and the full width kept grazing walls beside the
            // avatar in narrow corridors
            const nearPlaneCorner = nearPlaneCorners[i].multiplyScalar(0.5);

            nearPlaneCorner.applyMatrix4(this.rotationMatrix);

            const origin = this.originVec.addVectors(playerCenter, nearPlaneCorner);

            this.ray.set(origin, direction);

            const result = world.rayIntersect(this.ray)

            if ( result && result.distance < distance) {

                // stop just in front of the obstacle; master subtracted the
                // camera height here, which dropped to first person whenever
                // anything was within ~3 units behind the avatar
                distance = result.distance - CAMERA_WALL_PADDING;
            }
        }

        return distance < 0 ? 0 : distance;
    }

    // _intersectPoint = new Vector3()

    // _bbox = new Box3()

    // intersectRayMeshes(ray, meshes) {

    //     let distance = Infinity;

    //     for (let i = 0; i < meshes.length; i++) {

    //         const mesh = meshes[i];

    //        // intersect ray with mesh's geometry bounding box in world space
    //         if(mesh.geometry.boundingBox === null) {

    //             mesh.geometry.computeBoundingBox();
    //         }

    //         this._bbox.copy(mesh.geometry.boundingBox);

    //         this._bbox.applyMatrix4(mesh.matrixWorld);

    //         const result = ray.intersectBox(this._bbox, this._intersectPoint);

    //         if (result) {

    //             const distanceToIntersection = ray.origin.distanceTo(this._intersectPoint);

    //             if (distanceToIntersection < distance) {

    //                 distance = distanceToIntersection;
    //             }
    //         }
    //     }

    //     return distance;
    // }

    getCameraHeight(){

        var height = USER_HEIGHT

        if ( Players.main ){

            height = Players.main.getHeadPosition()
        }

        return  height

    }

    getAdjustCamera( deltaTime ) {

        if (deltaTime > 0.01) deltaTime = 0.01;

        const angle = Camera.currentControls.world.playerState.joystickStates["ANGLE"];

        let adjustment;

        if (angle && angle !== false) {

            if (angle > 220 && angle < 320) {

                adjustment = "disabled";
            } else if (angle > 90 && angle < 220) {

                adjustment = "right";
            }
            else {

                adjustment = "left";
            }
        }

        if ( adjustment === "left" || adjustment === "right" || adjustment === "disabled"){

            this.prevAdjustment = adjustment;
        }

        if (!adjustment) {

            this.adjustmentSpeed = FAST_ADJUSTMENT_SPEED
        } else {

            return

            this.adjustmentSpeed = DEFAULT_ADJUSTMENT_SPEED
        }

        if (adjustment === "disabled") return;

        playerForwardVector.set(0, 0, -1);

        cameraForwardVector.set(0, 0, -1);

        playerRotation.set(0, Players.main.rotation.y, 0);

        cameraRotation.set(0, this.rotation.y, 0);

        playerForwardVector.applyEuler(playerRotation);

        cameraForwardVector.applyEuler(cameraRotation);

        const dot = playerForwardVector.dot(cameraForwardVector);

        // this.arrowHelper.position.copy(Players.main.position);

        // this.arrowHelper.setDirection(playerForwardVector);

        // this.cameraarrowHelper.position.copy(this.position);

        // this.cameraarrowHelper.setDirection(cameraForwardVector);

        if ( dot < .99) {
            if (this.prevAdjustment === "right" || this.prevAdjustment === "disabled") {

                this.move(-this.adjustmentSpeed * deltaTime, 0);
            } else if (this.prevAdjustment === "left") {

                this.move(this.adjustmentSpeed * deltaTime, 0);
            }
        } else {
            this.prevAdjustment = "";
        }
    }

    setIsAdjustCamera(val) {

        this.isAdjustCamera = val;
    }

    update = (deltaTime) => {
        //
        if (IS_MOBILE && ORIENTATION === PORTRAIT && this.isAdjustCamera) {

            this.getAdjustCamera(deltaTime);
        }

        this.cameraHeight = this.getCameraHeight()
        this.updateTravelFraming(deltaTime);

        const LERP_ALPHA = 1.0 - Math.pow(0.001, deltaTime);

        const world = Camera.currentControls?.world;

        const walking = world && !this.travelFraming;

        // Travel framing eases toward the previous frame's target first, as
        // before the walking collision rework.
        if (!walking) this.radius = MathUtils.lerp(this.radius, this.targetRadius, 0.1);

        // Pitch the camera actually orbits at: the player's phi plus an eased
        // offset found below when the space straight behind is cramped.
        this.phiOffset = this.phiOffset || 0;

        const orbitPhi = MathUtils.clamp(this.phi + this.phiOffset, -80, 85);

        const distance = walking ? this.walkCameraCollision(world, this.theta, orbitPhi) : this.cameraCollision();

        if (walking) {

            // Going down stairs or under a low ceiling, the space right behind
            // the head closes up and the camera used to collapse into first
            // person. Look for more room a little above or below and drift the
            // camera there instead.
            let bestOffset = 0;

            let best = this.walkCameraCollision(world, this.theta, MathUtils.clamp(this.phi, -80, 85));

            if (best < CAMERA_RELIEF_BELOW) {

                for (let i = 0; i < CAMERA_RELIEF_PITCHES.length; i++) {

                    const offset = CAMERA_RELIEF_PITCHES[i];

                    const d = this.walkCameraCollision(world, this.theta, MathUtils.clamp(this.phi + offset, -80, 85));

                    if (d > best + CAMERA_RELIEF_GAIN) {

                        best = d;

                        bestOffset = offset;
                    }
                }
            }

            this.phiOffset = MathUtils.lerp(this.phiOffset, bestOffset, 1 - Math.exp(-CAMERA_RELIEF_RATE * deltaTime));
        }

        // Look ahead: probe where the view is turning to and where the avatar
        // is walking to over the next CAMERA_LOOKAHEAD seconds. A wall about
        // to swing in behind the avatar (turning, passing a corridor corner)
        // is seen early, so the camera has already eased in when it arrives
        // instead of jumping forward in one frame. Only the predicted motion
        // is probed, so a wall running alongside doesn't pull the camera in.
        let softDistance = distance;

        if (walking && deltaTime > 0) {

            const turnRate = this.lastTheta == null ? 0 : (this.theta - this.lastTheta) / deltaTime;

            this.lead = this.lead || new Vector3();

            this.lastPlayerPos = this.lastPlayerPos || this.player.position.clone();

            this.lead.subVectors(this.player.position, this.lastPlayerPos).multiplyScalar(CAMERA_LOOKAHEAD / deltaTime);

            this.lead.y = 0;

            if (this.lead.lengthSq() > 4) this.lead.setLength(2);

            const aheadTheta = this.theta + MathUtils.clamp(turnRate * CAMERA_LOOKAHEAD, -45, 45);

            if (Math.abs(aheadTheta - this.theta) > 1 || this.lead.lengthSq() > 0.0025) {

                softDistance = Math.min(softDistance, this.walkCameraCollision(world, aheadTheta, orbitPhi, this.lead));
            }
        }

        this.lastTheta = this.theta;

        if (this.player) (this.lastPlayerPos = this.lastPlayerPos || new Vector3()).copy(this.player.position);

        this.targetRadius = !this.isTransitioning
            ? Math.min(softDistance, this.travelFraming?.kind === "portal" ? this.travelFraming.radius : MAX_ZOOM_OUT)
            : this.transitionType === PLAYER_TRANSITION_TYPE.ZOOM_IN
                ? this.transitionRadius
                : Math.min(softDistance, this.transitionRadius);

        // Walking: slide in quickly when something comes between camera and
        // avatar, ease back out slowly once it's gone. Travel framing already
        // eased toward last frame's target above, so arrival never jumps.
        if (walking) {

            const easeRate = this.targetRadius < this.radius ? CAMERA_PULL_IN_RATE : CAMERA_RELEASE_RATE;

            this.radius = MathUtils.lerp(this.radius, this.targetRadius, 1 - Math.exp(-easeRate * deltaTime));
        }

        if (!this.isTransitioning || this.transitionType !== PLAYER_TRANSITION_TYPE.ZOOM_IN) {

            // never leave the camera on the far side of an obstacle
            this.radius = Math.min(this.radius, Math.max(0, distance));
        }

        if (this.radius < this.player.radius) {

            Players.main.hide()
        } else {

            Players.main.show()
        }

        this.sphericalToVec3(this.radius, this.theta, orbitPhi, cartv3)

        this.idealCameraPosition.set(
            this.player.position.x + cartv3.x + (this.travelFraming ? this.travelTargetOffset.x : 0),
            this.player.position.y + this.cameraHeight + cartv3.y,
            this.player.position.z + cartv3.z + (this.travelFraming ? this.travelTargetOffset.z : 0));

        this.idealCameraTarget.set(
            this.player.position.x + (this.travelFraming ? this.travelTargetOffset.x : 0),
            this.player.position.y + this.cameraHeight,
            this.player.position.z + (this.travelFraming ? this.travelTargetOffset.z : 0)
        );

        this.cameraPosition.lerp(this.idealCameraPosition, LERP_ALPHA);

        this.cameraTarget.lerp(this.idealCameraTarget, LERP_ALPHA);


        this.position.copy(this.idealCameraPosition);

        this.updateMatrix();

        if (!Players.main.visible) {

            this.rotation.y = MathUtils.degToRad(this.theta);

            this.rotation.x = -MathUtils.degToRad(this.phi);
        } else {

            this.lookAt(this.idealCameraTarget); // this.cameraTarget for lerp vals
        }

        this.fitNearToWalls()
    }

    // The collision above only looks straight behind the player, so a wall
    // alongside the view, or a wall corner next to the camera, can still cut
    // through the near plane's sides. Check the segment from the avatar's
    // head (always on the open side of the wall) to each near plane corner and
    // pull the near plane in until none of them crosses a wall.
    fitNearToWalls() {

        const world = Camera.currentControls?.world

        const baseNear = this.baseNear ?? this.near

        let near = baseNear

        if (world) {

            const halfH = Math.tan(this.getEffectiveFOV() * MathUtils.DEG2RAD * 0.5)

            const halfW = halfH * this.aspect

            nearFwd.set(0, 0, -1).applyQuaternion(this.quaternion)

            nearRight.set(1, 0, 0).applyQuaternion(this.quaternion)

            nearUp.set(0, 1, 0).applyQuaternion(this.quaternion)

            for (let step = 0; step < 6 && near > MIN_FIT_NEAR; step++) {

                if (this.nearCornersClear(world, near, halfW, halfH)) break

                near = Math.max(MIN_FIT_NEAR, near * 0.5)
            }
        }

        if (Math.abs(near - this.near) > 1e-4) {

            this.near = near

            this.updateProjectionMatrix()
        }
    }

    nearCornersClear(world, near, halfW, halfH) {

        const head = this.idealCameraTarget

        for (let i = 0; i < 4; i++) {

            const sx = i & 1 ? 1 : -1

            const sy = i & 2 ? 1 : -1

            nearCorner.copy(nearFwd)
                .addScaledVector(nearRight, sx * halfW)
                .addScaledVector(nearUp, sy * halfH)
                .multiplyScalar(near)
                .add(this.position)
                .sub(head)

            const length = nearCorner.length()

            if (length < 1e-6) continue

            nearRay.set(head, nearCorner.divideScalar(length))

            const hit = world.rayIntersect(nearRay)

            if (hit && hit.distance < length) return false
        }

        return true
    }

	activate(){

		this.active = true

	}

	desactivate(){

		this.active = false
	}
}

export default new PlayerCamera(FOV, 1, NEAR, FAR )

