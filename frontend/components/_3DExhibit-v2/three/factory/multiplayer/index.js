// @ts-check

import Socket from "@3socket";

import Events from "@3events";

import Emitter from "@3emitter";

import Camera from "@3camera"

import root from "@3gl/root";

import Players from "@3factory/player"

import InstancePlayer from "@3factory/player/instance"

import {

    Group,

    MathUtils,

    Vector3,

    Ray,

    Euler,

    Quaternion,

} from "three";

import shortid from "shortid";

import { PatchClock } from "@features/lobby/patchClock";

import { readRecordingParty, recordingPartyPlayers, recordingPartyLinePlace, recordingPartyLanding } from "./recordingParty";

import { disposeObject3D } from "@3utils/three";

import { IS_MOBILE,

   STATIC_CAMERA,

   MAX_INSTANCES,

   DEBUG,

   APP_STATES,

   CURRENT_SPACE,

   DEFAULT_PLAYER_AVATAR_PICTURE,

   FAKE_PLAYERS,

   FAKE_DATA,

   DEBUG_MULTIPLAYER,

   INTERPOLATE,

   DEFAULT_VRM, SET_MULTIPLAYER_INIT,

   LOD_VRM,

   LOD_VRM_DISTANCE,

   QUALITY,


   QUALITIES,

   MID_LOD_VRM

} from "@3constants";

import  { UPDATE_AVATAR, UPDATE_CHAT, UPDATE_USERNAME, UPDATE_VRM } from "@3factory/player/constants"

import { CAMMAND_ERRORS, GET_USER_INFO, TELEPORT_TO_USER, SUMMON_TO_USER, DEFAULT_SUMMON_RADIUS, GOTO, UPDATE_CHAT_BUBBLE, NO_USER_ERROR, GET_USERS_INFO, DEBUG_AUDIO, SET_VOICE_RANGE, DISABLE_VOICE, SET_MEDIA_TIME, ADMIN_SYNC_MEDIA_TIME } from "./constants";

import { idToCoords, matchArtworkByName, get2Distance, getCurrentSpaceVoiceRange } from "@3utils/spaceutils";

import { parseLocation } from "@utils/js";

import GLTF from '@3gltf'

import gui from '@3gui'

let prevPacket = null;

const tmpEuler = new Euler(0,0,0, "YXZ")

const tmpPosition = new Vector3()

var mod = 0

var frames = 0

const LOADING = 'loading'

// Mic proximity gate: stop uploading mic audio to peers further than
// GATE_ON x voiceRange, resume inside GATE_OFF x voiceRange (hysteresis
// so people hovering at the boundary don't cause churn).
const VOICE_GATE_ON = 2.5

const VOICE_GATE_OFF = 2.0

const VOICE_GATE_TICK = 1000

import VRMS from '../player/vrms.json'

let h = 0

const vrms =[]

let i = 0

for (const property in VRMS) {

  i++

  // if( i < 40 ) {

    vrms.push( VRMS[property].url )

  // }
}


class Multiplayer extends Group {

    constructor(opts) {

        super()

        /**
         * @type { Record<string, InstancePlayer> }
         */
        this.players = {};

        this.packets = [];

        // Room patches carry no time; stamp them on the room's tick grid.
        this.patchClock = new PatchClock();

        this.delta = 0;

        // The room relays positions on its own 5Hz tick. Sending on a 5Hz
        // timer too meant some ticks carried no new position and the next
        // carried two steps' worth, so other players' walks pulsed. 30Hz
        // keeps every tick's position fresh.
        this.interval = 1 / 30;

        this.prevTimestamp = 0;

        this.roundTrip = 0;

        this.packet = null

        this.playerNextPositions = {};

        this.lerpVal = 0;

        this.fixedInterval = 1 / 60;

        this.interDelta = 0;

        this.rotateAngle = new Vector3(0, 1, 0)

        this.rotateQuarternion = new Quaternion()

        this.tempRotation = new Euler();

        this.tempQuaternion = new Quaternion();

        this.check = {}

        this.gateStates = {}

        this.gateTimer = null

        this.prevPast = 0;

        window.muteLocalPlayer = this.muteLocalPlayer;

        // this.initFakePackets = false

        // window.players = this.players

        if (process.env.NODE_ENV === "development") {

            // @ts-ignore
            window.$mp = this;
        }
    }

    muteLocalPlayer = (userId, isMute = true) => {

        const player = Object.values(this.players).find(player => {

            return player.userId === userId || player.userData?.username === userId

        })

        if ( player && player.voice ) {

            if ( isMute ) {

                player.voice.disable();
            } else {

                player.voice.enable();
            }
        }
    }

    get(opts) {

        // Mock.init();

        // Mock.addEvents()

        /** @type { import("@components/_3DExhibit-v2/context/MultiplayerProvider").MultiplayerService } */
        this.MultiplayerService = opts.MultiplayerService;


        /** @type { import("@utils/voiceChat/AgoraVoiceChatProvider").AgoraVoiceChatProvider } */
        this.voiceService = this.MultiplayerService.roomService.voiceChat

        return this;
    }

    init() {



        this.players[Players.main.sessionId] = Players.main;

        this.gateStates = {};

        this.recordingParty = readRecordingParty();

        // The trip back asks the friends to line up (lobbyWorldDeparture.ts).
        if (this.recordingParty) /** @type {any} */ (window).__oncyberRecordingLineUp = (yaw, snap) => this.lineUpRecordingParty(yaw, snap)

        this.addEvents();

        if( DEBUG_MULTIPLAYER ) {


           this.fakePlayers = {

               packet: {

                   players: []
               }
           }

           if( DEBUG ) {

               let opts = {

                   add1: ()=>{

                       this.initFakePlayers( )
                   },

                   add20: ()=>{

                       this.initFakePlayers( 20 )
                   },
                   add50: ()=>{


                       this.initFakePlayers( 50 )
                   },

                   remove1:()=>{

                       this.removeFakePlayers( 1 )
                   },

                   remove20:()=>{

                       this.removeFakePlayers( 20 )
                   },


                   remove50:()=>{

                       this.removeFakePlayers( 50 )
                   },

                   changeAll:()=>{

                       let i = 0

                       const images = require('./fakeimages.json')


                       while(i < this.fakePlayers.packet.players.length ) {

                           const fp = this.fakePlayers.packet.players[i]


                           const index = Math.floor(Math.random() * (images.data.length - 1))

                           setTimeout(()=>{

                              fp.avatar = images.data[ index ]

                              fp.VRM = vrms[ Math.floor( Math.random() * vrms.length ) ]

                           }, Math.random()* i * 2)


                           i++
                       }

                       opts.changeMain()

                   },

                   changeMain:()=>{

                       const images = require('./fakeimages.json')

                       const index = Math.floor(Math.random() * (images.data.length - 1))

                       Players.main.updatePlayer({
                           type: UPDATE_AVATAR,
                           payload: images.data[
                               index
                           ]
                       })
                   },

                   changeAnim:()=>{

                    let i = 0

                    const images = require('./fakeimages.json')


                    while(i < this.fakePlayers.packet.players.length ) {

                        const fp = this.fakePlayers.packet.players[i]

                        fp.animation = Math.floor( Math.random() * 9)

                        i++
                    }

                   }
               }

               gui.folders.multiplayer.add(opts, 'add1')
               gui.folders.multiplayer.add(opts, 'add20')
               gui.folders.multiplayer.add(opts, 'add50')


               gui.folders.multiplayer.add(opts, 'remove1')
               gui.folders.multiplayer.add(opts, 'remove20')
               gui.folders.multiplayer.add(opts, 'remove50')
               gui.folders.multiplayer.add(opts, 'changeMain')
               gui.folders.multiplayer.add(opts, 'changeAll')
               gui.folders.multiplayer.add(opts, 'changeAnim')

           }

       }

       SET_MULTIPLAYER_INIT( true )

    }

    initFakePlayers( nb = 1){

        var pos = Players.main?.avatar3D?.position

        if( pos ) {

          const sample = require('./fakedata.json')

          const images = require('./fakeimages.json')

          const fakePackets = []

          let i = 0



          while( i < nb ) {

              if(  this.fakePlayers.packet.players.length > MAX_INSTANCES - 3 ) {

                  return
              }

              const data = JSON.parse( JSON.stringify( sample ) )

              // data.avatar = images.data[this.fakePlayers.packet.players.length]
              data.avatar = images.data[ Math.floor( Math.random() * images.data.length ) ]
              data.rotation = Math.random() * Math.PI * 2.0
              data.username = data.userId = 'fake' + Math.random().toFixed(8)
              data.sessionId = data.username

              // if(Math.random() > 0.1) {
              data.animation = Math.floor( Math.random() * 9)
              // }

              // Players.main?.avatar3D?.position

              // console.log(pos)

              data.scale = Math.random() * Math.random()

              data.positionX =  Math.random() * 20 - Math.random()* 20 + pos.x
              data.positionY =  pos.y
              data.positionZ =  Math.random() * 20 - Math.random()* 20 + pos.z

              data.isPaused = false

              data.scale = Math.random()

              data.space = Players.main.currentSpace


              data.VRM = vrms[ Math.floor( Math.random() * vrms.length ) ]

              this.fakePlayers.packet.players.push( data )

              i++
          }

        }


        // this.handlePacket(this.fakePlayers)

        console.log( 'user nb : ', this.fakePlayers.packet.players.length )

    }

    removeFakePlayers( nb = 1 ) {


       let i = 0

       while(i < nb) {

           if( this.fakePlayers.packet.players.length == 0 ) {

               return
           }

           const index = Math.floor(Math.random() * this.fakePlayers.packet.players.length)

           const fakePlayer = this.fakePlayers.packet.players[ index ]

           this.fakePlayers.packet.players.splice(index, 1);

           // this.handlePlayerLeave( fakePlayer )

           // if (opts.userId && this.players[opts.userId]) {

           if(  this.players[fakePlayer.sessionId] != null ) {

               Players.dispose( this.players[fakePlayer.sessionId].block )

               this.players[fakePlayer.sessionId].dispose();

           }


           i++
       }

       // console.log( 'user nb : ', this.fakePlayers.packet.players.length )

   }

    setState = (STATE, opts) => {

        return new Promise((resolve) => {

            switch (STATE) {

                case APP_STATES.SPACE:

                    this.updateVoiceRange()

                case APP_STATES.TELEPORT:

                    Object.values(this.players).forEach(player => {

                        if (player.sessionId !== Players.main.sessionId) {
                            if (player.currentSpace !== Players.main.currentSpace) {

                                player.hide();
                            }
                            else {

                                if (!player.isDummy) {

                                    player.show();
                                }
                            }
                        }

                    })

                    this.updateVoiceRange()

                    break
            }

            resolve();
        })
    }

    handleCommand(type, payload) {

        let player;

        switch(type) {

            case GOTO:

                const { locationId } = payload

                const location = parseLocation(locationId);

                if(location != null) {

                    const { position, _y } = location

                    tmpPosition.set(position.x, position.y, position.z)

                    tmpEuler.set(0, _y, 0)

                    Camera.goto(tmpPosition, tmpEuler)
                }
                else {

                    const artwork = root.currentArtworks.findArtwork(it => matchArtworkByName(it, locationId))

                    if(artwork != null) {

                        Camera.gotoTarget(artwork)
                    }
                    else {

                        const artworks = Object.values(CURRENT_SPACE.exhibit || {})

                        const item = artworks.find(it => matchArtworkByName(it, locationId))

                        if(item != null) {

                            const coords = idToCoords(item.data.id)

                            Camera.goto(coords.position, coords.rotation)

                        } else {

                            return {

                                type: CAMMAND_ERRORS.USER_NOT_FOUND,

                                success: false,

                                message: "Invalid location"
                            };
                        }
                    }
                }

                return { sucess: true };

            case TELEPORT_TO_USER:

                player = Object.values(this.players).find(player => {

                    return player.sessionId=== payload.sessionId
                })


                if (!player) return NO_USER_ERROR;

                if (player.currentSpace !== Players.main.currentSpace)  {

                    root.summonPortal({
                        exhibitId: player.currentSpace,
                        coords: player.getCoords(),
                        source: "teleport"
                    })

                    // {
                    //     type: CAMMAND_ERRORS.NOT_SAME_SPACE,

                    //     success: false,

                    //     message: `You need to be in the same space as ${ payload.username }`
                    // }

                    return { success: true, summon: true, message: "You have successfully opened a portal." };
                }

                // clone: Camera.teleportTo mutates its argument (y += 0.35),
                // which would corrupt the tracked remote position.
                Camera.teleportTo(player.position.clone())

                return { success: true, message: "You have successfully teleported." };

            case SUMMON_TO_USER: {

                // Teleport the LOCAL player near payload.sessionId (a mod's
                // "teleport all" broadcast — each client runs this locally).
                //
                // payload: {
                //   sessionId,          target user
                //   radius?,            summon radius (world units)
                //   checkOnly?          only report withinRadius, don't move
                // }

                const target = Object.values(this.players).find(player => {
                    return player.sessionId === payload.sessionId
                })

                if (!target) return NO_USER_ERROR;

                const radius = payload.radius || DEFAULT_SUMMON_RADIUS;

                if (target.currentSpace !== Players.main.currentSpace) {

                    // Different space: distance is meaningless, always summon
                    // (via portal, same as TELEPORT_TO_USER).
                    if (payload.checkOnly) {
                        return { success: true, withinRadius: false, sameSpace: false };
                    }

                    root.summonPortal({
                        exhibitId: target.currentSpace,
                        coords: target.getCoords(),
                        source: "summon"
                    })

                    return { success: true, summon: true, message: "You have successfully opened a portal." };
                }

                const distance = Players.main.position.distanceTo(target.position);

                if (payload.checkOnly) {
                    return { success: true, withinRadius: distance <= radius, sameSpace: true };
                }

                if (distance <= radius) {
                    // Already close enough — nothing to do.
                    return { success: true, withinRadius: true };
                }

                // Land on a random ring inside the radius so summoned users
                // don't stack on top of the target.
                const angle = Math.random() * Math.PI * 2;
                const ring = radius * (0.3 + Math.random() * 0.5);

                const dest = target.position.clone();
                dest.x += Math.cos(angle) * ring;
                dest.z += Math.sin(angle) * ring;

                Camera.teleportTo(dest)

                return { success: true, message: "You have successfully teleported." };
            }

            case UPDATE_CHAT_BUBBLE:

                player = Object.values(this.players).find(player => {
                    return player.sessionId === payload.sessionId
                })

                if (!player) return NO_USER_ERROR;

                player.updatePlayer({
                    type: UPDATE_CHAT,

                    payload: {
                        text: payload.text,
                        date: payload.date,
                        acc_date: payload.acc_date,
                    },
                })

                return {
                    success: true
                }

            case GET_USER_INFO:
                player = Object.values(this.players).find(player => {
                    return player.sessionId === payload.sessionId
                })

                if (!player) return NO_USER_ERROR;

                const userPayload = player.getPayload();

                return {
                    success: true,
                    userPayload
                }

            case GET_USERS_INFO:

                const players = [];

                Object.values(this.players).forEach(player => {
                    players.push(player.getPayload())
                });

                return {
                    success: true,
                    players
                }

            case DEBUG_AUDIO:


                if(payload.username) {

                    player = Object.values(this.players).find(player => {
                        return player.sessionId === payload.sessionId
                    })

                    if (!player) return NO_USER_ERROR;
                }
                else {

                    player = Players.main
                }

                // player.toggleVolumeRange()

                return {
                    success: true
                }

            case SET_VOICE_RANGE:

                this.updateVoiceRange(payload.range)

                return {
                    success: true
                }

            case DISABLE_VOICE:

                this.handleDisableVoice(payload.sessionId)

                return { success: true }

            case ADMIN_SYNC_MEDIA_TIME:

                return this.handleAdminSyncMediaTime(payload.assetId)

            case SET_MEDIA_TIME:

                return this.handleSetMediaTime(payload)


            default:
                throw new Error("No such type supported")
        }
    }

    updateVoiceRange(range) {

        Players.main.setVoiceRange(range)

        Object.values(this.players).forEach(player => {

            if (player.currentSpace === Players.main.currentSpace) {

                player.setVoiceRange(range)
            }
        })

    }

    updateVoiceGates = () => {

        if (!this.voiceService?.setMicGated || !Players.main?.position) return

        const main = Players.main

        // the sender's own range governs how far their voice carries
        const range = main.voiceRange || getCurrentSpaceVoiceRange()

        for (const sessionId in this.players) {

            const player = this.players[sessionId]

            if (player === main || player.sessionId === main.sessionId) continue

            // dummies have no real partykit peer; never gate (or ungate) them
            if (player.isDummy) continue

            let gated

            if (player.currentSpace && main.currentSpace && player.currentSpace !== main.currentSpace) {

                gated = true

            } else {

                const threshold = this.gateStates[sessionId] ? VOICE_GATE_OFF : VOICE_GATE_ON

                gated = main.position.distanceTo(player.position) > threshold * range
            }

            this.gateStates[sessionId] = gated

            this.voiceService.setMicGated(sessionId, gated)
        }

        for (const sessionId in this.gateStates) {

            if (!this.players[sessionId]) delete this.gateStates[sessionId]
        }
    }

    interpolate2(delta) {

        for (let sessionId in this.playerNextPositions) {

            const target = this.playerNextPositions[sessionId];

            if (Players.main.sessionId === target.sessionId) return;

            const normalizedDistance = get2Distance(

                {x: target.x, z: target.z},

                { x: this.players[target.sessionId].position.x, z: this.players[target.sessionId].position.z

            }) / this.players[target.sessionId].roomParameters["user_height"];

             // If distance is big no need to interpolate
            if (normalizedDistance > Players.main.roomParameters.speed * 0.076) {

                this.players[target.sessionId].position.set(target.x, target.y, target.z);

                this.players[target.sessionId].rotation.y = target.rotY;

            } else {

                const interX = MathUtils.lerp(
                    this.players[target.sessionId].position.x,
                    target.x,
                    this.interDelta
                );

                const interY = MathUtils.lerp(
                    this.players[target.sessionId].position.y,
                    target.y,
                    0.1
                );

                const interZ = MathUtils.lerp(
                    this.players[target.sessionId].position.z,
                    target.z,
                    this.interDelta
                );

                this.players[target.sessionId].position.set(
                    interX,
                    interY,
                    interZ
                );

                if (this.players[this.players[target.sessionId].sessionId].avatar3D) {

                    this.players[this.players[target.sessionId].sessionId].avatar3D.onFloor = target.floor
                }

                this.players[target.sessionId].rotation.y = this.rLerp( this.players[target.sessionId].rotation.y, target.rotY, 0.12);

            }
        }
    }

    rLerp (A, B, w){
        let CS = (1-w)*Math.cos(A) + w*Math.cos(B);
        let SN = (1-w)*Math.sin(A) + w*Math.sin(B);
        return Math.atan2(SN,CS);
    }

    // updateDebugMulti(){

    //   this.handlePacket(this.fakePlayers)
    // }

    addEvents() {

        if(this.enabled) return

        this.enabled = true

        Emitter.on(Events.UPDATE, this.update)

        Emitter.on(Events.PAUSE, this.handlePause)

        Socket.on(Events.PLAYER_LEAVE, this.handlePlayerLeave)

        // if( FAKE_PLAYERS == false ) {

        Socket.on(Events.MULTIPLAYER_PACKET, this.handlePacket)
        // }

        Socket.on(Events.PLAYER_JOINED, this.handlePlayerJoin)


        // if( DEBUG_MULTIPLAYER ) {

        //   Emitter.on(Events.UPDATE, this.updateDebugMulti.bind(this))

        //   // this.handlePacket(this.fakePlayers)
        // }

        this.handleEnableVoice()

        // setInterval, not the rAF update loop: a backgrounded speaker's
        // gates must still converge (rAF freezes in hidden tabs; throttled
        // intervals still fire)
        this.gateTimer = setInterval(this.updateVoiceGates, VOICE_GATE_TICK)


        const voiceEvents = this.voiceService.Events

        this.voiceService.on(
            voiceEvents.USER_PUBLISHED,
            this.handleVoiceUserpublished
        )


        this.voiceService.on(
            voiceEvents.USER_UNPUBLISHED,
            this.handleVoiceUserUnpublished
        )


        this.voiceService.on(
            voiceEvents.VOLUME_INDICATOR,
            this.handleVoiceVolumeStats
        )

        this.MultiplayerService.onCommand(SET_MEDIA_TIME, this.handleSetMediaTime)
    }

    removeEvents() {

        this.enabled = false

        if (this.gateTimer != null) {

            clearInterval(this.gateTimer)

            this.gateTimer = null
        }

        Emitter.off(Events.UPDATE, this.update)

        Emitter.off(Events.PAUSE, this.handlePause)

        Socket.off(Events.PLAYER_LEAVE, this.handlePlayerLeave)

        Socket.off(Events.MULTIPLAYER_PACKET, this.handlePacket)

        Socket.off(Events.PLAYER_JOINED, this.handlePlayerJoin)

        const voiceEvents = this.voiceService.Events

        this.voiceService.off(
            voiceEvents.USER_PUBLISHED,
            this.handleVoiceUserpublished
        )


        this.voiceService.off(
            voiceEvents.USER_UNPUBLISHED,
            this.handleVoiceUserUnpublished
        )


        this.voiceService.off(
            voiceEvents.VOLUME_INDICATOR,
            this.handleVoiceVolumeStats
        )


        this.MultiplayerService.offCommand(SET_MEDIA_TIME, this.handleSetMediaTime)
    }

    handleVoiceUserpublished = (uid, { channel }) => {

        if(channel != "mic") return

        this.handleEnableVoice()
    }

    handleVoiceUserUnpublished = (uid, { channel }) => {

        if(channel != "mic") return

        this.handleDisableVoice(uid)
    }

    handleVoiceVolumeStats = ({ channel, volumes }) => {

        if(channel != "mic") return

        if (volumes[Players.main?.sessionId] ) {

            if(!this.voiceService.isVoiceEnabled() || this.voiceService.isMuted()) {

                Players.main.setSpeak( 0 )
            } else {

                if (volumes[Players.main?.sessionId].inactiveTime === Infinity ) {
                    // user didnt speak yet
                    return Players.main.setSpeak( 0 )
                }

                if (volumes[Players.main?.sessionId].inactiveTime >= 2000 ) {

                    Players.main.setSpeak( 0 )

                    return;
                }

                Players.main.setSpeak( 1  )
            }
        }
    }


    update = (delta) => {

        frames++


        // if( DEBUG_MULTIPLAYER ) {

        //     const rd = Math.random() > 0.45

        //     if( rd ){

        //         this.initFakePlayers( 1 )
        //     }

        //     else {

        //          this.removeFakePlayers( 1 )
        //     }
        // }

        // if( FAKE_PLAYERS ) {

        //     let i = 0

        //     // console.log(FAKE_DATA)



        //     while(i < FAKE_DATA.length){

        //         // if( i == 0 ){

        //         //     console.log( FAKE_DATA[i].positionX )
        //         // }

        //         FAKE_DATA[i].positionX += (Math.random() - Math.random())
        //         FAKE_DATA[i].positionZ += (Math.random() - Math.random())
        //         FAKE_DATA[i].rotation  += Math.random() * 0.1

        //         i++
        //     }

        //     if( frames % 20 == 0 ) {

        //         var d = {players: FAKE_DATA }

        //         d = JSON.parse(JSON.stringify(d))

        //         this.handlePacket( {packet: d } )

        //         console.log( handlePacket )

        //     }


        // }

        if (this.delta > this.interval) {

            const pl = Players.main.getPacketPayload()

            // Standing still sends nothing new; refresh it once a second.
            const key = pl.join()

            const now = performance.now()

            if (key !== this.lastSentKey || now - this.lastSentAt > 1000) {

                Socket.emit(Events.SEND_PACKET, {
                    code: "move",
                    payload: pl
                })

                this.lastSentKey = key

                this.lastSentAt = now
            }

            this.delta = this.delta % this.interval;

            // console.log( pl )

        }


        // if (INTERPOLATE) {

            // One patch interval plus room for late patches. With patches
            // stamped on the tick grid, 500ms was mostly added lag.
            this.interpolate6(
                performance.now() - this.patchClock.intervalMs - 120
            );
        // }

        if (this.interDelta > this.fixedInterval) {

            // if (!INTERPOLATE) {

            //     this.interpolate2(delta);
            // }

            this.interDelta = this.interDelta % this.fixedInterval;
        }

        this.interDelta += delta;

        this.delta += delta;

        if( this.fakePlayers ) {

          this.handlePacket(this.fakePlayers)
        }

        // Without a room (or between its patches) still place the
        // recording friends; real patches carry them too.
        if (this.recordingParty) {

            const now = performance.now()

            if (now - (this.lastRealPacketAt || 0) > 1000 && now - (this.lastRecordingTick || 0) > 200) {

                this.lastRecordingTick = now

                this.handlePacket({ packet: { players: [] }, recordingTick: true })
            }
        }

    }


    interpolate6(past) {

        // console.log(this.packets.length)


        if (this.packets.length < 2) {
            this.prevPast = past;

            return;
        };


        // const startAt = performance.now();

        const packetId = this.packets[0].id;

        // console.log(this.packets[0].timestamp)

        // const nextPacketId = this.packets[1].id;

        const t1Timestamp = this.packets[0].timestamp;

        const t2Timestamp = this.packets[1].timestamp;

        const t1players = this.packets[0].packets;

        const t2players = this.packets[1].packets;

        let  shouldKeepInterpolatingPacket = false;

        // console.log(t1players)

        for (const playerId in t1players) {

            const targetPlayer = t2players[playerId];

            const currentPlayer = t1players[playerId];

            if (!currentPlayer || !targetPlayer) continue;

            const ratio = (past - t1Timestamp) / (t2Timestamp - t1Timestamp);

            // console.log(ratio)

            if (targetPlayer?.userId?.includes?.("radomu")) {
                // const log = [t2Timestamp - past, past - t1Timestamp, delta * 1000,  t2Timestamp - t1Timestamp]

                // this.check[packetId] = !this.check[packetId] ? [log] : this.check[packetId].concat([log])

                //console.log(packetId, "ping: ", t2Timestamp - t1Timestamp, "ratio: ", ratio * 100)

            }

            if (t2Timestamp > past) {

                if (t1Timestamp < past) {


                    const interX = MathUtils.lerp(
                        currentPlayer.positionX,
                        targetPlayer.positionX,
                        ratio
                    );

                    const interY = MathUtils.lerp(
                        currentPlayer.positionY,
                        targetPlayer.positionY,
                        ratio
                    );

                    const interZ = MathUtils.lerp(
                        currentPlayer.positionZ,
                        targetPlayer.positionZ,
                        ratio
                    );

                    if (this.players[targetPlayer?.sessionId]) {

                        this.players[targetPlayer.sessionId].position.set(
                            interX,
                            interY,
                            interZ
                        );

                        if (this.players[targetPlayer.sessionId].avatar3D) {

                            this.players[targetPlayer.sessionId].avatar3D.onFloor = currentPlayer.floor
                        }

                        this.players[targetPlayer.sessionId].rotation.y = this.rLerp( this.players[targetPlayer.sessionId].rotation.y, targetPlayer.rotY, ratio);
                    }
                }

                shouldKeepInterpolatingPacket = true;

            }  else {

                // console.log("NOT INTERPOLATING...");

                if (this.players[targetPlayer?.sessionId]) {

                    this.players[targetPlayer.sessionId].position.set(
                        targetPlayer.positionX,
                        targetPlayer.positionY,
                        targetPlayer.positionZ
                    );

                    if (this.players[targetPlayer.sessionId].avatar3D) {
                        this.players[targetPlayer.sessionId].avatar3D.onFloor = targetPlayer.floor
                    }

                    this.players[targetPlayer.sessionId].rotation.y = targetPlayer.rotY;

                    if (targetPlayer.animation !== this.players[targetPlayer.sessionId].animation) {

                        this.players[targetPlayer.sessionId].handleSit( targetPlayer.animation === 10 || targetPlayer.animation === 12);

                        this.players[targetPlayer.sessionId].animation = targetPlayer.animation

                        this.players[targetPlayer.sessionId].playEmote( targetPlayer.animation )

                    }
                }

            }

        }

        if (!shouldKeepInterpolatingPacket) {
            this.packets.shift();
        }

        this.prevPast = past;
    }

    handlePlayerJoin = (opts) => {

        if(opts?.sessionId && !this.players[opts.sessionId]) {

            Emitter.emit(Events.CUSTOM, {
                type: Events.PLAYER_JOINED,
                value: opts
            })

        }
    }

    handlePlayerLeave = (opts) => {

        if (opts.sessionId && this.players[opts.sessionId]) {

            this.players[opts.sessionId].dispose();

            Players.dispose( this.players[opts.sessionId].block )

            delete this.players[opts.sessionId]

            delete this.gateStates[opts.sessionId]

            Emitter.emit(Events.CUSTOM, {

                type: Events.UPDATE_PLAYERS,

                value: this.players
            })
        }
    }

    createDummyPlayer = async (opts) => {

        if (opts.type === "create") {

            if (this.players[opts.sessionId]) return;


            const VRM = opts.vrm || VRMS["square"].url

            if( GLTF[ VRM ] == null) {

                console.log( 'vrm does not exists yet ')

                await GLTF.loadOnce({
                  name: VRM,
                  url : VRM
                })
            }

            const playerAvatar = await Players.get({
                userData: {
                    avatar: DEFAULT_PLAYER_AVATAR_PICTURE,
                    username: opts.username || opts.sessionId,
                    walletId: opts.sessionId,
                    isAdmin: false,
                    VRM: VRM
                },
                exhibit: {
                    id: CURRENT_SPACE.exhibit.id
                },
                user: {
                    id: opts.sessionId
                },
                roomParameters: {
                    user_height: 2.8
                },
                sessionId: opts.sessionId,
                isDummy: true,
                animation: opts.animation || 1,
            })

            if (opts.visible) {

                playerAvatar.deactivated = true;

                playerAvatar.isSitting = true;

                playerAvatar.handleSit( true );
            }


            this.players[opts.sessionId] = playerAvatar

            if (opts.username) {
                playerAvatar.updatePlayer({
                    type: UPDATE_USERNAME,
                    payload: opts.username
                })
            }

            if (DEFAULT_PLAYER_AVATAR_PICTURE) {
                playerAvatar.updatePlayer({
                    type: UPDATE_AVATAR,
                    payload: DEFAULT_PLAYER_AVATAR_PICTURE
                })
            }

            if (!opts.visible) {

                playerAvatar.hide()
            }

            // We should set the right position here...

            if (CURRENT_SPACE?.roomParameters?.initialPlayerPosition) {
                const { x, y, z } = CURRENT_SPACE?.roomParameters?.initialPlayerPosition;

                playerAvatar.position.set(x, y, z);
            }

            if (opts.position) {


                playerAvatar.position.set(opts.position.x, opts.position.y, opts.position.z);
            }

            if (opts.rotation) {
                playerAvatar.rotation.y = opts.rotation.y;
            }

            if (opts.animation) {
                playerAvatar.playEmote(opts.animation)
            }

            // this.add(this.players[opts.sessionId])

            Emitter.emit(Events.CUSTOM, {

                type: Events.UPDATE_PLAYERS,

                value: this.players
            })

            this.handleEnableVoice()

            return this.players[opts.sessionId].getPayload()
        } else if (opts.type === "delete") {
            if (this.players[opts?.sessionId]?.isDummy) {

                this.handlePlayerLeave(opts)
            }
        }
    }

    recordingPartyEntries() {

        const main = Players.main

        if (!this.recordingPartyCache) {

            // You land alone: friends start arriving once the arrival has
            // handed you control, around the spot you landed on.
            if (!main?.avatar3D || !main.currentSpace || !Camera.current || !Camera.active) return null

            const payload = main.getPacketPayload(true)

            const forward = Camera.current.getWorldDirection(new Vector3())

            forward.y = 0

            if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1)

            forward.normalize()

            const position = { x: payload[0], y: payload[1], z: payload[2] }

            const spots = recordingPartyLanding(this.recordingParty.length, position, forward, this.recordingPartyProbe(main))

            this.recordingPartyCache = recordingPartyPlayers(this.recordingParty, {
                ...position,
                scale: payload[4],
                space: payload[5],
                userHeight: payload[9],
            }, spots)

            this.recordingArrivalStart = performance.now()
        }

        // Friends stay with you from room to room: a player whose
        // space differs from yours is hidden.
        for (const friend of this.recordingPartyCache) friend.space = main.currentSpace

        const elapsed = (performance.now() - this.recordingArrivalStart) / 1000

        return this.recordingPartyCache.filter((friend) => friend.arriveAt <= elapsed)
    }

    /**
     * Floor and wall checks for where the friends land, against the space's
     * collision mesh. Packet heights are your feet; rays start above them.
     */
    recordingPartyProbe(main) {

        const world = Camera.currentControls?.world

        if (!world?.collisions?.rayIntersect) return {}

        const ray = new Ray()

        const down = new Vector3(0, -1, 0)

        const chest = (main.avatar3D?.headPosition?.y || 1.6) * 0.6

        return {
            floorAt: (x, z, nearY) => {

                ray.origin.set(x, nearY + 2, z)

                ray.direction.copy(down)

                const hit = world.collisions.rayIntersect(ray)

                return hit && hit.distance < 4.5 ? hit.position.y : null
            },
            clearPath: (from, to) => {

                const dx = to.x - from.x, dz = to.z - from.z

                const distance = Math.hypot(dx, dz)

                if (distance < 1e-3) return true

                ray.origin.set(from.x, main.position.y + chest, from.z)

                ray.direction.set(dx / distance, 0, dz / distance)

                const hit = world.collisions.rayIntersect(ray)

                // keep a body's width from anything solid
                return !hit || hit.distance > distance + 0.4
            },
        }
    }

    /**
     * Recording only: the friends line up beside you for the trip back.
     * `yaw` is your heading as the lobby reads it. With `snap` they are put
     * in place at once instead of walking there. False without friends.
     */
    lineUpRecordingParty(yaw, snap = false) {

        // Everyone still on the way arrives for the line.
        if (this.recordingPartyCache) this.recordingArrivalStart = -Infinity

        const friends = this.recordingParty && this.recordingPartyEntries()

        const main = Players.main

        if (!friends || !main) return false

        const fx = -Math.sin(yaw), fz = -Math.cos(yaw)

        const rx = -Math.cos(yaw), rz = Math.sin(yaw)

        friends.forEach((friend, index) => {

            const place = recordingPartyLinePlace(index, friends.length)

            friend.positionX = main.position.x + rx * place.side + fx * place.depth

            friend.positionZ = main.position.z + rz * place.side + fz * place.depth

            friend.rotation = main.rotation.y

            const player = snap && this.players[friend.sessionId]

            if (player) {

                player.position.x = friend.positionX

                player.position.z = friend.positionZ

                player.rotation.y = friend.rotation
            }
        })

        this.handlePacket({ packet: { players: [] }, recordingTick: true })

        return true
    }

    handlePacket = (opts) => {

        if (!this.inited) {
            this.inited = true;
        }

        if (this.recordingParty) {

            if (!opts.recordingTick) this.lastRealPacketAt = performance.now()

            const players = []

            opts.packet?.players?.forEach?.((player) => players.push(player))

            const friends = this.recordingPartyEntries()

            if (friends) players.push(...friends)

            opts = { packet: { players } }
        }

        const packet = opts.packet;

        this.playerNextPositions = {};

        const shortAidi = shortid.generate()

        ////

        // console.log(packet);

        var creationMax   = IS_MOBILE ? 1 : 5

        if( DEBUG_MULTIPLAYER ) {

            creationMax = 5
        }

        var creationCount = 0

        mod++

        const p = {};

        // console.log( Players.main?.avatar3D?.position )

        // console.log(packet.players)

        packet.players.forEach( async (player) => {
            let {
                positionX,
                positionY,
                positionZ,
                rotation,
                scale,
                space,
                userId,
                avatar,
                username,
                user_height,
                paused,
                sessionId,
                animation,
                isAdmin,
                floor,
                walletId,
                VRM
            } = player;

            username = username || walletId;

            var pSessionID = this.players[sessionId]
            // console.log( player )

            // a dummy player is added by his userId instead of sessionId
            if (pSessionID?.isDummy) {

                this.handlePlayerLeave(player)
                // Leaving disposes the dummy avatar. Resolve the live entry again
                // so this packet can create a real player instead of using it.
                pSessionID = this.players[sessionId]
            }

            // console.log(sessionId, positionX, positionY, positionZ)

            // WE ADD PLAYER ==> Only add the ones in same space
            if (

                (DEBUG_MULTIPLAYER == true ||
                (mod % 2 == 0  &&
                creationCount < creationMax)) &&
                Players.main.sessionId !== sessionId &&
                !pSessionID
            ) {

                // Recording friends keep their own avatar at any quality.
                const needsOverride = !player.recordingFriend && (
                    Players.main.position.distanceTo({x: positionX, y: positionY, z: positionZ}) > LOD_VRM_DISTANCE
                      || QUALITIES.LOW == QUALITY || QUALITIES.MEDIUM == QUALITY )


                const CURRENT_VRM = needsOverride ? ( QUALITIES.MEDIUM == QUALITY ? MID_LOD_VRM : LOD_VRM ) : ( VRM == null ? DEFAULT_VRM : VRM )

                if( GLTF[CURRENT_VRM] == null ) {

                    GLTF.loadOnce( {
                      name:  CURRENT_VRM,
                      url:  CURRENT_VRM
                    } )

                  return
                }

                if( GLTF[CURRENT_VRM].isHighQuality && GLTF.poolAvailable(CURRENT_VRM) == false  ) {

                    GLTF.requestPoolOnce( CURRENT_VRM )

                    return
                }

                let vrmMesh;

                if( GLTF[CURRENT_VRM].isHighQuality ) {

                  vrmMesh =  GLTF.requestPoolNow(CURRENT_VRM)

                  if( vrmMesh ) {

                    vrmMesh.scene.poolUsed = true

                  }
                  else {

                    return
                  }

                }


                creationCount++

                // console.log( "player...", positionX,
                // positionY,
                // positionZ,
                // rotation,
                // scale,
                // space,
                // userId,
                // avatar,
                // username,
                // user_height,
                // paused,
                // animation,
                // sessionId,
                // VRM,
                // isAdmin)

                // pSessionID = LOADING

                const playerAvatar = Players.get({

                    animation: animation,

                    position: {
                        x: positionX,
                        y: positionY,
                        z: positionZ,
                    },
                    rotation: rotation,
                    userData: {
                        avatar,
                        username,
                        walletId: walletId,
                        isAdmin,
                        VRM: CURRENT_VRM,
                        HIGH_VRM : VRM,
                        VRMMeshes: vrmMesh
                    },
                    exhibit: {
                        id: space
                    },
                    user: {
                        id: userId
                    },
                    roomParameters: {
                        user_height
                    },
                    sessionId
                })

                this.players[sessionId] = playerAvatar

                pSessionID = playerAvatar

                //pSessionID.playEmote( animation )

                playerAvatar.position.set(positionX, positionY, positionZ);

                // playerAvatar.rotation.y = rotation;

                // console.log( playerAvatar.position )

                this.add(playerAvatar)

                Emitter.emit(Events.CUSTOM, {

                    type: Events.UPDATE_PLAYERS,

                    value: this.players
                })

                const stream = this.voiceService.micStreams[sessionId];

                if(stream) {

                    playerAvatar.enableVoice(stream)
                }
            }


            if (pSessionID) {

                let hasChanged = false;

                // update player main
                if (pSessionID.userData.isAdmin  !== isAdmin) {

                    pSessionID.userData.isAdmin = isAdmin

                    hasChanged = true;
                }

                if (pSessionID.userData.walletId  !== walletId) {

                    pSessionID.userData.walletId = walletId

                    hasChanged = true;
                }

                if (hasChanged) {

                    Emitter.emit(Events.CUSTOM, {

                        type: Events.UPDATE_PLAYERS,

                        value: this.players
                    })
                }

            }

            // We only care about the other players state since we already have the current player's state
            if (Players.main.sessionId !== sessionId && pSessionID?.avatar3D && !pSessionID.wasDisposed) {

                p[sessionId] = {
                    positionX,
                    positionY,
                    positionZ,
                    userId,
                    rotY: rotation,
                    floor,
                    sessionId,
                    animation
                }

                pSessionID.playEmote( animation )


                // is this model overrided and needs loading ?

                const vrmIsntOverride = pSessionID.avatar3D.overrideVRMName != null && space == Players.main.currentSpace

                const needsLOD = !player.recordingFriend && Players.main.position.distanceTo({x: positionX, y: positionY, z: positionZ}) > LOD_VRM_DISTANCE
                const needsOverride = needsLOD  || ( !player.recordingFriend && ( QUALITIES.LOW == QUALITY || QUALITIES.MEDIUM == QUALITY ) )


                var CURRENT_VRM = needsOverride ? ( QUALITIES.MEDIUM == QUALITY ? MID_LOD_VRM : LOD_VRM ) : ( VRM == null ? DEFAULT_VRM : VRM )

                CURRENT_VRM = needsLOD ? LOD_VRM : CURRENT_VRM

                if( GLTF[ CURRENT_VRM ] == null) {

                    GLTF.loadOnce({
                      name: CURRENT_VRM,
                      url : CURRENT_VRM
                    })

                    return;
                }


                if (pSessionID?.userData?.VRM != VRM && vrmIsntOverride == false ) {

                    // UPDATE TO NEW VRM HERE

                    if( GLTF[ VRM ] == null) {

                        GLTF.loadOnce({
                          name: VRM,
                          url : VRM
                        })
                    }

                    else {

                      if( GLTF[VRM].isHighQuality && GLTF.poolAvailable(VRM) == false  ) {

                          console.log( 'vrm exists but no pool ')

                          GLTF.requestPoolOnce( VRM )
                      }

                      else {

                          pSessionID.updatePlayer({
                              type: UPDATE_VRM,
                              payload: VRM
                          })
                      }
                    }
                }

                if (pSessionID?.userData?.username !== username) {

                    pSessionID.updatePlayer({
                        type: UPDATE_USERNAME,
                        payload: username
                    })
                }

                // const isLowQuality = PERF_SCORES.LOW == QUALITY

                if ( pSessionID?.avatar3D?.url !== avatar   ) {

                    // console.log( 'effectively updating player ' )
                    // console.log( pSessionID?.avatar3D?.url )
                    // console.log( avatar )

                    pSessionID.updatePlayer({
                        type: UPDATE_AVATAR,
                        payload: avatar
                    })
                }

                let spaceHasChanged = false

                if(pSessionID.currentSpace !== space) {

                    pSessionID.currentSpace = space

                    spaceHasChanged = true
                }

                // console.log( )

                if( pSessionID?.userData?.VRM == CURRENT_VRM ) {

                  pSessionID.scaleVRM(scale)
                }

                pSessionID.roomParameters.user_height = user_height

                if (space !== Players.main.currentSpace) {

                    // console.log(sessionId)
                    // console.log(sessionId)


                    pSessionID.hide();

                    return;

                } else {

                    if (STATIC_CAMERA) {

                        pSessionID.hide();
                    } else {

                        pSessionID.show();
                    }

                    if(spaceHasChanged) {

                        pSessionID.setVoiceRange()
                    }
                }


                pSessionID.isPaused = paused;

                // if (this.players[sessionId].avatar3D3D) {

                //     this.players[sessionId].avatar3D3D.wrapper.paused = paused;
                // }


                this.playerNextPositions[ sessionId ] = {
                    x: positionX,
                    y: positionY,
                    z: positionZ,
                    userId,
                    rotY: rotation,
                    id: shortAidi,
                    floor,
                    sessionId
                }


                // console.log( this.playerNextPositions[ userId ] )

            }
        });

        // if (INTERPOLATE) {
            // Packets accumulate even tho window is out of focus.
            const timestamp = this.patchClock.stamp(performance.now());

            const previous = this.packets[this.packets.length - 1];

            const interval = this.patchClock.intervalMs;

            // The room only sends a patch when something changed. After a
            // quiet spell, everyone was still where the last patch put them
            // one tick ago; without that sample a restart would be spread
            // over the whole pause and then jump.
            if (previous && timestamp - previous.timestamp > interval * 1.5) {
                this.packets.push({
                    packets: previous.packets,
                    id: previous.id + "-rest",
                    timestamp: timestamp - interval
                });
            }

            this.packets.push({
                packets: p,
                id: shortAidi,
                timestamp
            });

            if (this.packets.length > 12) {
                this.packets.splice(0, this.packets.length - 4);
            }
        // }

        // if (Object.keys(this.playerNextPositions).length) {

        //     this.packets.unshift(this.playerNextPositions);
        // }

        // console.log(this.packets);
    }

    handlePause() {
        // Socket.emit(Events.SEND_PACKET, PlayerImageAvatar3D.getPacketPayload())

        this.packets = [];

    }

    handleEnableVoice = () => {


        const streams = this.voiceService.micStreams


        for(let sessionId in streams) {

            const stream = streams[sessionId]

            const player = this.players[sessionId]

            if (player == null) {

                console.error("[Multiplayer.handleEnableVoice] Player not found", sessionId)
            }
            else {

                player.enableVoice(stream)

                if ( this.players[sessionId].currentSpace !== Players.main.currentSpace )  {

                    this.players[sessionId].voice?.disable()
                }
            }

        }
    }

    handleDisableVoice = (sessionId) => {

        if(Players.main.sessionId === sessionId) {

            Players.main.setSpeak( 0 )

            return
        }

        const player = this.players[sessionId]

        if (player == null) {

            console.error("[Multiplayer.handleDisableVoice] Player not found", sessionId)

            return
        }

        player.disableVoice()
    }

    /**
     *
     * @param { { assetId: string, time: number } } opts
     */
    handleSetMediaTime = ({ assetId, time }) => {

        const artwork = root.currentArtworks.findArtwork(it => it.data.id === assetId)

        if(artwork?.videoController != null) {

            return artwork.videoController.seek(time)
        }
        else if(artwork?.audioController != null) {

            return artwork.audioController.seek(time)
        }

        return {

            type: CAMMAND_ERRORS.ASSET_NOT_FOUND,

            success: false,

            message: "Invalid asset"
        };

    }

    /**
     *
     * @param { string } assetId
     */
    handleAdminSyncMediaTime = async (assetId) => {

        const artwork = root.currentArtworks.findArtwork(it => it.data.id === assetId)

        let time = -1;

        if(artwork?.videoController != null) {

            time = artwork.videoController.getCurrentTime()
        }
        else if(artwork?.audioController != null) {

            time = artwork.audioController.getCurrentTime()
        }

        if(time >= 0) {

            await this.handleSetMediaTime({ assetId, time: 0 })

            this.MultiplayerService.sendCommand(SET_MEDIA_TIME, { assetId: artwork.userData.id, time: 0 })
        }

        return {

            type: CAMMAND_ERRORS.ASSET_NOT_FOUND,

            success: false,

            message: "Invalid asset"
        };
    }


    dispose() {


        Object.values(this.players).forEach(player => {
            if (Players.main?.sessionId === player.sessionId) return;

            player.dispose();
        })

        // Players.main.avatar3D.visible = false

        // Players.dispose( Players.main.avatar3D )

        // Players.main.dispose()

        // Players.main = null

        // Players.disposeAll()

        this.players = {};

        this.gateStates = {};

        this.packets = []

        this.playerNextPositions = {};

        this.packets = [];

        this.removeEvents();
    }

}


export default new Multiplayer();
