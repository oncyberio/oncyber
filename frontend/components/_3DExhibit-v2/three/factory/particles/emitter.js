import LinesGenerator from './index.js'

import {

	DEBUG

} from '@3constants'

import gui from '@3gui'

let defaultBoxRange = 3

let defaultOptions = {

	count			:  150,

	res 			: [ 5, 6, 7, 9, 12 ],

	width 			: [   1, 1.5, 2  ],

	colors 			: [ [ 0.775, 0.693, 0.0], [0.775, 0.512, 0.081], [0.675, 0.712, 0.281] ],

	speed  			: [ 1, 1.25, 1.75, 2],

	direction 	: {x: -1, y: -0.1, z: -1},

	spawnPosition		:  {x: 0, y: 0, z: 0},

	decay			: [0.2, 0.25, 0.3],

	respawnBox 		: {

		min : {
			x: -defaultBoxRange,
			y: -defaultBoxRange,
			z: -defaultBoxRange 
		},

		max: {

			x: defaultBoxRange,
			y: defaultBoxRange,
			z: defaultBoxRange
		}
	}

}

let noiseOptions = {

	offset : 0.22,
	noiseForce: 0.005,
	domainScale: 0.350,
	windInfluence : 0.0,
	simplexSeed : 1.29
}

import {

	Object3D,

	Vector3,

	Scene

} from 'three'


// var SimplexNoise = require('simplex-noise');

import SimplexNoise from 'simplex-noise'


var	simplex = new SimplexNoise(noiseOptions.simplexSeed)

const eps 		= 0.0001

import Emitter from '@3emitter'

import Events  from '@3events'

const baseObject = new Object3D()

const particleObject = new Object3D()

baseObject.add(particleObject)

const tempv3 = new Vector3()

const sc = new Scene()

sc.add(baseObject)


export default class ParticleEmitter {

	constructor( opts = {} ){

		
		let options     	= Object.assign( {}, defaultOptions)

		this.options    	= Object.assign( options, opts)

		if( DEBUG ){

			this.folder = gui.folders.lines

			let direction = this.folder.addFolder('direction')
			direction.add(this.options.direction, 'x', -1, 1).step(0.01).name('x')
			direction.add(this.options.direction, 'y', -1, 1).step(0.01).name('y')
			direction.add(this.options.direction, 'z', -1, 1).step(0.01).name('z')
			
			let spawnposition = this.folder.addFolder('spawnposition')
			spawnposition.add(this.options.spawnPosition, 'x', -10, 10).step(0.01).name('x')
			spawnposition.add(this.options.spawnPosition, 'y', -10, 10).step(0.01).name('y')
			spawnposition.add(this.options.spawnPosition, 'z', -10, 10).step(0.01).name('z')
			

			let noise = this.folder.addFolder('noise')

			noise.add(noiseOptions, 'offset', 0, 1).step(0.01)
			noise.add(noiseOptions, 'noiseForce', 0, 0.2).step(0.01)
			noise.add(noiseOptions, 'domainScale', 0, 1).step(0.01)
			noise.add(noiseOptions, 'windInfluence', 0, 1).step(0.01)
			noise.add(noiseOptions, 'simplexSeed', 0, 5).step(0.01).onChange((val)=>{

				simplex = new SimplexNoise(noiseOptions.simplexSeed)

			})


		}


		this.buildOptions 	= this.builder() 

		this.mesh 			= LinesGenerator.get( this.buildOptions  )

		this.geometry 		= this.mesh.geometry

		this.timer 			= 0

		let i = 0

		while( i < this.options.count ){

			this.resetPosition(i)

			this.resetDecaying(i, true)

			i++
		}

		this.isPlaying = false
	}

	play(){

		if( this.isPlaying ) {

			return
		}

		this.isPlaying = true

		// this.mesh.material.show()

		if( this.updateEvent == null ) {

			this.updateEvent = this.update.bind(this)

			Emitter.on(Events.PRE_UPDATE, this.updateEvent)
		}
	}

	stop(){

		if( this.isPlaying == false ) {

			return
		}

		this.isPlaying = false

		if ( this.updateEvent ) {

			Emitter.off(Events.PRE_UPDATE, this.updateEvent)

			this.updateEvent = null
		}


	}

	update( delta ){


		// this.timer += e * 200.0;

		let i = 0

		let pos;

		let life;

		let value3D;

		// this.mesh.rotation.y += delta * 0.1


		while(i <  this.options.count ){

			this.updateLife(i, delta)

			if( this.getLife(i) < 0  ){

				if( this.getDecaying(i) < 0 ) {

					this.setLife(i, 1)

					this.resetDecaying(i)

					this.resetPosition(i)
				}
				else {

					this.updateDecaying(i, 0.2)

					pos = this.geometry.getPosition(i)

					pos.x += this.options.direction.x * this.getSpeed(i) * delta
					pos.y += this.options.direction.y * this.getSpeed(i) * delta
					pos.z += this.options.direction.z * this.getSpeed(i) * delta


					this.computeCurl(pos.x, pos.y, pos.z, pos);

					this.geometry.update( i, pos )
				}
				
			}
			else {

				pos = this.geometry.getPosition(i)

				particleObject.position.copy(pos)

				baseObject.rotation.y += 1 * delta

				particleObject.getWorldPosition(tempv3)

				baseObject.rotation.y = 0

				pos.x = tempv3.x
				pos.y = tempv3.y
				pos.z = tempv3.z

				this.computeCurl(pos.x, pos.y, pos.z, pos);

				tempv3.copy(pos)

				var l = tempv3.length()

				const limit = 1

				if( l < limit ){

					tempv3.multiplyScalar(1.01)

				}

				pos.x = tempv3.x
				pos.y = tempv3.y
				pos.z = tempv3.z

				this.geometry.update( i, pos )

				this.updateDecaying(i, -0.2)

			}

			i++
		}


		// var x = 1 * Math.sin(Math.PI * 2 * this.timer / 360);
		// var y = 1 * Math.cos(Math.PI * 2 * this.timer / 360);

		// this.geometry.update( 0, {x : x, y: y, z: 0} )


		// x = 0.5 * Math.sin(Math.PI * 2 * this.timer * 1.25 / 360);
		// y = 0.5 * Math.cos(Math.PI * 2 * this.timer * 1.25 / 360);

		// this.geometry.update( 1, {x : x, y: -y, z: 0.5} )

		// x = 0.7 * Math.sin(Math.PI * 2 * this.timer * 1.5 / 360)
		// y = 0.7 * Math.cos(Math.PI * 2 * this.timer * 1.5 / 360)

		// this.geometry.update( 2, {x : -x, y: y, z: 2} )

		// x = 1 * Math.sin(-Math.PI * 2 * this.timer * 1.5 / 360)
		// y = 1 * Math.cos(Math.PI * 2 * this.timer * 1.5 / 360)

		// this.geometry.update( 3, {x : -x, y: y, z: 2.5} )


		// x = 1.2 * Math.sin(Math.PI * 2 * this.timer * 1.5 / 360)
		// y = 1.2 * Math.cos(-Math.PI * 2 * this.timer * 1.5 / 360)

		// this.geometry.update( 4, {x : -x, y: y, z: 3} )

	}

	updateLife(i, delta){

		this.buildOptions.life[i] -= this.buildOptions.decay[i] * delta

	}

	setLife(i, val){

		this.buildOptions.life[i] = val
	}

	getLife(i){

		return this.buildOptions.life[i]
	}

	getSpeed(i){

		return this.buildOptions.speed[i]
	}

	resetDecaying(i, force = null){

		// if(force == null){

		// 	this.buildOptions.decaying[i] = this.buildOptions.res[i]
		// }

		// else {

		// 	this.buildOptions.decaying[i] = Math.floor( Math.random() * this.buildOptions.res[i] )
		// }

		this.buildOptions.maxDecaying[i] = Math.random() * this.buildOptions.res[i]

		this.buildOptions.decaying[i] = 0

		this.buildOptions.decay[ i ] = this.options.decay[ Math.floor( Math.random() * this.options.decay.length ) ]
	

		this.geometry.updateAllLifeAtIndex(i,1)
	}

	updateDecaying(i, val = 0.2 ){

		this.buildOptions.decaying[i] -= val

		this.buildOptions.decaying[i] = Math.min( this.buildOptions.maxDecaying[i], this.buildOptions.decaying[i] )

		const range = Math.min( 1.0,  Math.max(0.0, 1 / (this.buildOptions.res[i] ) * this.buildOptions.decaying[i]))

		this.geometry.updateAllLifeAtIndex( i, range )

		// if(i == 0){

		// 	// console.log(i, this.buildOptions.decaying[i])
		// }
	}

	getDecaying(i){

		return this.buildOptions.decaying[i]
	}

	resetPosition(i){

		this.buildOptions.spawns[i] = this.getRespawnPosition()

		this.geometry.updateAllPosAtIndex(i, this.buildOptions.spawns[i] )
	}

	builder( ){

		let configOptions = {

			count  : this.options.count,
			res    : [ ],
			width  : [ ],
			colors : [ ],
			speed  : [ ],
			life   : [ ],
			decay  : [ ],
			decaying  : [ ],
			maxDecaying: [ ],
			spawns : [ ] 

		}

		let i = 0

		while( i < this.options.count ){

			configOptions.res.push(   this.options.res[ 		Math.floor( Math.random() *this.options.res.length ) ]   )
			configOptions.width.push(    this.options.width[ 	Math.floor( Math.random() *this.options.width.length ) ] )
			configOptions.colors.push(   this.options.colors[ 	Math.floor( Math.random() *this.options.colors.length ) ] )
			configOptions.speed.push(    this.options.speed[ 	Math.floor( Math.random() *this.options.speed.length ) ] )
			configOptions.life.push( 0 )
			configOptions.decay.push( this.options.decay[ 	Math.floor( Math.random() *this.options.decay.length - Math.random() * 2 ) ] )
			configOptions.spawns.push( {x: 0, y:0, z: 0} )
			configOptions.decaying.push(0)
			configOptions.maxDecaying.push(0)

			i++
		}

		return configOptions
	}

	getRespawnPosition(){

		return {

			x: this.options.spawnPosition.x + ( Math.random() * (this.options.respawnBox.max.x - this.options.respawnBox.min.x) ) + this.options.respawnBox.min.x,
			y: this.options.spawnPosition.y + ( Math.random() * (this.options.respawnBox.max.y - this.options.respawnBox.min.y) ) + this.options.respawnBox.min.y,
			z: this.options.spawnPosition.z + ( Math.random() * (this.options.respawnBox.max.z - this.options.respawnBox.min.z) ) + this.options.respawnBox.min.z
		}
	}

	computeCurl(xx, yy, zz, res){

	  let x = xx * noiseOptions.domainScale;
	  let y = yy * noiseOptions.domainScale;
	  let z = zz * noiseOptions.domainScale;
	 

	  //Find rate of change in YZ plane
	  var n1 = simplex.noise3D(x, y + eps, z); 
	  var n2 = simplex.noise3D(x, y - eps, z); 
	  //Average to find approximate derivative
	  var a = (n1 - n2)/(2 * eps);
	  var n1 = simplex.noise3D(x, y, z + eps); 
	  var n2 = simplex.noise3D(x, y, z - eps); 
	  //Average to find approximate derivative
	  var b = (n1 - n2)/(2 * eps);
	  res.x += (a - b) * noiseOptions.noiseForce;

	  //Find rate of change in XZ plane
	  n1 = simplex.noise3D(x, y+ noiseOptions.offset, z + eps); 
	  n2 = simplex.noise3D(x, y+ noiseOptions.offset, z - eps); 
	  //Average to find approximate derivative
	  a = (n1 - n2)/(2 * eps);
	  n1 = simplex.noise3D(x + eps, y+ noiseOptions.offset, z); 
	  n2 = simplex.noise3D(x + eps, y+ noiseOptions.offset, z); 
	  //Average to find approximate derivative
	  b = (n1 - n2)/(2 * eps);
	  res.y += (a - b) * noiseOptions.noiseForce;

	  //Find rate of change in XY plane
	  n1 = simplex.noise3D(x + eps, y, z+ noiseOptions.offset); 
	  n2 = simplex.noise3D(x - eps, y, z+ noiseOptions.offset); 
	  //Average to find approximate derivative
	  a = (n1 - n2)/(2 * eps);
	  n1 = simplex.noise3D(x, y + eps, z+ noiseOptions.offset); 
	  n2 = simplex.noise3D(x, y - eps, z+ noiseOptions.offset); 
	  //Average to find approximate derivative
	  b = (n1 - n2)/(2 * eps);
	  res.z += (a - b) * noiseOptions.noiseForce;

	}
}