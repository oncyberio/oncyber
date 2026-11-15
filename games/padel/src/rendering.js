import * as THREE from "three";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { graphicsProfile, supportedSamples } from "./graphics-quality.js";

/** One scene render, then edge cleanup and color output; UI stays native DOM. */
export function createCourtRenderer(renderer) {
  const gl = renderer.getContext();
  const hdr = renderer.extensions.has("EXT_color_buffer_float");
  const type = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const availableSamples = gl.getInternalformatParameter(
    gl.RENDERBUFFER,
    hdr ? gl.RGBA16F : gl.RGBA8,
    gl.SAMPLES
  );
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
    type,
    depthBuffer: true,
    stencilBuffer: false,
  });
  sceneTarget.texture.name = "Padel multisampled scene";
  const smoothedTarget = new THREE.WebGLRenderTarget(1, 1, {
    type,
    depthBuffer: false,
    stencilBuffer: false,
  });
  smoothedTarget.texture.name = "Padel smooth edges";
  const smoothing = hdr ? new SMAAPass() : new FXAAPass();
  smoothing.renderToScreen = !hdr;
  const output = new OutputPass();
  output.renderToScreen = true;
  const size = new THREE.Vector2();
  let profile = graphicsProfile("high", 1, 1),
    useSmoothing = true,
    disposed = false;
  return {
    resize(width, height, mode, deviceRatio, scale = 1) {
      if (disposed) return profile;
      profile = graphicsProfile(mode, width, height, deviceRatio, scale);
      const samples = supportedSamples(availableSamples, profile.samples);
      if (sceneTarget.samples !== samples) {
        sceneTarget.dispose();
        sceneTarget.samples = samples;
      }
      renderer.setPixelRatio(profile.pixelRatio);
      renderer.setSize(width, height, false);
      renderer.getDrawingBufferSize(size);
      sceneTarget.setSize(size.x, size.y);
      // Keep shader AA as a fallback when multisampling isn't supported.
      useSmoothing = profile.edgeSmoothing || samples === 0;
      smoothedTarget.setSize(
        useSmoothing ? size.x : 1,
        useSmoothing ? size.y : 1
      );
      smoothing.setSize(useSmoothing ? size.x : 1, useSmoothing ? size.y : 1);
      renderer.domElement.dataset.graphics = JSON.stringify({
        mode: profile.name,
        samples,
        smoothing: useSmoothing ? (hdr ? "SMAA" : "FXAA") : "MSAA",
        pixelRatio: Number(profile.pixelRatio.toFixed(2)),
        width: size.x,
        height: size.y,
      });
      return profile;
    },
    render(scene, camera) {
      if (disposed) return;
      renderer.setRenderTarget(sceneTarget);
      renderer.render(scene, camera);
      if (useSmoothing && !hdr) {
        // FXAA expects display colors; SMAA expects the linear HDR scene.
        output.renderToScreen = false;
        output.render(renderer, smoothedTarget, sceneTarget);
        smoothing.render(renderer, null, smoothedTarget);
      } else {
        output.renderToScreen = true;
        if (useSmoothing)
          smoothing.render(renderer, smoothedTarget, sceneTarget);
        output.render(
          renderer,
          null,
          useSmoothing ? smoothedTarget : sceneTarget
        );
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      sceneTarget.dispose();
      smoothedTarget.dispose();
      smoothing.dispose();
      output.dispose();
    },
  };
}
