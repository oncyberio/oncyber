import {

	Mesh,

	Quaternion,

	Color,

	Vector3,
	Matrix4

} from 'three'

// let color = new Color()

let quat = new Quaternion()

let debugMesh = new Mesh()

const AWAY = 100000

export default class InstancedMeshWrapper {

	constructor(mesh, geometry, id, opts ){


		this.mesh = mesh

		this.id = id

		this.geometry = geometry

		this.opts = opts

		if( this.opts.scale){

			this.scale = new Vector3(1, 1, 1)

			this.setScale( this.opts.scale.x, this.opts.scale.y, this.opts.scale.z )
		}

		if( opts.color ){

			this.color = new Color()

			this.setColor( this.opts.color )
		}

		if( this.opts.position ){

			if( this.opts.position[0] ) {

				this.setPosition( {
					x: this.opts.position[0],
					y: this.opts.position[1],
					z: this.opts.position[2]
				} )
			}

			else {

				this.setPosition( {
					x: this.opts.position.x,
					y: this.opts.position.y,
					z: this.opts.position.z
				} )
			}

		}

		else {

			// No position given; the mesh keeps its default position.

		}

		if( this.opts.rotation ){

			this.setRotation( this.opts.rotation )
		}

		if( this.opts.rotationY != null ){

			this.setRotationY( this.opts.rotationY )
		}

		if( this.opts.border != null ) {

			this.setBorder( this.opts.border )
		}

		this._visible = true

	}

	setBorder( val  ){

		this.border = val
	}

	setPosition( val  ){

		this.position = val
	}

	setRotationY(val) {

		this.rotationY = val
	}

	setRotation( val ){

        debugMesh.rotation.x = val.x
		debugMesh.rotation.y = val.y
		debugMesh.rotation.z = val.z

		quat.setFromEuler ( debugMesh.rotation )

		this.rotation = [ quat.x, quat.y, quat.z, quat.w ]
	}

	setQuaternion( val ){

		this.rotation = [ val.x, val.y, val.z, val.w ]
	}

    updateCoords(pos, quat, scale) {

        this.position.x = pos.x
        this.position.y = pos.y
        this.position.z = pos.z

        this.rotation[0] = quat.x
        this.rotation[1] = quat.y
        this.rotation[2] = quat.z
        this.rotation[3] = quat.w;

        this.scale.x = scale.x
        this.scale.y = scale.y
        this.scale.z = scale.z
    }

	setColor( val ){

		this.color.set(val)

	}

	setScale( x,y,z ){

		this.scale.set( x, y, z)
	}

	set visible( val ){

		this._visible = val

	}

	get visible(){

		return this._visible
	}

	getBBox() {

		if( this.mesh.geometry.boundingBox == null) {

			this.mesh.geometry.computeBoundingBox()
		}

		let box = this.mesh.geometry.boundingBox.clone()

		const quat = new Quaternion()

		if (this.rotation) {

			quat.set(this.rotation[0], this.rotation[1], this.rotation[2], this.rotation[3])
		}
		else if (this.rotationY != null) {

			quat.setFromAxisAngle(new Vector3(0, 1, 0), this.rotationY)
		}

		const mat = new Matrix4().compose( this.position, quat, this.scale )

		box.applyMatrix4( mat )

		return box
	}
}
