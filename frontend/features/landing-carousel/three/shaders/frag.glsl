#include <common>
uniform sampler2D map;
uniform float ready;
uniform float opacity;
uniform float imageAspect;
uniform vec2 cardSize;
uniform float hover;
uniform float cornerRadius;
varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    float aspect = cardSize.x / cardSize.y;
    vec3 color = mix(vec3(0.045, 0.052, 0.06), vec3(0.10, 0.115, 0.13), vUv.y);
    if (ready > 0.5) {
        // Object-fit: cover for ordinary landscape and portrait images.
        vec2 fit = vec2(min(1.0, aspect / imageAspect), min(1.0, imageAspect / aspect));
        uv = (vUv - 0.5) * fit * (1.0 - hover * 0.035) + 0.5;
        color = texture2D(map, uv).rgb;
    }
    // The image joins a square caption edge; only its top corners are rounded.
    float rounding = vUv.y > 0.5 ? cornerRadius : 0.0;
    vec2 p = abs((vUv - 0.5) * cardSize) - cardSize * 0.5 + rounding;
    float edge = length(max(p, 0.0)) + min(max(p.x, p.y), 0.0) - rounding;
    float alpha = (1.0 - smoothstep(-0.75, 0.75, edge)) * opacity;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
}
