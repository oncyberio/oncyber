import {

    APP_STATES,
    CINEMATIC,
    CURRENT_SPACE,
    DEBUG_AUDIO,
    DEF_VOICE_RANGE,
    EDIT_MODE,
    IS_MULTIPLAYER,
    IS_VR,
    USER_HEIGHT,
    VOICE_ROLLOFF_FACTOR,

    FAKE_PLAYERS,


    SET_FAKE_DATA,

    IS_FIRST_PERSON
} from '@3constants'


import {

	Mesh,

	Vector3,

	Object3D,

	Box3,

	Group
}

from "three";

import {

    UPDATE_AVATAR,

    UPDATE_CHAT,

    UPDATE_USERNAME,

    STATES,

    DISPLACE,

    ANIM_DURATION,

    ANIM_EASE,

    UPDATE_VRM

} from "./constants";

import {

	AVATAR_MODES,

	CURRENT_AVATAR_MODE,

	ERROR_CODES,

	LOD_MESHES_MAX

} from '@3constants'

import PreviewBaker from '@3utils/previewbaker.js'


import { disposeObject3D, setOpacity } from "../../utils/three";

import { ChatBubble } from "./chatbubble/index";

import gsap from 'gsap'

import Emitter from "@3emitter";

import Events from "@3events";


import Socket from "../../events/socket";

import BASE_GEOMETRY from './capsulegeo.js'

import Players from '@3factory/player'

import InstanceAvatar3D from './instanceavatarvrm'


import root from '../../root';
import { getEmoteShortcutIndex } from "@features/lobby/emoteShortcuts";
import { getCurrentSpaceVoiceRange } from '../../utils/spaceutils';
import { PseudoAudioController } from '../artwork/controllers/pseudoaudiocontroller';
import { StreamAudioPlayer } from '../artwork/controllers/players';


import GLTF from '@3gltf'
import { LABEL_STATES } from '../../modules/label';
import Camera from '../../camera';

const tempVec3 = new Vector3()

// import KalmanFilter from 'kalmanjs';


export default class InstancePlayer extends Group {

	constructor( opts, avatar, username ) {

        super()

        this.opts = opts

        this.type = 'vrmavatar'
        // this.tweenHeadPosition = 0

        this.currentLayoutMode = CURRENT_AVATAR_MODE

        // console.log(this)

        this.currentEntity = opts.main == true;

        this.modelScale = 1;

        this.modelScaledCapsule = new Box3()


        this.timeout = null

        this.isPaused = false

        this.voiceRange = getCurrentSpaceVoiceRange()

        this.isSitting = false

        this.seatedMesh = null;

        this.initialize( opts );

        this.deactivated = false;

        if( this.userId == undefined ) {

            console.error("Instance Player: userId is undefined")
        }


		if( CINEMATIC || EDIT_MODE ) {

		    this.visible = false
		}

		if (process.env.NODE_ENV === "development") {

		    // @ts-ignore
		    window.$p = this;
		}

		this.currentState = STATES.NAME_DISPLAY



		if (opts.editMode || IS_VR) this.visible = false;

		// this.avatar = avatar;

        this.defaultAvatar = avatar.img

		// this.username =

		// console.log( this.opts )

		this.avatar3D = InstanceAvatar3D.init( opts )

		// this.avatar3D.load3D( opts )

		this.modelCapsule = new Box3();

		// this.avatar.modelCapsule = new Box3()

		this.modelCapsule.copy( BASE_GEOMETRY.boundingBox )

		this.setRadius()

		// Player model
		// this.add( this.avatar );

		// if ( opts.editMode ) {

		    // this.avatar.visible = false
		// }

		this.voiceRange = getCurrentSpaceVoiceRange()

        this.tempRotation = 0

		this.username = username

        this.avatarImg = null


		this.player = this;

		this.updateEvent 	 = this.updateAvatar.bind(this)

		Emitter.on(Events.POST_UPDATE, this.updateEvent)

		this.setLayout( CURRENT_AVATAR_MODE )

	}

	// async load3D(opts){



	// }

    initializeMultiplayer = ( opts ) => {

        this.userId = opts.userId || opts.user?.id;

        this.sessionId = opts.sessionId;
    }

    initialize = ( opts ) => {

        if( opts.position ) {

        	this.position.copy( opts.position )
        }

        if( opts.rotation ) {

        	this.rotation.y = opts.rotation
        }

        this.userId = opts.userId || opts.user?.id;

        this.currentSpace = opts.exhibit?.id;

        this.userData = {

            avatar: opts.userData?.avatar,

            username: opts.userData?.username,

            walletId: opts.userData?.walletId,

            isAdmin: opts.userData?.isAdmin,

            animation : -1,

            VRM: opts.userData?.VRM
        };

        this.roomParameters = {

            user_height: USER_HEIGHT,

            speed: opts.roomParameters.playerSpeed,

            jump: opts.roomParameters.jump
        }

        this.isDummy = opts.isDummy || false;

        this.animation = opts.animation;

        this.flyMode  = false

		this.sessionId = "";

		this.payload = {

		    rotation: {

		        x: Number(this.rotation.x.toFixed(2)),

		        y: Number(this.rotation.y.toFixed(2)),

		        z: Number(this.rotation.z.toFixed(2))
		    },

		    position: {

		        x: Number(this.position.x.toFixed(2)),

		        y: Number(this.position.y.toFixed(2)),

		        z: Number(this.position.z.toFixed(2))
		    },

		    sessionId: "",

		    scale: {

		        x: Number(this.scale.x.toFixed(2)),

		        y: Number(this.scale.y.toFixed(2)),

		        z: Number(this.scale.z.toFixed(2))
		    },

		    space: "",

		    userId: this.userId,

		    userData: this.userData,

		    roomParameters: this.roomParameters,

		    isPaused: false,

            animation: -1,

            tempRotation: 0,

            isDummy: this.isDummy
		}

        this.currentSpace = opts.exhibit?.id;

        this.roomParameters = {

            user_height: USER_HEIGHT,

            speed: opts.roomParameters.playerSpeed,

            jump: opts.roomParameters.jump
        }

        this.userId = opts.user?.id;

        if (opts.sessionId) {

		    this.sessionId = opts.sessionId;
		}
    }

	init(){
        this.addEvents()
	}

    initMultiplayer () {

        if (IS_MULTIPLAYER && this.currentEntity) {

			const pl = this.getPacketPayload(true)

		    Socket.emit(Events.SEND_PACKET, {
		        code: "init",
		        payload: pl
		    })

		    if( FAKE_PLAYERS == true && this.fakeData == null ) {

		        this.fakeData = JSON.parse( JSON.stringify( this.getPayload() )  )

		        const packets = []
		        let i = 0



		        const range = 40

	        	const row = 30

	        	const height = 30

		        // const max = Math.min( row * height, MAX_INSTANCES - 5 )
		        const max = 20


	        	// const maxRange =

	        	const decalX = 1.5

	        	const maxRange = row * decalX

	        	const ratio = 1 / row

		        while(i < max) {


		        	const dat = JSON.parse( JSON.stringify( this.fakeData )  )
		        	const rd = Math.random() + "FEFE"


		        	const x = i % row ;
		        	const y = (i / row)%height;

		        	const res = {

		        		animation: 6,
		        		avatar : dat.userData.avatar,
		        		isAdmin: false,
		        		paused: false,
		        		positionX: x * decalX - maxRange * 0.5 + (Math.random() * 0.5 - Math.random() * 0.5),
		        		positionY: 0,
		        		positionZ:  y - 50 + Math.floor(Math.sin(Math.PI * ratio * i) * 5) + 3,
		        		rotation: Math.PI,
		        		scale: 1,
		        		floor: true,
		        		sessionId: rd,
		        		space: dat.space,
		        		userId: rd,
		        		user_height: 2.4,
		        		username: rd
		        	}


		        	packets.push(res)

		        	i++
		        }

		        const dat = JSON.parse( JSON.stringify( this.fakeData )  )
		        const rd = Math.random() + "FEFE"

		        const res = {

		        	animation: Math.floor(Math.random() * 5),
		        	avatar : dat.userData.avatar,
		        	isAdmin: false,
		        	paused: false,
		        	positionX: 0,
		        	positionY: 0,
		        	positionZ:  -7 + 3,
		        	rotation: Math.PI,
		        	scale: 1,
		        	floor: true,
		        	sessionId: rd,
		        	space: dat.space,
		        	userId: rd,
		        	user_height: 2.4,
		        	username: rd
		        }


		        packets.push(res)

		        console.log( packets )

		        SET_FAKE_DATA( packets )

		    }
		}
    }

	hide() {

	    if(!this.visible) return

	    this.visible = false

		// this.avatar.wrapper.visible = false
		this.avatar3D.visible = false
		this.username.wrapper.visible = false

        this.voice?.disable()
	}


	show() {


	    if(this.visible) return

	    this.visible = true

		// this.avatar.wrapper.visible = true
		this.username.wrapper.visible = true
		this.avatar3D.visible = true

		// console.log('show')

        this.voice?.enable()
	}

    handleSit = (val) => {

        this.isSitting = val;

        this.avatar3D.isSitting = val;
    }

    sit = ({ mesh }) => {
        if (this.isSitting) return;

        if (this.flyMode) return;

        this.seatedMesh = mesh;

        this.handleSit( true );

        this.updateSitPosition();

        const normal = new Vector3();

        mesh.getWorldDirection(normal);

        const rotY = Math.atan2(normal.x, normal.z);

        this.rotation.set(0, rotY + Math.PI, 0)

        this.playEmote(12);

        root.billboardLabel.hide();
    }

    updateSitPosition = () => {
        if (!this.isSitting) return;


        if (!this.seatedMesh) return;

        const sitBoxHeight = .5;

        const indent = .1;

        const yPos = (this.seatedMesh.position.y + sitBoxHeight + indent) - (this.avatar3D.hipPosition.y || this.avatar3D.spinePosition.y);

        this.position.set(this.seatedMesh.position.x, yPos, this.seatedMesh.position.z);

        Camera.currentControls.world.firstPersonPos.set(
            this.seatedMesh.position.x,
            yPos + this.avatar3D.headPosition.y,
            this.seatedMesh.position.z
        );

        Camera.mainCamera.position.set(
            this.seatedMesh.position.x,
            yPos + this.avatar3D.headPosition.y,
            this.seatedMesh.position.z
        );
    }

    getUp = () => {

        this.rotation.set(0, this.rotation.y, 0)

        this.seatedMesh = null;

        this.handleSit(false);
    }

	getTextPosition(){

		if( this.tweenTextPosition == null ) {

			this.tweenTextPosition = this.avatar3D.headPosition.y;
		}

		const newTextPosition = ( this.avatar3D.headPosition.y + 0.3 ) * 0.1 + this.tweenTextPosition * 0.9

		this.tweenTextPosition = newTextPosition

		return  newTextPosition
	}

    getCoords(){
        return `${this.position.x.toFixed(2)}x${ (Players.main.avatar3D.headPosition.y + this.position.y).toFixed(2)}x${this.position.z.toFixed(2)}x${this.rotation.y.toFixed(2)}}`
    }

	updateAvatar(){

		// this.avatar.wrapper.position = this.position

		// this.avatar.wrapper.rotation = this.rotation.y

		if( this.username.wrapper && this.avatar3D ) {

			this.username.wrapper.position = { x: this.position.x, y: this.position.y + this.getTextPosition(), z: this.position.z }
		}

		if( this.avatar3D ) {

			this.avatar3D.position  = this.position

			this.avatar3D.rotation = this.rotation.y
		}


	}

	addEvents() {

	    if( this.handlePauseEvent == null ) {

	        this.handlePauseEvent = this.handlePause.bind(this)

	        this.handlePlayEvent  = this.handlePlay.bind(this)

	        this.keyBoardEvent    = this.keyBoard.bind(this)

	        this.avatarModeEvent  = this.setLayout.bind(this)



	        // this.updateEvent  	  = this.update.bind(this)

	        Emitter.on(Events.PAUSE, this.handlePauseEvent)

	        Emitter.on(Events.PLAY, this.handlePlayEvent)

	        Emitter.on(Events.KEY_DOWN, this.keyBoardEvent)

	        Emitter.on(Events.AVATAR_MODE, this.avatarModeEvent)



	    }


	}

	removeEvents() {

	    if( this.handlePauseEvent ) {

	        Emitter.off(Events.PAUSE, this.handlePauseEvent)

	        Emitter.off(Events.PLAY, this.handlePlayEvent)

	        Emitter.off(Events.KEY_DOWN, this.keyBoardEvent)

	        Emitter.off(Events.AVATAR_MODE, this.avatarModeEvent)




	        this.handlePauseEvent = null

	        this.handlePlayEvent  = null

	        this.keyBoardEvent    = null

	        this.avatarModeEvent = null



	    }

	}

	keyBoard(e){

        if (
            e.defaultPrevented || e.isComposing || e.repeat || e.altKey ||
            e.target?.closest?.(
                "input, textarea, select, button, a, [contenteditable]:not([contenteditable=false]), [role=dialog], [role=menu], [role=textbox]"
            )
        ) return;

        if (e.code === "KeyI" && this.deactivated) {

            this.deactivated = false

            this.getUp();

            return;
        }

        if (this.deactivated) {
            return;
        }

        if(root.currentPortals?.currentPortal?.isElevator) {
            return;
        }

		if(/^Digit[0-9]$/.test(e?.code) ){

			let code = parseInt(e.code.replace('Digit', ''))

			if (e.ctrlKey || e.metaKey) {
				if (code > 3) {
					return;
				}
				code += 9;
			}

            const index = e.ctrlKey || e.metaKey || code === 0
                ? code - 1
                : getEmoteShortcutIndex(code - 1);

            this.playEmote(index)
		}

        if (e.code === "KeyL" ) {

            this.playEmote( 13 )
        }

	}

	getHeadPosition(){

		const displace = 0.4

		if( this.tweenHeadPosition == null ) {

			this.tweenHeadPosition = this.avatar3D.headPosition.y + displace;

		}

		const newHeadPosition = ( this.avatar3D.headPosition.y + displace ) * 0.1 + this.tweenHeadPosition * 0.9

		this.tweenHeadPosition = newHeadPosition

		return  newHeadPosition
	}


	handlePause(){

	    if (IS_MULTIPLAYER && this.currentEntity) {
	        Socket.emit(Events.SEND_PACKET, {
	            code: "pause",
	            payload: true
	        })
	    }


	    this.payload.isPaused = true;

	}

	handlePlay(){

	    if (IS_MULTIPLAYER && this.currentEntity) {
	        Socket.emit(Events.SEND_PACKET, {
	            code: "pause",
	            payload: false
	        })
	    }

	    this.payload.isPaused = false;
	}

	getWorldCenterPoint() {

	    tempVec3.set(0,0,0)

	    this.localToWorld(tempVec3);

	    return tempVec3;
	}

	setRadius() {

	    this.modelScaledCapsule.copy(this.modelCapsule);

	    this.modelScaledCapsule.min.multiplyScalar(this.modelScale);

	    this.modelScaledCapsule.max.multiplyScalar(this.modelScale);

	    const radiusZ =
	        Math.abs(
	            this.modelScaledCapsule.max.z - this.modelScaledCapsule.min.z
	        ) / 2;

	    const radiusX =
	        Math.abs(
	            this.modelScaledCapsule.max.x - this.modelScaledCapsule.min.x
	        ) / 2;

	    this.radius = radiusX > radiusZ ? radiusX : radiusZ

	}

	changeVRM = async ( VRM, opts = {}  ) => {

		return new Promise( async ( resolve , reject ) =>{

			try{

				// erase previous demo model if same name
				if( opts.demo == true ) {

					GLTF.reset( VRM )
				}

				if( GLTF[ VRM ] == null ) {

					let loadOptions = {
						name: VRM,
						url : VRM,
						optimised : {},
						thumbnail : true
					}

					// demo only

					if( opts.demo == true ) {

						loadOptions.force = true

						const { default: Optimiser } = await import('@3modules/optimiser')
						loadOptions.optimised = await Optimiser.optimiseVRM( VRM )

						loadOptions.url = loadOptions.optimised.url
					}


					await GLTF.loadOnce(loadOptions)

					if (opts.demo == true ) {

						if( this.previewBaker == null )  {

							this.previewBaker = new PreviewBaker()
						}


						if( GLTF[ VRM ].datas != null ) {

							if( GLTF[ VRM ].datas.validCount == false ) {

								reject({
									code: ERROR_CODES.VRM_MESHES_OVERCOUNT_ERROR,
									count: GLTF[ VRM ].datas.count
								})

								return;
							}

							// console.log( GLTF[ VRM ].datas )
							// console.log( GLTF[ VRM ].datas )
							// console.log( GLTF[ VRM ].datas )
							// console.log( GLTF[ VRM ].datas )
							// console.log( GLTF[ VRM ].datas )
							// console.log( GLTF[ VRM ].datas.count )

							// if( GLTF[ VRM ].datas.)

							GLTF[ VRM ].datas.optimised = loadOptions.optimised

							GLTF[ VRM ].datas.thumbnail = GLTF[ VRM ].thumbnail

						}

						else {

							reject({code: ERROR_CODES.INVALID_VRM_FILE})

							return;
						}
					}
				}


				const vOpts = {

					userData: {

						VRM : VRM
					}
				}

				if ( GLTF[vOpts.userData.VRM].isHighQuality ) {

					const meshes = await GLTF.requestPool( vOpts.userData.VRM )

					if( meshes == null ) {

						// The pool had no meshes; the lines below will throw.
					}

				    vOpts.userData.VRMMeshes = meshes

				    vOpts.userData.VRMMeshes.scene.poolUsed = true
				}


				const meshes =  InstanceAvatar3D.getMesh( vOpts )

				this.avatar3D.updateVRM( meshes )

				this.userData.VRM = VRM

                this.payload.userData.VRM = VRM

                if (this.isSitting && this.seatedMesh) {

                    this.sit({
                        mesh: this.seatedMesh
                    })
                }

				if( opts.demo != true && IS_MULTIPLAYER ) {

					Socket.emit(Events.SEND_PACKET, {
					    code: "VRM",
					    payload: VRM
					})
				}


				resolve(GLTF[vOpts.userData.VRM].datas)


			}

			catch(e){

				// console.log( e )

				reject({ code: ERROR_CODES.VRM_GENERAL_ERROR })
			}

		})
	}

	scaleVRM( value ){

		// return new Promise( async ( resolve , reject ) => {

		this.modelScale = value

		this.avatar3D.setScale( value )

			// resolve()
		// })
	}

	 getVRMScale() {

	 	return this.avatar3D.absoluteRatio
    }

	setState = (STATE, opts) => {

	    return new Promise((resolve) => {

	        switch (STATE) {

	            case APP_STATES.TELEPORT:

	                this.setVoiceRange(
	                    opts.exhibit?.options?.voice_range || DEF_VOICE_RANGE
	                )

	                this.currentSpace = opts.exhibit.id;

	                if (IS_MULTIPLAYER && this.currentEntity) {

	                    Socket.emit(Events.SEND_PACKET, {
	                        code: "space",
	                        payload: [this.currentSpace, USER_HEIGHT, this.scale.x]
	                    })
	                }

	                break
	        }

	        resolve()
	    })
	}

	getPacketPayload = (fullPayload = false) => {

	    const payload = this.getPayload();

	    if (fullPayload) {

	        return [
	            payload.position.x,
	            payload.position.y,
	            payload.position.z,
	            payload.rotation.y,
	            payload.scale,
	            payload.space,
	            payload.userId,
	            payload.userData.avatar,
	            payload.userData.username,
	            USER_HEIGHT,
	            false,
                payload.animation,
                payload.floor,
                payload.userData.VRM
	        ]
	    }


        return [
	        payload.position.x,
	        payload.position.y,
	        payload.position.z,
	        payload.rotation.y,
	        payload.animation,
	        payload.floor
	    ]
	}

	getPayload = () => {

	    this.payload.rotation = {

	        x: Number(this.rotation.x.toFixed(2)),

	        y: Number(this.rotation.y.toFixed(2)),

	        z: Number(this.rotation.z.toFixed(2))
	    };

	    this.payload.position = {

	        x: Number(this.position.x.toFixed(2)),

	        y: Number(this.position.y.toFixed(2)),

	        z: Number(this.position.z.toFixed(2))
	    }

	    this.payload.space 			= this.currentSpace;

	    this.payload.scale 			= this.avatar3D ? this.avatar3D.scale : 1

	    this.payload.userId 		= this.userId;

	    this.payload.userData 		= this.userData;

	    this.payload.roomParameters = this.roomParameters;

	    this.payload.sessionId 		= this.sessionId;
	    // this.payload.message =        this.chatBubble.message;

        // this.payload.tempRotation   = Number(this.payload.rotation.y.toFixed(2));

        if( this.avatar3D ) {

        	this.payload.animation      = this.avatar3D.emote

        	this.payload.floor 		    = this.avatar3D.onFloor
        }

        else {

        	this.payload.animation      = 0

        	this.payload.floor 		    = true
        }


        // this.payload.floor 		= false

        // console.log( this.payload.floor )

        // console.log("sending",  this.isPlayerOnFloor )


	    return this.payload;
	}

	updatePlayer = async (opts) => {

	    switch(opts.type) {

	        case UPDATE_AVATAR:

	        	var url = opts.payload

	        	// var split;

	        	// try{

        	 //    	split = url.split('/')

	        	// }

	        	// catch(e){

	        	// }


        		// let i = 0

        		// var paramsIndex = -1

        		// while(i < split.length){

        		//     if( split[i] == 'upload' ){

        		//         paramsIndex = i + 1
        		//     }

        		//     i++
        		// }

        		// if( paramsIndex != -1 ) {

        		//     split[paramsIndex] = 'c_limit,fl_keep_dar,h_256,w_256,c_fit,c_fill'
        		// }

        		// url = split.join('/')

        		// url = url.replace('.svg', '.jpg')
        		// url = url.replace('.gif', '.jpg')
        		// url = url.replace('.png', '.jpg')

	        	if(this.avatar3D == null || url === this.avatar3D.url ) {

	        		return
	        	}

	            if(this.avatar3D != null ){

	            	this.userData.avatar = url;

	            	this.loading = true


	            	Players.updateAvatar( this, this.avatar3D , url ).then((img)=>{

            			this.userData.avatar = url

                        this.avatarImg = img

                        Players.updateUserName( this, this.username , this.userData.username, img )

            			if (IS_MULTIPLAYER && this.currentEntity && !opts.display) {

            			    Socket.emit(Events.SEND_PACKET, {
            			        code: "avatar",
            			        payload: url
            			    })
            			}
	            	})

	            }

	            break;

	        case UPDATE_USERNAME:

	            const name = opts.payload

	            if (opts.payload === this.username.url) return;



	            if( this.currentState == STATES.BUBBLE_DISPLAY ) {

	                this.animateBubbleIn()
	            }

	            this.userData.username = opts.payload;

            	Players.updateUserName( this, this.username , this.userData.username, this.avatarImg || this.defaultAvatar, opts.textOnly ).then(()=>{

            		this.currentState = STATES.NAME_DISPLAY

            		if (IS_MULTIPLAYER && this.currentEntity  && !opts.display) {

            		    Socket.emit(Events.SEND_PACKET, {
            		        code: "username",
            		        payload: opts.payload
            		    })
            		}
            	})

	            break;

	        case UPDATE_CHAT:

                if (!this.username.wrapper) return;
	            // this.username.visible = false

                if (!this.username.wrapper?.position?.y) return;


                if(this.chatBubble == null ) {

                	console.log('null create ')

                	this.chatBubble = new ChatBubble();

                	this.add( await this.chatBubble.get() )

                }

                console.log('set now ')

	            if( this.currentState == STATES.NAME_DISPLAY ){

	                this.animateBubbleIn()
	            }

				await this.chatBubble.set( opts.payload )

	            if (this.timeout) clearTimeout(this.timeout);

	            console.log('add timeout')

	            this.timeout = setTimeout(() => {

	                this.animateBubbleOut()

	                this.currentState = STATES.NAME_DISPLAY

	            }, 5000)

	            this.currentState = STATES.BUBBLE_DISPLAY

	            break;

	        case UPDATE_VRM :


		        const newOpts = {

		        	userData: {

		        		VRM : opts.payload
		        	}
		        }

		        if( GLTF[ opts.payload ].isHighQuality ) {

		        	if ( GLTF[opts.payload].isHighQuality ) {

		        		const mesh = GLTF.requestPoolNow( opts.payload )

		        		if( mesh == null ) {

		        			break;
		        		}

		        	    newOpts.userData.VRMMeshes = mesh

		        	    newOpts.userData.VRMMeshes.scene.poolUsed = true
		        	}
		        }



	        	const meshes =  InstanceAvatar3D.getMesh( newOpts )

	        	this.avatar3D.originalVRMName = opts.payload

	        	this.avatar3D.updateVRM( meshes )

	        	this.userData.VRM = opts.payload

	        	break;

	        default:

	            throw new Error("This type is invalid.")
	    }
	}

	animateBubbleIn(){

		if(this.username.wrapper == null || this.chatBubble == null || this.chatBubble.instance == null ) {

			return
		}

	    this.chatBubble.instance.visible = true;

	    this.chatBubble.instance.position.y = this.getTextPosition() - DISPLACE

	    this.tween = gsap.timeline()

	    this.tween.add( [

	        gsap.to(this.username.wrapper.position, {
                // sometimes position.y is undefined
	            y: this.username.wrapper.position.y + DISPLACE,

	            duration : ANIM_DURATION,

	            ease: ANIM_EASE,

	            onComplete:()=>{

	                this.username.visible = false
	            }
	        }),

	        gsap.to(this.chatBubble.instance.position, {

	            y: this.getTextPosition(),

	            ease: ANIM_EASE,

	            duration : ANIM_DURATION

	        }),


	        gsap.to(this.username.wrapper, {

	            opacity: 0,

	            ease: ANIM_EASE,

	            duration : ANIM_DURATION

	        }),

	        gsap.to(this.chatBubble, {

	            opacity: 1,

	            ease: ANIM_EASE,

	            duration : ANIM_DURATION

	        })


	    ] )
	}

	animateBubbleOut(){

		if(this.username.wrapper == null || this.chatBubble == null || this.chatBubble.instance == null ) {

			return
		}

	    this.username.wrapper.visible = true;

	    this.username.wrapper.position.y = this.getTextPosition() - DISPLACE

	    this.tween = gsap.timeline()

	    this.tween.add([

	       gsap.to(this.chatBubble.instance.position, {

	            y: this.chatBubble.instance.position.y + DISPLACE,

	            duration : ANIM_DURATION,

	            ease: ANIM_EASE,

	            onComplete:()=>{

	                this.chatBubble.instance.visible = false
	            }
	        }),

	       gsap.to(this.username.wrapper.position, {

	           y: this.getTextPosition(),

	           duration : ANIM_DURATION,

	           ease: ANIM_EASE,
	       }),

	       gsap.to(this.username.wrapper, {

	           opacity: 1,

	           ease: ANIM_EASE,

	           duration : ANIM_DURATION

	       }),

	       gsap.to(this.chatBubble, {

	           opacity: 0,

	           ease: ANIM_EASE,

	           duration : ANIM_DURATION

	       })

	    ])
	}

	playEmote( opts ){

		// Network updates may arrive after the avatar has been disposed.
        if (this.wasDisposed || !this.avatar3D) return;
        return this.avatar3D.playEmote( opts )
	}


	setOpacity(opacity) {

		// if( this.avatar.wrapper ) {

	 //    	this.avatar.wrapper.opacity = opacity

		// }

		if( this.avatar3D != null ) {

			this.avatar3D.opacity = opacity
		}

	}

	setLayout(){

		// this.username.setLayout()
	}

	update( deltaTime, elapsedTime, playerState, flyMode )

	{
	    if (!this.player) return;

        this.flyMode = flyMode

	    this.isPlayerOnFloor = playerState.playerOnFloor;

	    this.isJumping = playerState.isJumping;

        // Send the same physical intent that the lobby gives its motion clock.
        // Inferring jumps from rendered position loses launches and confuses
        // collision corrections with a second jump.
        const motion = this.avatar3D.nativeMotionInput ||= {};
        motion.grounded = playerState.playerOnFloor;
        motion.jumpCount = playerState.jumpCount;
        motion.verticalVelocity = playerState.veclocity.y;
        motion.speed = Math.hypot(playerState.veclocity.x, playerState.veclocity.z);
        motion.stopping = playerState.originalDirection.lengthSq() === 0 &&
            playerState.joystickState.pan.lengthSq() === 0;
        motion.flying = flyMode || playerState.quidditch || playerState.opts.editMode;
        motion.headingError = Math.atan2(
            Math.sin(playerState.tempRotation - playerState.rotation.y),
            Math.cos(playerState.tempRotation - playerState.rotation.y)
        );


	    // console.log( this.isPlayerOnFloor )

	    // set jumping first

	    this.avatar3D.setPlayerIsJumping( this.isJumping )

	    this.avatar3D.setPlayerOnFloor( this.isPlayerOnFloor )


	    // We check if the player is moving
	    this.isMoving = playerState.direction.length() !== 0;

	    // We update the rotation of the player based direction + camera
		if (!flyMode) {

            this.rotation.y = playerState.rotation.y;
   		}

	    if(DEBUG_AUDIO && this.volumeRange) {

	        this.updateVolumeRange()
	    }

	    // We animate
	    // this.avatar.material.uniforms.uTime.value = elapsedTime;
	};

	/**
     *
     * @param {MediaStream} stream
     */
    enableVoice(stream) {

        // handleEnableVoice sweeps every known stream; re-attaching the one
        // already playing would pause/replay it audibly
        if (this.voice != null && this.stream === stream) return

        if(this.voice == null) {

            this.stream = stream

            this.voice = new PseudoAudioController({
                mesh: this,
                audioPlayer: new StreamAudioPlayer(stream),
                volume: this.voiceRange,
                rolloffFactor: VOICE_ROLLOFF_FACTOR
            })

            this.voice.enable()
            //
        } else {

            console.log("Update voice stream", stream)

            this.stream = stream

            this.voice.disable()

            this.voice.audio.setStream(stream)

            this.voice.enable()
        }
    }

	/**
	 *
	 * @param { number } [range] : ;
	 */
	setVoiceRange(range) {

	    if(range == null) {

	        range = getCurrentSpaceVoiceRange()
	    }

	    if(range === this.voiceRange) return

	    this.voiceRange = range

	    // this.voice.setVolume(this.voiceRange)
	}

	setSpeak = (val) => {

		// this.avatar.wrapper.speaking = val

        if (this.isSitting) {

            if (val === 0 ) {

                this.playEmote( 12 );
            } else {

                this.playEmote( 14 );
            }

        }
	}

	disableVoice() {

	    if(this.voice != null) {

	        this.voice.dispose()

            if (this.avatar?.wrapper) {

                this.avatar.wrapper.speaking = 0
            }

	        this.voice = null
	    }
	}


	dispose = (hardDispose = true) => {
        if (this.wasDisposed) return;
        this.wasDisposed = true;

        this.disableVoice()

        if (this.timeout) clearTimeout(this.timeout);

        if( this.chatBubble ) {

        	console.log(' dispose bubble ')

        	this.remove( this.chatBubble.instance )

        	this.chatBubble.dispose()

        	this.chatBubble = null
        }

        // console.log(this.avatar)

		Players.dispose(this.block)

		Players.disposeUserName(this.username)

		InstanceAvatar3D.dispose(this.avatar3D)

		this.avatar3D = null

		this.block   = null

        if (!this.isDummy) {

            this.parent?.remove(this);
        }

	    if (hardDispose) {

	        disposeObject3D(this);
	    }

	    this.removeEvents()

	    Emitter.off(Events.POST_UPDATE, this.updateEvent)

	    this.updateEvent = null
	}

}
