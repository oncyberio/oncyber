
// @ts-check

import { Mesh, MeshBasicMaterial, BoxGeometry } from "three"



import { TYPES } from "@3artwork/constants"


import { ModelSpaceArtwork } from "./modelspaceartwork"












class ModelArtwork {

    /**
     *
     * @param {  import("@gltypes").ArtworkOptions} opts
     * @returns
     */
    async get(opts) {

      const raycastMesh = new Mesh(
        new BoxGeometry(1, 1, 1),
          new MeshBasicMaterial({
              color: "#ffff00",
              opacity: 0.3,
              transparent: true,
          })
      );


        let modelArtwork = new ModelSpaceArtwork({
            ...opts,
            type: TYPES.MODEL,
            raycastMesh,
            resources: [raycastMesh],
      });

        // @ts-ignore

        modelArtwork.userData = {
           ...opts.item.data,
           ...opts.item,
           envmap: opts.item.envmap,
           envmapIntensity: opts.item.envmapIntensity,
        };

        await modelArtwork.load();

        return modelArtwork

    }
}

export default new ModelArtwork()



if (process.env.NODE_ENV === "development") {

    window["$$dlModels"] = async function dlModels(model, base = "model" + Date.now()) {

      const asset = model.userData

      const raw = 
        asset.dcompressed_animation_url || 
        asset.compressed_animation_url || 
        asset.animation_url || 
        asset.animation_original_url || 
        asset.original_animation_url

      const opti = asset.d_optimized_files

      await downloadUrl(raw, base + "-raw.glb")
      await downloadUrl(opti?.high, base + "-opti-high.glb")
      await downloadUrl(opti?.low, base + "-opti-low.glb")
      await downloadUrl(opti?.low_compressed, base + "-opti-low-compressed.glb")
    }


    function downloadUrl(url, name) {

        if (!url) return

        return fetch(url).then((res) => res.blob()).then((blob) => {

            const a = document.createElement("a")

            a.href = URL.createObjectURL(blob)

            a.download = name

            a.click()
        })
        .then(() => {
          //
          console.log("downloaded", name)

          return new Promise((resolve) => setTimeout(resolve, 300))
        })
    }
}