import { MeshStandardNodeMaterial } from 'three/webgpu'

import { normalLocal } from 'three/tsl'

import { biplanarMaterial } from './biplanar.js'

// datNormal = normal (object space)
const LightingMaterial = biplanarMaterial( MeshStandardNodeMaterial, () => normalLocal )

export default LightingMaterial
