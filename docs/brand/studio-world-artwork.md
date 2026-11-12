# Studio World Settings artwork

Asset: `frontend/public/studio-assets/world-globe.png`.
Generated with the built-in imagegen tool on 5 September 2026 using the user's playful miniature globe reference. The original generations remain in the Codex generated-images directory. The final correction supplies actual alpha transparency rather than a painted checkerboard.

The shared `ComponentsOpt` uses the globe in the Studio asset toolbar. Its existing World Settings label, panel action, keyboard focus and selection indicator remain unchanged. The globe is decorative; there are no profile pictures or badges.

## Generation prompts

Use case: stylized-concept. Asset type: production transparent bitmap for the World Settings button in Oncyber Studio, displayed at 44px on a dark toolbar. Reference: supplied colorful toy planet, visual style reference only. Create one beautifully polished playful 3D miniature globe: luminous cyan/turquoise oceans, softly raised fresh lime-green continents, a few tiny rounded trees and subtle sandy coastline details around the rim. Keep the overall spherical silhouette strong and immediately readable at small size. Smooth tactile toy-like materials, gentle bevels, soft studio lighting, restrained blue-violet rim shading for depth. Single globe centered on a square canvas, fills about 90% of the frame, all edges visible, minimal even padding. Genuine transparent alpha outside the globe, no background scene or tile, no surrounding space gradient. Exclude ALL profile pictures, people, faces, photo bubbles, pins, badges, UI symbols, text, logos, numbers, floating aircraft, balloons or unrelated floating objects. No gears. Focus on the clean colorful globe itself, in the reference's charming miniature-world style, with simplified details suitable for a crisp toolbar image. No watermark.

Final transparency correction:

Use case: background-extraction. Edit target: the generated cyan-and-lime miniature globe image. Keep the globe, trees, colors, lighting and composition unchanged. Remove the entire gray-and-white checkerboard backdrop: those squares are currently painted pixels and must be deleted. Output a cutout PNG with an ACTUAL TRANSPARENT ALPHA CHANNEL around the globe and trees, clean antialiased edges. No white background, no black background, no checkerboard pixels. The globe itself remains opaque. Do not add or remove anything on the globe. This asset must composite cleanly over a dark Studio toolbar.
