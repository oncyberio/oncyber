// The corridor motor and contact sounds share Oncyber's mute, voice ducking and volume.
export function createHotelSound(audio) {
    const ctx = audio?.context,
        output = audio?.output;
    if (!ctx || !output) return { frame() {}, dispose() {} };
    const motor = ctx.createOscillator(),
        level = ctx.createGain();
    motor.frequency.value = 49;
    level.gain.value = 0.018;
    motor.connect(level).connect(output);
    motor.start();
    let lastStep = -1,
        lastImpact = 0,
        oldAngle = 0;
    function thud(frequency, volume) {
        if (!audio.audible) return;
        const at = ctx.currentTime,
            tone = ctx.createOscillator(),
            envelope = ctx.createGain();
        tone.frequency.setValueAtTime(frequency, at);
        tone.frequency.exponentialRampToValueAtTime(39, at + 0.16);
        envelope.gain.setValueAtTime(0.0001, at);
        envelope.gain.exponentialRampToValueAtTime(volume, at + 0.008);
        envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
        tone.connect(envelope).connect(output);
        tone.onended = () => {
            tone.disconnect();
            envelope.disconnect();
        };
        tone.start(at);
        tone.stop(at + 0.19);
    }
    return {
        frame(pose, angle, dt, walked) {
            const speed =
                dt > 0 ? Math.min(2, Math.abs(angle - oldAngle) / dt) : 0;
            oldAngle = angle;
            motor.frequency.setTargetAtTime(
                49 + speed * 8,
                ctx.currentTime,
                0.14
            );
            level.gain.setTargetAtTime(
                0.018 + speed * 0.02,
                ctx.currentTime,
                0.2
            );
            const stride =
                walked == null
                    ? Math.floor((pose.phase || 0) * 2.5)
                    : Math.floor(walked / 0.68);
            const stepping =
                walked != null ||
                (pose.weights?.WALK || 0) + (pose.weights?.RUN || 0) > 0.4;
            if (stepping && lastStep >= 0 && stride !== lastStep)
                thud(88, 0.085);
            if ((pose.hit || 0) > 0.55 && lastImpact <= 0.55) thud(145, 0.22);
            lastStep = stride;
            lastImpact = pose.hit || 0;
        },
        dispose() {
            motor.stop();
            motor.disconnect();
            level.disconnect();
        },
    };
}
