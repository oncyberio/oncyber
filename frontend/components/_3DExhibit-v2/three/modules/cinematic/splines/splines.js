import {

	BoxGeometry,

	Vector3,

	BufferGeometry,

	BufferAttribute,

	CatmullRomCurve3,

	Line,

	LineBasicMaterial,

	MeshBasicMaterial,

	Mesh

} from 'three'

import {

	DEBUG,

	CANVAS

} from '@3constants'

import Camera from '@3camera'

import { DragControls } from "three/examples/jsm/controls/DragControls"

import { TransformControls } from "@3factory/controls/transformcontrols.js";

import Emitter from '@3emitter'

import Events from '@3events'



var ARC_SEGMENTS = 250

var geometry = new BoxGeometry( 0.25 , 0.25, 0.25 )

var point = new Vector3()

import AugmentedObject from '@3abstract/augmentedobject'

export default class Splines extends AugmentedObject {

	constructor( curve, id = 0 ){

		super()

		this._id = id

		this.curve = curve

		this.points = curve.positions

		this.splinePointsLength = 4;

		this.splineHelperObjects = []

		this.hiding = null

		this.previousEnabled = false

		this.positions = []

		let i = 0

		while( i < this.splinePointsLength ) {

			this.addSplineObject( this.positions[ i ] )

			i++
		}

		i = 0

		while( i < this.splinePointsLength ) {

			this.positions.push( this.splineHelperObjects[ i ].position );

			i++
		}

		var linegeo = new BufferGeometry()

		linegeo.setAttribute( 'position', new BufferAttribute( new Float32Array( ARC_SEGMENTS * 3 ), 3 ) );

		// this.spline = this.curve.catmull

		this.mesh = new Line( linegeo, new LineBasicMaterial( {

			color: this._id == 0 ? 0x00ff00 : 0x0000ff,
			// color: 0xff0000,

			opacity: 1.0,

			linewidth: 4

		} ) )

		this.add( this.mesh )

		this.load( this.points )

		this.addControls()

		this.reload()

	}

	addPointFromCamera(pos){

		this.splinePointsLength ++

		this.positions.push( this.addSplineObject(pos).position  )

		this.reload()
	}

	addPoint() {
		
		this.splinePointsLength ++
		
		this.positions.push( this.addSplineObject().position );

		this.reload()
	}

	addSplineObject( position ) {

		var material = new MeshBasicMaterial( { color:  this._id == 0 ? 0x00ff00 : 0x0000ff } )

		var object = new Mesh( geometry, material )

		if ( position ) {


			object.position.copy( position )

		} else {

			var last = this.positions[this.positions.length - 1]


			if(last){

				object.position.x = last.x + Math.random() * 1 - 0.5
				object.position.y = last.y + Math.random() * 1 - 0.5
				object.position.z = last.z + Math.random() * 1 - 0.5

			}

			else{

				object.position.x = Math.random() * 1 - 0.5
				object.position.y = Math.random() * 1 - 0.5
				object.position.z = Math.random() * 1 - 0.5

			}
		}

		this.add( object )

		this.splineHelperObjects.push( object )


		return object
	}

	load( new_positions ) {


		while ( new_positions.length > this.positions.length ) {

			this.addPoint()
		}

		while ( new_positions.length < this.positions.length ) {

			this.removePoint()
		}

		let i = 0

		while(i < this.positions.length ){

			this.positions[ i ].x = new_positions[ i ][0]

			this.positions[ i ].y = new_positions[ i ][1]

			this.positions[ i ].z = new_positions[ i ][2]


			i++
		}

		this.updateSplineOutline()
	}

	removePoint() {

		if ( this.splinePointsLength <= 4 ) {

			return
		}

		this.splinePointsLength --

		this.positions.pop()

		this.remove( this.splineHelperObjects.pop() )

		this.reload()

		// this.updateSplineOutline()
	}

	reload(){

		var pp = []

		let i = 0

		while( i <  this.splinePointsLength ) {

			let current = this.splineHelperObjects[i]

			if(current != null){

				pp.push( [ current.position.x ,  current.position.y , current.position.z ]);
			}

			i++
		}

		this.emit('reload', {curve: this.curve, points: pp})

		this.updateSplineOutline()
	}

	setPointFromCameraWithSelection( index, vec ){

		this.positions[index].copy(vec)

		this.reload()
	}

	updateSplineOutline() {

		var position = this.mesh.geometry.attributes.position

		let i = 0

		let point;

		while(i < ARC_SEGMENTS ) {

			var t = i /  ( ARC_SEGMENTS - 1 )

			point = this.curve.getPoints( t )

			position.setXYZ( i, point.x, point.y, point.z )

			i++
		}

		position.needsUpdate = true
	}
	
	save() {

		const data = {}

		data[this._id] = []

		let i = 0

		while(i < this.splinePointsLength ) {

			var p = this.splineHelperObjects[ i ].position

			data[this._id].push([p.x,p.y,p.z])

			i++

		}

		return data
	}

	delayHideTransform() {

		this.cancelHideTransorm()

		this.hideTransform()

	}
	hideTransform() {

		this.hiding = setTimeout( ()=> {

			this.transformControl.detach( this.transformControl.object )

		}, 2500 )

	}
	cancelHideTransorm() {

		if ( this.hiding ) clearTimeout( this.hiding );
	}

	updateControls = ()=> {

		if (this.visible == false) return

		this.transformControl?.updateMatrixWorld(true)
	}
		

	addControls(){

		this.transformControl 			= new TransformControls( Camera.cinematic.editcamera, CANVAS )

		this.dragControls 		 		= new DragControls( this.splineHelperObjects, Camera.cinematic.editcamera, CANVAS )

		Emitter.on( Events.PRE_UPDATE, this.updateControls)

		this.transformControl.addEventListener( 'dragging-changed', ( event )=> {

			console.log(event)

			if(this.visible == false){
				return
			}

			if( Camera.current.controls ){

				Camera.current.controls.enabled = !event.value

				console.log( Camera.current.controls.enabled )

			}

			this.reload()

		} )

		this.add( this.transformControl )


		this.transformControl.addEventListener( 'change', ( e )=> {
			if(this.visible == false){
				return
			}
			this.cancelHideTransorm()

		} )

		this.transformControl.addEventListener( 'mouseDown', ( e )=> {

			if(Camera.current.controls && Camera.current.controls.enabled == true){

				this.previousEnabled = Camera.current.controls.enabled

				Camera.current.controls.enabled = false
			}

			if(this.visible == false){
				return
			}
			this.cancelHideTransorm()

		} )

		this.transformControl.addEventListener( 'mouseUp', ( e )=> {

			if( Camera.current.controls ){

				Camera.current.controls.enabled = Camera.current.controls.enabled

				// this.previousEnabled = false
			}

			if(this.visible == false){
				return
			}
			this.delayHideTransform()

		} )

		this.transformControl.addEventListener( 'objectChange', ( e )=> {
			if(this.visible == false){
				return
			}

			console.log("objectChange", e)

			this.reload()

			// this.updateSplineOutline()

		} )



		this.dragControls.addEventListener( 'hoveron', ( event )=> {
			if(this.visible == false){
				return
			}
			this.transformControl.attach( event.object )


			this.cancelHideTransorm()

		} )

		this.dragControls.addEventListener( 'hoveroff', ( event )=> {
			if(this.visible == false){
				return
			}
			this.delayHideTransform()
		} )
		
	}

	destroy(){

		Emitter.off( Events.PRE_UPDATE, this.updateControls)

		if(this.transformControl) {

			this.transformControl.dispose()

			this.transfomControl = null
		}

		if(this.dragControls){

			this.dragControls.dispose()

			this.dragControls = null

		}

		this.traverse( (child)=>{

			if(child.geometry){

				child.geometry.dispose()
				
				child.material.dispose()
			}
		} )

	}

}
