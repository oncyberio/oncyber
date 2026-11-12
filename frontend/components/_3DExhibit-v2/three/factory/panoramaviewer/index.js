import Mesh from './mesh'

class PanoramaFactory {

	constructor(){
		this.mesh = new Mesh()
	}

	get( texture ){
		this.mesh.material.map = texture
		this.mesh.reset()
		return this.mesh
	}
}
export default new PanoramaFactory()
