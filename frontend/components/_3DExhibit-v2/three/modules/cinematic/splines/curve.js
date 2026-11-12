import {

	Vector3,

	CatmullRomCurve3

} from 'three'

import {

	ARC_DIVISIONS

} from './constants'

export default class Curve {
	
	constructor( name, positions, closed = false) {

		this.name = name

		this.positions = positions

		this.closed = closed

		this.vectors = []

		this.catmull = null

		this.createVectors()

		this.load()

	}

	setPosition( positions ){

		this.positions = positions

		this.createVectors()

		this.load()

	}

	createVectors() {

		this.vectors = []

		for (var i = 0; i < this.positions.length; i++) {

			const pos = this.positions[i]

			const v = new Vector3(pos[0], pos[1], pos[2])

			this.vectors.push(v)
		}
	}
	
	load(vectors = null) {

		if( this.catmull != null ) {

			this.catmull = null
		}

		let points = vectors ? vectors : this.vectors

		this.catmull = new CatmullRomCurve3( points, this.closed, 'chordal')

		this.catmull.arcLengthDivisions = ARC_DIVISIONS

		this.catmull.updateArcLengths()

		this.spacedPoints = this.catmull.getSpacedPoints(ARC_DIVISIONS)

	}

	getPoints( progression ){

		if(this.catmull == null){

			// No curve has been built yet; the lookup below will throw.
		}

		let t =
				Math.min(Math.max(
					progression
				, 0.0), 1.0)

		return this.spacedPoints[Math.floor(t * ARC_DIVISIONS)]
	}

	dispose(){

		this.catmull         = null

		this.spacedPoints    = null

		this.vectors         = null
	}

	export(){

		const ll = this.catmull.points.length;

		var exp = '"'+this.name + '" :  [' 
		
		let i = 0

		while(i < ll ){

			exp += '['
			exp += this.catmull.points[i].x
			exp += ','
			exp += this.catmull.points[i].y
			exp += ','
			exp += this.catmull.points[i].z

			exp += ']'

			if( i != ll -1 ){

				exp += ','
			}

			i++
		}

		exp += ']'

		return exp
	}
}
