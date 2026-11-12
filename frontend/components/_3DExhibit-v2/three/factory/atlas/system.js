import Packer from '@3utils/packer.js'

import UpdatableTexture from './updatabletexture.js'

import {

    SUPPORT_BITMAP_LOADING

} from '@3constants'

import {

    TEXTURE_SIZE,

    ATLAS_EVENTS

} from './constants'

import datjson from './data.json'

const Data  = datjson.data

import Scene from '@3scene'

import {

    Mesh,

    MeshBasicMaterial,

    PlaneGeometry,

} from 'three'

import gui from '@3gui'

const debug = false

import Events from '@3events'


var notthere = 0

import Emitter from '@3emitter'

import Augmented from '@3abstract/augmented'

export default class Atlas extends Augmented {

    constructor( opts = {} ) {

        super()

        this.frame = 0

        this.opts = opts

        this.blocks = []

        this.distanceBased = opts.distance == true

        this.maxTexture    = 1

        this.megaTextures  = []

        this.packer = new Packer( TEXTURE_SIZE , TEXTURE_SIZE )

        this.packer.init( TEXTURE_SIZE , TEXTURE_SIZE)

        this.textureIndex = 0

        this.debugMeshes = []

        this.seen = {}

        this._init = false

        this.drawn = {}

        // slot ("textureIndex:x:y") -> image currently drawn there
        this.slotImages = {}

        if( this.distanceBased && opts.elementSize ) {

            let w = Math.floor(TEXTURE_SIZE / opts.elementSize.w)
            let h = Math.floor(TEXTURE_SIZE / opts.elementSize.h)

            this.distanceBasedMaxElements  = w * h

        }

        //     this.distanceBasedMaxElements = 0

        //     let i = 0

        //     let testBlocks = []

        //     while(i < 100 ) {

        //         testBlocks.push({

        //             w : opts.elementSize.w,
        //             h : opts.elementSize.h,
        //             url : i + "temp",
        //         })
        //         i++
        //     }


        //     const maxLoop = this.packer.fit(  testBlocks, { max: this.maxTexture }  )

        //     console.log( testBlocks )
        //     console.log( maxLoop )
        //     console.log( maxLoop )
        //     console.log( maxLoop )
        //     console.log( maxLoop )
        //     console.log( maxLoop )
        //     console.log( maxLoop )
        //     console.log( maxLoop )
        //     console.log( maxLoop )

        //     this.packer.reset()

        // }


         // this.packer = new Packer( TEXTURE_SIZE , TEXTURE_SIZE )

        // this.indexes = []

        Emitter.on(Events.PRE_UPDATE, this.update.bind(this))

    }


    remove( block ){

        const index = this.blocks.indexOf(block)


        if( index == -1 ) {

            block.dead = true

            return
        }

        const tex       =  this.megaTextures[ block.textureIndex  ]

        // console.log('remove', block.url)

        // console.trace()

        if( this.drawn[block.url] != undefined ) {

            if ( this.drawn[ block.url ] <= 1 ) {

            }
            else {

                this.drawn[ block.url ]--
            }
        }


        // if( this.distanceBased == false ) {

        //     const previousTex = this.megaTextures[ block.lastDraw.textureIndex ]

        //     previousTex.erase(block.img,  block.lastDraw.x,  block.lastDraw.y)

        // }


        this.emit(ATLAS_EVENTS.REMOVE_BLOCK, block )

        this.blocks.splice(index, 1)


        block = null

        this.calculateBlocks()

        this.emit(ATLAS_EVENTS.BLOCK_DATA, this.blocks )

    }



    add( url ){

        return new Promise(( resolve )=>{

            // console.log( url )

            if( this.seen[url] ){

                var block = this.pushBlock( this.seen[url].img, url)

                resolve( block )
            }
            else {

                this.load(url).then( async ( img )=>{

                   if( this.seen[url] ){

                       var block = this.pushBlock( this.seen[url].img, url)

                       resolve( block )

                      // console.log('seen')
                   }
                   else {

                       var block = this.pushBlock( img, url)

                       this.seen[url] = block

                       resolve( block )
                   }
                })
            }

        })
    }

    addImage( image, url = null, opts = {} ){

        var block = this.pushBlock( image, url || image.src )

        if( this.distanceBased ) {

            block.distance = opts.distance
        }

        this.seen[ url ] = block

        return block
    }

    pushBlock( img, url ){

        const block = {

            img: img,
            url: url,
            w: img.naturalWidth || img.width,
            h: img.naturalHeigh || img.height
        }

        // console.log( url )


        this.blocks.push( block )

        // if( this.distanceBased){

        //     console.log(block)

        // }


        this.calculateBlocks()

        // console.log( this.blocks )
        // console.log( this.blocks )

        this.emit(ATLAS_EVENTS.BLOCK_DATA, this.blocks )

        return block
    }

    update(){

        const blockMap = {}

        this.frame++

        if( this.needsDraw == false && this.distanceBased == false ){

            return
        }

        if( this.distanceBased  ) {

            if( this.frame % 2 == 0 ){

                this.calculateBlocks()
            }

            else if ( this.needsDraw == false ) {

                return
            }
        }

        this.needsDraw = false

        this.drawn   = {}

        // this.indexes = []

        let i = 0

        // console.log(this.blocks.length)

        // only crawl through the firsts elements for distance based, no need to test them all
        const testLength = this.distanceBased ? Math.min( this.distanceBasedMaxElements,  this.blocks.length)  : this.blocks.length

        while(i  < testLength ) {

            const block     = this.blocks[i]

            var redraw = true


            if( block.lastDraw != null ) {

                if( block.lastDraw.x == block.fit.x && block.lastDraw.y ==  block.fit.y && block.textureIndex == block.lastDraw.textureIndex ) {

                    redraw = false
                }


                // if( redraw ) {



                //     if( this.distanceBased == false ) {

                //         // const previousTex = this.megaTextures[ block.lastDraw.textureIndex ]

                //         // previousTex.erase(block.img,  block.lastDraw.x,  block.lastDraw.y)
                //     }

                // }
            }

            i++
        }



       let g = 0

       const length = this.distanceBased ? this.maxTexture : this.megaTextures.length


       while(g < length ) {

            i = 0

            while( i < this.blocks.length ) {
                
                

                const block     = this.blocks[i]

                if(block.wrapper && block.wrapper.visible == false ) {
                    
                    i++

                    continue
                }

                const tex       =  this.megaTextures[ block.textureIndex ]

                // per texture

                if( g == block.textureIndex ) {


                    // console.log(block.textureIndex)

                    // console.log(block.wrapper.distance)

                    // if( block.lastDraw == null ) {

                    //     console.log(this.distanceBased)
                    //     console.log( block )

                       
                    // }

                    const img       = block.img

                    // Redraw unless this exact image is already in the slot.
                    // Comparing against the block's own last position isn't
                    // enough: a block that overflowed or was hidden keeps its
                    // old lastDraw while another block draws over that slot,
                    // then shows the other block's image (someone else's
                    // username) when it gets the slot back.
                    const slotKey = block.textureIndex + ':' + block.fit.x + ':' + block.fit.y

                    var redraw = this.slotImages[ slotKey ] !== img

                    if( redraw && this.drawn[ block.url ] == null ) {

                        this.slotImages[ slotKey ] = img
                    }

                    // if( this.distanceBased ){

                    //     redraw = true
                    // }

                    if( this.drawn[ block.url ] == null  ) {

                        this.drawn[ block.url ] = 0
                    }

                    if( redraw ) {

                        // if not drawn on screen already

                        if( this.drawn[ block.url ] == 0   ) {

                            console.log('update ')
                            tex.update(img, block.fit.x, block.fit.y)
                        }

                    }

                    this.drawn[ block.url ]++


                    block.lastDraw = {

                        textureIndex: block.textureIndex,

                        x : block.fit.x,

                        y: block.fit.y
                    }

                    blockMap[block.url] = {

                        atlas: { x: block.uvScale.x, y: block.uvScale.y, z: block.uvPos.x, w: block.uvPos.y },

                        textureIndex: block.textureIndex
                    }
                }

                i++
            }

            g++

        }

        const l = this.debugMeshes.length

        if( l ){

            let g = 0

            const max = l * 5

            const range = max / Math.max((l - 1), 1)

            while( g < l ) {

                const x =  l == 1 ? 0 : range * g - max * 0.5

                this.debugMeshes[g].position.set(x, 14, 0  )

                g++
            }


        }

        this.blocks.blockMap = blockMap

        // if(  this.distanceBased  ) {

        // }
        // else {

        // }

        this.emit( ATLAS_EVENTS.BLOCK_DATA , this.blocks )

    }

    log(){

        let i = 0

        while(i < this.blocks.length ) {

            console.log('texture Index : ' , this.blocks[i].textureIndex )

            i++
        }

    }

    calculateBlocks(){

        this.resetFit()

        this.packer.reset()


        if( this.distanceBased ){

            this.blocks.sort( (a, b) => {

                if( a.wrapper == null || a.wrapper?.visible == false ) {

                    a.lastDraw = null

                    return 1
                }
                if( b.wrapper == null || b.wrapper?.visible == false ) {

                    b.lastDraw = null

                    return -1
                }

                // distance is 0 for the local player, so test for null rather
                // than truthiness or the local player is never sorted first
                if( a.wrapper.distance != null && b.wrapper.distance != null ) {

                    if (a.wrapper.distance > b.wrapper.distance) {

                        return  1
                    }
                    if (a.wrapper.distance < b.wrapper.distance) {

                        return  -1

                    }
                }

            })


            // if( this.blocks.length > 5 ) {

            //     let g = 0
            //     while(g < 5){

            //         console.log( g, this.blocks[g].wrapper.distance )
            //         g++
            //     }
            // }

        }

        // console.log(this.blocks)

        const opts = { needsFitData: TEXTURE_SIZE }

        if( this.distanceBased ) {

            opts.max = this.maxTexture
        }

        const maxLoop = this.packer.fit(  this.blocks, opts  )

        this.needsDraw = true


        // reset last draw if the element isnt in the same previous index of drawing
        if( this.distanceBased ) {

            let i = 0

            while( i < Math.min( this.distanceBasedMaxElements, this.blocks.length ) ) {

                if(  this.blocks[i].wrapper  ) {

                    if( this.blocks[i].wrapper._drawIndex && this.blocks[i].wrapper._drawIndex != i ){

                        this.blocks.lastDraw = null
                    }

                    this.blocks[i].wrapper._drawIndex = i
                }

                i++

            }
        }



        if( this.blocks.length ) {

            this.createTexs( maxLoop )
        }

    }

    getNonFit(){

        let i = 0

        let res = []

        while( i < this.blocks.length ) {

            if(this.blocks[i].fit == null) {

                res.push(this.blocks[i])
            }

            i++
        }

        return res
    }


    resetFit(){

        // let i = 0

        // while(i < this.blocks.length ) {

        //     this.blocks[i].fit = null

        //     delete this.blocks[i].textureIndex

        //     delete this.blocks[i].fit

        //     i++
        // }
    }


    createTexs( max ) {

        let i = 0

        while(i < max + 1 ) {

            if( this.megaTextures[i] == null ) {

                if( this.distanceBased == false || (this.distanceBased == true && i < this.maxTexture ) ){

                    const megaTex = new UpdatableTexture()

                    this.megaTextures.push( megaTex )

                    megaTex.index = this.megaTextures.length

                    this.emit(ATLAS_EVENTS.NEW_TEX, megaTex)

                    if( this.opts?.debug || debug ) {

                        let mesh = new Mesh( new PlaneGeometry(3,3), new MeshBasicMaterial({side: 2,  map: megaTex, transparent: true, alphaTest: 0.01}))

                        mesh.scale.set(-2, 2, 2)
                        Scene.add(mesh)

                        this.debugMeshes.push(mesh)

                        mesh.material.needsUpdate = true
                    }
                }
            }

            i++

        }

        // block.fit.index = this.indexes[block.textureIndex]

        // block.uvScale = {
        //     x: block.w / TEXTURE_SIZE,
        //     y: block.h / TEXTURE_SIZE,

        // }

        // block.uvPos = {
        //     x:  block.fit.x / TEXTURE_SIZE,
        //     y:  block.fit.y / TEXTURE_SIZE
        // }
    }


    load(url) {

      return new Promise((resolve)=>{

          if( this.seen[url] != null ) {

              resolve( this.seen[url].img )

              return
          }


          const ext = url.split('.').pop();

          fetch(url).then(( response )=>{

              if( !response.ok ) {

                  throw new Error(`Failed to fetch image (${response.status}) ${url}`)
              }

              return response.blob()

          }).then(( data )=>{

              if(SUPPORT_BITMAP_LOADING && ext != 'svg'){

                  // decode inside the chain so failures hit the catch below
                  return createImageBitmap(data, {

                      imageOrientation: 'flipY'

                    }).then(( bmp )=>{

                      resolve( bmp )

                    });

              }
              else {

                  this.imgMiddleWare( data ).then( ( img )=>{

                    resolve( img )

                  })
              }
          }).catch(( err )=>{

              // Dead url or undecodable body — resolve null so callers can
              // skip instead of leaving an unhandled rejection
              console.error('[Atlas] failed to load image', url, err)

              resolve( null )
          })
      })
    }

    imgMiddleWare( data ) {

        return new Promise( ( resolve ) => {

            let img = new Image()

            img.onload = () =>{

                resolve( img )
            }

            img.src = URL.createObjectURL(data)
        })
    }

    reset(){

        this.resetFit()

        this.packer.reset()

        this.blocks = []

        let i = 0

        while(i < this.megaTextures.length ) {

            this.megaTextures[i].dispose()

            i++
        }

        i = 0

        while(i < this.debugMeshes.length ) {

            var debugmesh = this.debugMeshes[i]

            Scene.remove(debugmesh)

            debugmesh.geometry.dispose()

            debugmesh.material.dispose()

            debugmesh = null

            i++
        }

        this.debugMeshes = []

        this.megaTextures = []

        this.slotImages = {}
    }
}
