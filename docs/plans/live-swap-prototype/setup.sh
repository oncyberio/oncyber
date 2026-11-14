#!/bin/sh
# Copies the three.js r187 build files the prototype needs out of the
# repository's vendored tarball. Run once from this folder.
set -e
here=$(cd "$(dirname "$0")" && pwd)
tgz="$here/../../../vendor/three/three-0.187.0-dev.d90ae4b.tgz"
mkdir -p "$here/rt/three"
tar xzf "$tgz" -C "$here/rt/three" --strip-components=2 \
    package/build/three.webgpu.js package/build/three.core.js package/build/three.tsl.js
echo "three.js copied to rt/three/"
