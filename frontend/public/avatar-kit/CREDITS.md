# Avatar Studio model credits

Atelier is derived from **VRM1_Constraint_Twist_Sample v1.0.1**, © 2022 pixiv Inc. [Original model](https://github.com/pixiv/three-vrm/blob/3caf7a21ee68f0d5dfa363ab3d577450bbf60136/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm)

Relay is derived from **Seed-san**, © VirtualCast, Inc. Credit is required for this model and its derivatives. [Bundled source](../models/Seed-san.vrm)

Both authors permit modification, redistribution, and corporate commercial use under the VRM Public License 1.0. Each model's embedded metadata contains the author's specific permissions and conditions and is included in every downloaded VRM. [License](https://vrm.dev/licenses/1.0/)

Oncyber added jaw, eye, hair and torso morphs, dyeable painted materials, vertex shading and selectable outfit variants. The four starter portraits are rendered from these models.

## Rebuilding the kits

Use Python 3.10 or later with NumPy, Pillow and the DejaVu Sans Bold font. From the repository root, run the following command with the original pixiv file downloaded from the link above.

```sh
python frontend/scripts/prepare-avatar-kit.py VRM1_Constraint_Twist_Sample.vrm frontend/public/models/Seed-san.vrm
```

The script checks both source hashes and writes a content-addressed binary and a glTF manifest per rig. Avatar Studio edits the rig in memory. The lobby loads the same choices from a versioned recipe URL. The VRM download embeds the shared binary for use offline.
