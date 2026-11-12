# three r187dev

`three-0.187.0-dev.d90ae4b.tgz` is three.js built from the `dev` branch of
mrdoob/three.js at commit `d90ae4bb905d7d65d68adaba1872532144579d2c`
(`REVISION = '187dev'`). npm only publishes releases, so the frontend installs
this tarball (`"three": "file:../vendor/three/…"`) to stay on the dev line.

It holds exactly what the npm package ships (`build/`, `examples/jsm/`, `src/`,
`LICENSE`, `README.md`, `package.json`), with the version set to
`0.187.0-dev.<short sha>` and the dev-only `scripts`/`devDependencies` removed.

To update to a newer dev commit:

```sh
git clone --depth 1 --filter=blob:none --sparse -b dev https://github.com/mrdoob/three.js three-dev
cd three-dev
git sparse-checkout set --no-cone '/build/' '/examples/jsm/' '/src/' '/package.json' '/LICENSE' '/README.md'
mkdir ../pkg && cp -R build src LICENSE README.md package.json ../pkg/
mkdir -p ../pkg/examples && cp -R examples/jsm ../pkg/examples/
# in ../pkg/package.json: version -> 0.187.0-dev.<short sha>, drop scripts/devDependencies/overrides
cd ../pkg && npm pack --ignore-scripts
```

Replace the tarball here, point `frontend/package.json` at the new file name,
run `pnpm install` from the repo root, and check the spaces and the lobby on
both WebGPU and `?renderer=webgl`.

Builds: next 13.1's bundled Terser can't parse the static class blocks r187
uses, so `frontend/next.config.js` lowers static blocks and class fields in
three with Babel. Jest does the same in `frontend/jest.config.js`.
