import {
	LineSegments,
	BufferGeometry,
	Float32BufferAttribute,
	LineBasicMaterial,
	MeshBasicMaterial,
	Mesh
} from 'three';

class OctreeHelper extends Mesh {

	constructor( octree, color = 0xffff00, meshName = null ) {

		super( new BufferGeometry(), new MeshBasicMaterial( { color: color, transparent: true, opacity: 0.3, toneMapped: false } ) );

		this.octree = octree;
		this.color = color;

		this.type = 'OctreeHelper';

		this.triangles = []

		this.meshName = meshName

		this.update();
		
		window.$$oh = this

	}

	update() {

		const vertices = [];

		this.octree.traverseTriangles( ( triangle ) => {
			if(this.meshName && triangle.meshName != this.meshName) return
			vertices.push( triangle.a.x , triangle.a.y, triangle.a.z)
			vertices.push( triangle.b.x , triangle.b.y, triangle.b.z)
			vertices.push( triangle.c.x , triangle.c.y, triangle.c.z)
		});


		this.geometry.dispose();

		this.geometry = new BufferGeometry();
		this.geometry.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );

	}

	dispose() {

		this.geometry.dispose();
		this.material.dispose();

	}

}

export { OctreeHelper };