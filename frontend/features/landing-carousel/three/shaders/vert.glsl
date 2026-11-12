uniform vec2 center;
uniform vec2 cardSize;
uniform float radius;
varying vec2 vUv;

void main() {
    vUv = uv;
    vec2 point = center + position.xy * cardSize;
    float angle = point.x / radius;
    vec3 curved = vec3(radius * sin(angle), point.y, radius * (cos(angle) - 1.0));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(curved, 1.0);
}
