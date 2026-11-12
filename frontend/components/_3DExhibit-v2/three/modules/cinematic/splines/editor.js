import Splines from './splines.js'

import {

	Object3D,

	Vector3

} from 'three'

import{

	DEBUG,

	DEBUG_VIEW

} from '@3constants'

import gui from '@3gui'

import Emitter from '@3emitter'

import Events from '@3events'

import Scene from '@3scene'

import Camera from '@3camera'

import AugmentedObject from '@3abstract/augmentedobject'

const worldDirection = new Vector3()

export default class SplineEditor extends AugmentedObject {

	constructor(){

		super()

		this.reloadSplineEvent = this.reloadSpline.bind(this) 

		this.selected 		= 0

		this.selectedPoint 	= 0

		this.loadedSplines 	= []

		this.far 			= 5

		this.guiAdded  	= false

		if( DEBUG ) {

			window.splineEditor = this
		}

		this.init()
	}

	init(){

		this.currentSplines = null

		if(DEBUG){

			window.pp = this
		}

		Scene.add(this)

		this.addEvents()
	}

	loadCurves( curves ){

		let i = 0

		while(i < curves.length ) {

			this.loadCurve(curves[i])

			i++
		}

		this.select( 0 )
	}

	loadCurve( curve ){

		this.loadedSplines.push( 

			{ 
				position 	:  new Splines(curve.position, 	0 ),

				lookAt 		:  new Splines(curve.lookAt, 	1 ),

				duration 	: curve.duration
			} 
		)

	}

	removeCurve( id ) {

		console.log('REMOVE CURVE ', id)

		this.unselect() 

		this.loadedSplines.splice( id, 1 )

		console.log( this.currentSplines )
		console.log( this.currentSplines )
		console.log( this.currentSplines )
		console.log( this.currentSplines )

		this.currentSplines.position.destroy()

		this.currentSplines.lookAt.destroy()

		this.currentSplines = null
	}

	setDuration( duration ){

		this.loadedSplines[this.selected].duration = duration
	}


	select( id ){

		console.log('SELECT ')
		
		this.unselect()

		this.selected = id

		this.currentSplines = this.loadedSplines[ this.selected ]

		this.add(this.currentSplines.position)

		this.add(this.currentSplines.lookAt)

		this.positionSpline = this.currentSplines.position

		this.lookAtSpline 	= this.currentSplines.lookAt

		this.positionSpline.on( 'reload', this.reloadSplineEvent )

		this.lookAtSpline.on( 	'reload', this.reloadSplineEvent )

		this.updateSelectionGui()

	}

	unselect(){

		if( this.currentSplines ) {

			this.remove(this.currentSplines.position)

			this.remove(this.currentSplines.lookAt)
		}

		if( this.positionSpline != null ){

			this.positionSpline.off('reload', this.reloadSplineEvent )

			this.lookAtSpline.off('reload', this.reloadSplineEvent )
		}
	}

	getSelection(e){

		return {

			position : this.positionSpline.positions[this.selectedPoint],

			lookAt   : this.lookAtSpline.positions[this.selectedPoint]
		}
	}

	reloadSpline( e ){

		e.curve.setPosition( e.points )

		this.emit('reload')
	}	

	cinematicRender(e){

		this.visible  = !e
	}


	destroy(){

		let i = 0

		while(i < this.currentSplines.length){

			this.remove(this.currentSplines[i])

			this.currentSplines[i].destroy()

			this.currentSplines[i] = null

			i++
		}	

		this.currentSplines = []

		this.currentSplines = null


		this.loadedSplines  = []

		this.loadedSplines  = null


		this.removeEvents()

	}

	addEvents(){

		if(this.cinematicRender == null){

			this.cinematicRenderEvent = this.cinematicRender.bind(this)

			Emitter.on( Events.CINEMATIC_RENDER, this.cinematicRenderEvent)
		}
	}

	removeEvents(){

		if( this.cinematicRenderEvent ){

			Emitter.off( Events.CINEMATIC_RENDER, this.cinematicRenderEvent)

			this.cinematicRenderEvent = null
		}
	} 

	setFromCameraSelection(){

		let pos 	= Camera.cinematic.editcamera.position.clone()

		Camera.cinematic.editcamera.getWorldDirection(worldDirection)

		let range = 1

		let lookat = pos.clone()

		lookat.set(

			pos.x + worldDirection.x * this.far,

			pos.y + worldDirection.y * this.far,

			pos.z + worldDirection.z * this.far
		)

		this.positionSpline.setPointFromCameraWithSelection( this.selectedPoint, pos )

		this.lookAtSpline.setPointFromCameraWithSelection( this.selectedPoint, lookat )

	}

	addFromCamera(){

		let pos 	= Camera.cinematic.editcamera.position.clone()

		Camera.cinematic.editcamera.getWorldDirection(worldDirection)

		let range = 1

		let lookat = pos.clone()

		lookat.set(
			pos.x + worldDirection.x * this.far,
			pos.y + worldDirection.y * this.far,
			pos.z + worldDirection.z * this.far
		)

		this.positionSpline.addPointFromCamera(pos)

		this.lookAtSpline.addPointFromCamera(lookat)

		this.selectedPoint = this.positionSpline.splinePointsLength - 1

		this.updateSelectionGui()

		this.emit('selection')
	}

	addKeyGui( folder ){

		this.folder = folder

		this.guiAdded = true

		this.updateSelectionGui()
	}

	// this.splineFolder.add(options, 'currentKey', 'key').name('key')
		// 	.onUpdate((val)=>{

		// 	})

	removePoints(){

		if( this.positionSpline.splinePointsLength == 4 ) {

			return
		}

		var selected = this.selectedPoint

		this.positionSpline.removePoint()

		this.lookAtSpline.removePoint()

		selected = Math.min( selected, this.positionSpline.splinePointsLength )

		selected = Math.max(selected - 1, 0)

		this.updateSelectionGui(  selected )
	}

	addPoint(){

		this.positionSpline.addPoint()

		this.lookAtSpline.addPoint()

		this.updateSelectionGui( this.positionSpline.splinePointsLength - 1 )
	}


	updateSelectionGui( force = null ){

		if(this.guiAdded){

			if( force != null ){

				this.selectedPoint = force
			}
			
			var possibilities = []

			let i = 0

			while(i < this.positionSpline.splinePointsLength){

				possibilities.push(""+i+"")

				i++
			}


			var selection =
			{
			    point: this.selectedPoint < this.positionSpline.splinePointsLength ? this.selectedPoint : possibilities[0]
			}

			if( this.selectionGUI == null ) {


				this.selectionGUI = this.folder.add( selection, 'point', possibilities ).name('Key').onUpdate((val)=>{

					this.selectedPoint = parseInt(val)

					this.emit('selection')

				})	
			}

			else {

				this.selectionGUI.update( selection, 'point', possibilities  )
			}

		}

		
	}

	export(){

		let i = 0

		const ll = this.loadedSplines.length

		var exp = '{ "export" : ['

		while(i < ll ) {

			exp += '{'

			exp += '"duration" : '  + this.loadedSplines[i].duration

			exp += ','

			exp += this.loadedSplines[i].position.curve.export()

			exp += ','
			
			exp += this.loadedSplines[i].lookAt.curve.export()

			exp += '}'

			if( i !=  ll -1 ) {

				exp += ','
			}


			i++
		}

		exp += "] }"

		return exp
	}
}