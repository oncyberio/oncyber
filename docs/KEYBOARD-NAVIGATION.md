# Gallery keyboard navigation

Updated 2026-09-17. Desktop walking and flying controls use ↑/↓ for forward/backward and ←/→ for yaw. Left/right can be held while walking, or used to turn in place. A/D remain strafe controls. The shared keyboard turn helper runs at 90 degrees per second, preserves camera pitch, and bounds long frames after suspension. Third-person controls apply the same angle through the orbit camera. Keyboard state is cleared by the existing pause and control teardown paths.

The navigation hints and English, Japanese, Korean, and Chinese help text reflect the new mapping. Existing gallery entry and access checks still apply.

Validation: nine focused Jest regressions passed for walking/flying, simultaneous movement and turning, key release, opposing keys, pause/deactivation, pitch, third-person orbit, and 30/60/144 FPS. A fresh local Chrome session in Cologne Dude passed six live checks with pointer lock unavailable: turn direction, no strafing during a stationary turn, walking while turning, stopping rotation on release, ignoring arrows in a focused input, and no mouse capture. There were no uncaught page errors. The browser report is `/private/tmp/oncyber-gallery-maintenance/arrow-navigation-browser.json`.

Deployment: prepared in the existing preview bundle at `/private/tmp/oncyber-gallery-maintenance/web-preview`. Upload is awaiting explicit approval after automatic review limited the previous preview-upload approval to the OpenSea fix. The current `cyber-h169zn3cf-oncyber.vercel.app` preview does not yet contain this change.
