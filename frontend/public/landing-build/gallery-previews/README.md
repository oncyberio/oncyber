# Restored gallery previews

Generated on 2026-09-16 with the built-in GPT Image tool, using each original room preview as the edit target. These are AI-restored previews, not new captures of the 3D rooms.

The prompts request approximately 4K; the tool returned the native dimensions below. The assets preserve those dimensions without artificial enlargement. WebP encoding uses Sharp quality 95 and effort 6.

`frontend/utils/destinationCover.ts` shares these assets between the search fallback catalog and Studio. Custom exhibit covers keep priority. Original remote assets are unchanged.

Pages load the `*-gpt-1280.webp` copies: 1280 wide, WebP quality 80, about 25 to 70 KB each instead of 130 to 290 KB. Cards and the details panel never show a cover wider than about 1000 device pixels. The full-size files below stay as the masters.

| Room | Native output | File |
| --- | --- | --- |
| white-cube | 1684 × 934 | `white-cube-gpt.webp` |
| wolfgang-n2 | 1686 × 933 | `wolfgang-n2-gpt.webp` |
| wolfgang-n2-dark | 1699 × 926 | `wolfgang-n2-dark-gpt.webp` |
| loft | 1536 × 1024 | `loft-gpt.webp` |
| classic | 1688 × 932 | `classic-gpt.webp` |



## white-cube

Original: https://cyber.mypinata.cloud/ipfs/QmRCU4ubVd7Dc5Sbz66cXHK4Upfbh62ks8A7UU1pNxWG6b?filename=whitecube_thumb.png



Edit target: the provided White Cube gallery preview. Faithfully restore this blurry 3D architectural render to a crisp high-resolution image, output 3840x2128 landscape. Preserve the exact camera viewpoint, perspective, framing, room layout, every column, skylight beam, rear door, wall, warm oak floor, white materials, sunlight direction and shadow shapes. Recover precise straight architectural edges and believable fine wood grain; remove blur and compression while preserving the restrained original rendered look and original exposure. Deep focus throughout, sharp foreground and background. Do not redesign the architecture or add objects, artworks, people, furniture, lettering, logos or watermarks. This is a faithful quality enhancement of an existing gallery preview, not a new scene.



## wolfgang-n2

Original: https://cyber.mypinata.cloud/ipfs/QmavjvRDD2U4oi7Av8oFm9qLcpiuYC3vKMhsy1TyxMwP1o?filename=embedded.gltf_abr3jo.png



Edit target: the supplied wolfgang-n2 gallery preview. Faithfully enhance this exact image to crisp high-resolution architectural rendering. Preserve the exact camera viewpoint, perspective, framing, aspect ratio, every existing object, architecture, colors, materials and lighting: warm timber-truss ceiling with skylight, white gallery walls, central white partition, wood floor and small rear door. Restore clear edges, clean antialiasing and subtle material detail, removing blur, pixelation and compression noise. Deep focus throughout, never depth-of-field blur. Keep its original designed 3D-render aesthetic. Do not rearrange or redesign anything, change exposure or mood, add people, artwork, furniture, text, logos or watermarks. Output a single image, maximum supported resolution approximately 4K wide, preserving the reference aspect ratio.



## wolfgang-n2-dark

Original: https://cyber.mypinata.cloud/ipfs/QmYsnuWtbtWS8ydktfFmfg8GBRHH1ewSLLqgvC349FLoSt?filename=Wolfgang_2_Dark_by__v64syc.png



Edit target: the supplied wolfgang-n2-dark gallery preview. Faithfully enhance this exact image to crisp high-resolution architectural rendering. Preserve the exact camera viewpoint, perspective, framing, aspect ratio, every existing object, architecture, colors, materials and lighting: dark timber-truss ceiling and skylight, charcoal gray gallery walls, central dark partition, warm parquet floor, sunlight and shadow patches. Restore clear edges, clean antialiasing and subtle material detail, removing blur, pixelation and compression noise. Deep focus throughout, never depth-of-field blur. Keep its original designed 3D-render aesthetic. Do not rearrange or redesign anything, change exposure or mood, add people, artwork, furniture, text, logos or watermarks. Output a single image, maximum supported resolution approximately 4K wide, preserving the reference aspect ratio.



## loft

Original: https://cyber.mypinata.cloud/ipfs/QmdXeezxhLrdo8a7hrhVGd3b3C5rBs8wdfvgZgFXBucUGL?filename=og06_dzcqiz.png



Edit target: the supplied loft gallery preview. Faithfully enhance this exact image to crisp high-resolution architectural rendering. Preserve the exact camera viewpoint, perspective, framing, aspect ratio, every existing object, architecture, colors, materials and lighting: rounded off-white futuristic loft with sculptural white bubble sofas, tan rug, vivid green chaise on the right, low white coffee table, bed in back, hanging white pendant and curved architecture. Restore clear edges, clean antialiasing and subtle material detail, removing blur, pixelation and compression noise. Deep focus throughout, never depth-of-field blur. Keep its original designed 3D-render aesthetic. Do not rearrange or redesign anything, change exposure or mood, add people, artwork, furniture, text, logos or watermarks. Output a single image, maximum supported resolution approximately 4K wide, preserving the reference aspect ratio.



## classic

Original: https://cyber.mypinata.cloud/ipfs/Qmf1pyH1QxLShQe33PSgNVd35VQBZ1wu4nV5cgY967Pivr?filename=BB2.gltf_j6raia.png



Edit target: the supplied classic gallery preview. Faithfully enhance this exact image to crisp high-resolution architectural rendering. Preserve the exact camera viewpoint, perspective, framing, aspect ratio, every existing object, architecture, colors, materials and lighting: close view of industrial sci-fi gallery wall panels with warm spotlights, black open structural column in left-center, orange geometric lower wall trim, yellow and pink lights and cyan-lit floor. Restore clear edges, clean antialiasing and subtle material detail, removing blur, pixelation and compression noise. Deep focus throughout, never depth-of-field blur. Keep its original designed 3D-render aesthetic. Do not rearrange or redesign anything, change exposure or mood, add people, artwork, furniture, text, logos or watermarks. Output a single image, maximum supported resolution approximately 4K wide, preserving the reference aspect ratio.


## altitude

Added for published-gallery search results without an uploaded cover, including legacy `altitude_v2` galleries. Generated with the built-in GPT Image tool; native output 1688 × 932; WebP quality 95, effort 6, no enlargement.

Original: https://cyber.mypinata.cloud/ipfs/QmVNFVRMGHfYX48TR5k6QbSmG7kfHbq4w4N7cD2LWfgjm5?filename=alt_br4on0.png

Edit target: the provided Altitude gallery fallback preview. Faithfully restore this blurry low-detail architectural 3D render to a crisp high-resolution image. Preserve the exact original camera viewpoint, perspective, framing, room layout, rectangular ceiling skylight grid with blue sky, long white gallery walls, freestanding white display partitions including the large foreground partition at right, honey-brown wooden floor and original sunlit shadows. Restore clean antialiased edges and subtle believable wood grain. Preserve the original simple 3D gallery aesthetic, colors, overall exposure, geometry and empty-room appearance. Deep focus throughout, no blur. Do not add art, people, furniture, signage, logos, or architectural features. Single landscape image at maximum supported resolution, preserving the reference aspect ratio. This image is the fallback cover for existing published user galleries whose owners have not supplied a cover; do not invent gallery contents.
