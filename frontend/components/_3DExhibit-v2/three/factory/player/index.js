import InstancePlayer from './instance.js'

import AtlasFactory from '@3factory/atlas'

import {

    Vector3

} from 'three'

import Textures from '@3textures'

import Scene from '@3scene'

import Camera from '@3camera'

import Events from  '@3events'

import Emitter from '@3emitter'

import InstanceAvatar3D from './instanceavatarvrm'

import InstanceUserName from './instanceusername'

import UserNameGenerator from './instanceusername/generator'

import GLTF from "@3gltf"

import { formatWalletAddress } from '@utils/format'
import { DEFAULT_PLAYER_AVATAR_PICTURE } from './constants.js'

let c = 0

const temp1 = new Vector3()

// Guaranteed-drawable fallback for when the avatar image fails to load
let placeholderAvatarImage = null

function getPlaceholderAvatarImage() {

    if( placeholderAvatarImage == null ) {

        const canvas = document.createElement('canvas')

        canvas.width = canvas.height = 64

        const ctx = canvas.getContext('2d')

        ctx.fillStyle = '#808080'

        ctx.beginPath()

        ctx.arc(32, 32, 32, 0, Math.PI * 2)

        ctx.fill()

        placeholderAvatarImage = canvas
    }

    return placeholderAvatarImage
}

// import Atlas

export class Players {

    constructor() {

        this.main = null

        this._init = false

        this.atlasAvatar = AtlasFactory.get( { debug: false })

        this.atlasUserName = AtlasFactory.get( { debug : false, distance : true, elementSize : UserNameGenerator.CANVAS_SIZE })

        InstanceAvatar3D.enabled = true

        InstanceAvatar3D.setAtlas(this.atlasAvatar)

        this.instances = []

        window.players = this

    }

    initUsername(){
        // This factory survives route changes; disposeAll disables its avatar
        // updates. Every new native space must resume them before creating players.
        InstanceAvatar3D.enabled = true


        // this.instanceAvatar = new InstanceAvatar( this.atlasAvatar )

        // Scene.add( this.instanceAvatar )

        this.instanceUserName = new InstanceUserName( this.atlasUserName )

        // this.instanceuserName.position.y = 1.2

        Scene.add( this.instanceUserName )

    }


    get(opts){

        if( opts.main && this.main != null ) {

            return this.main
        }

        // When the avatar image failed to download, the texture exists but
        // has no data, and DEFAULT_PLAYER_AVATAR_PICTURE is a url string —
        // neither is drawable by the atlas or the username label. Fall back
        // to a generated placeholder so they always receive a real image.
        let defaultImage = Textures['avatarImg']?.source?.data

        if( defaultImage == null || typeof defaultImage === 'string' ) {

            console.error('[Players] avatar image unavailable, using placeholder')

            defaultImage = getPlaceholderAvatarImage()
        }

        var avatarBlock = this.atlasAvatar.addImage( defaultImage )

        const name = opts.userData.username

        if( opts.position ){

            temp1.copy( opts.position )
        }

        const distance = this.main == null ? 0 : temp1.distanceTo( this.main.position )

        var userNameBlock = this.atlasUserName.addImage( UserNameGenerator.get( name, defaultImage ), name, { distance: distance }  )

        const instance = new InstancePlayer( opts, avatarBlock, userNameBlock )

        if( opts.main ) {

            this.main = instance


            window.datMain = this

            // instance.position.copy( Camera.currentControls.world.thirdPersonPos )

            instance.updateAvatar()

            this.main.init(true)


        }

        this.instances.push(instance)

        return instance
    }

    showUsername(val) {

        if(this.instanceUserName !== null) {

            this.instanceUserName.visible = val;

        }

    }

    changeVRM( vrm, opts  ){

        console.log(' change vrm ', vrm )

        if( this.main ) {

            if ( vrm != this.main?.avatar3D?.vrmName || opts.demo == true ) {

                return this.main.changeVRM( vrm, opts )

            } else {

                return
            }
        }
        else {

            console.error("main player is not defined yet, can't change vrm")

            return
        }

    }

    scaleVRM( val ){

        return new Promise( ( resolve ) => {

            if ( this.main ) {
                const scale = this.main.scaleVRM( val )

                this.main.updateSitPosition()

                return scale;
            }
            else {

                console.error("main player is not defined yet, can't scale vrm")

                return
            }

            // console.log( 'scale vrm ' , val )

            // resolve()
        })
    }

     getVRMScale() {


        if ( this.main ) {

            return this.main.getVRMScale()
        }
        else {

            console.error("main player is not defined yet, can't scale vrm")

            return
        }

    }

    updateAvatar( instance, avatarBlock, url ){

        return new Promise((resolve)=>{

            // if trying to call the same url than before

            if( url == instance.lastCalledUrl ) {

                return
            }

            instance.lastCalledUrl = url

            this.atlasAvatar.load( url ).then(( img )=>{

                if( img == null ) {

                    resolve( null )

                    return
                }

                if(  instance.lastCalledUrl == url && instance.avatar3D ) {

                    instance.avatar3D.url   =  url

                    var newAvatarBlock = this.atlasAvatar.addImage( img, url )

                    instance.block = newAvatarBlock

                    // instance.avatar3D.atlas =  { x: newAvatarBlock.uvScale.x, y: newAvatarBlock.uvScale.y, z: newAvatarBlock.uvPos.x, w: newAvatarBlock.uvPos.y }

                    // console.log( newAvatarBlock )
                    // console.log( newAvatarBlock )
                    // console.log( newAvatarBlock )

                    // newAvatarBlock.visible = instance.visible

                    // instance.avatar = newAvatarBlock

                    // newAvatarBlock.position = newAvatarBlock.position

                    // newAvatarBlock.wrapper.visible = instance.visible

                    // newAvatarBlock.wrapper.animations = instance.animations

                    // newAvatarBlock.wrapper.rotation = instance.rotation

                    instance.lastCalledUrl = null

                    this.dispose( avatarBlock )

                    resolve(img)
                }

            })
        })
    }

    updateUserName( instance, usernameBlock, name, avatar, textOnly ) {

        return new Promise((resolve)=>{

            // if trying to call the same url than before

            var newUserNameBlock = this.atlasUserName.addImage( UserNameGenerator.get( name, avatar, null, textOnly ), name  )

            this.disposeUserName( usernameBlock )


            newUserNameBlock.visible = instance.visible

            instance.username = newUserNameBlock

            newUserNameBlock.wrapper.position = newUserNameBlock.wrapper.position

            newUserNameBlock.wrapper.visible = instance.visible


            resolve()

        })
    }

    dispose( block ){

        if( block != null ) {

            this.atlasAvatar.remove( block )

        }
    }

    disposeUserName( block ) {

         if( block != null ) {

            this.atlasUserName.remove( block )

        }
    }

    disposeAll(){

        this.atlasAvatar.reset()

        this.atlasUserName.reset()

        // Scene.remove( this.instanceAvatar )

        Scene.remove( this.instanceUserName )

        InstanceAvatar3D.enabled = false

        // this.instanceAvatar.dispose()

        this.instanceUserName?.dispose()

        // this.instanceAvatar = null

        this.instanceUserName = null

        this.main = null

    }

}

export default new Players();
