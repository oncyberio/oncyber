import { MeshBasicNodeMaterial } from 'three/webgpu'

import { modelWorldMatrix, normalLocal, varying, vec4 } from 'three/tsl'

import { biplanarMaterial } from './biplanar.js'

// datNormal = mat3( modelMatrix ) * normal (not normalised)
const DiffuseMaterial = biplanarMaterial( MeshBasicNodeMaterial, () =>

    varying( modelWorldMatrix.mul( vec4( normalLocal, 0.0 ) ).xyz )
)

export default DiffuseMaterial
