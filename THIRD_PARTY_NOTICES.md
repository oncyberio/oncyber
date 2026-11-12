# Third-party notices

Oncyber's own code is under the MIT license in [`LICENSE`](LICENSE). The
repository also ships the third-party files below, each under its own license.
Packages installed from npm keep the licenses in their own `package.json`.

## Vendored packages

| Path                      | Project                                                              | License                                              |
| ------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| `vendor/three/`           | [three.js](https://github.com/mrdoob/three.js) r187 dev build        | MIT, © three.js authors (license inside the tarball) |
| `vendor/camera-controls/` | [camera-controls](https://github.com/yomotsu/camera-controls) 1.33.0 | MIT, © Akihiro Oyamada (license inside the tarball)  |

## Decoders served from `frontend/public/`

| Path                     | Project                                                           | License                    |
| ------------------------ | ----------------------------------------------------------------- | -------------------------- |
| `frontend/public/draco/` | [Draco](https://github.com/google/draco)                          | Apache 2.0, © Google       |
| `frontend/public/basis/` | [Basis Universal](https://github.com/BinomialLLC/basis_universal) | Apache 2.0, © Binomial LLC |

## Fonts in `frontend/public/fonts/`

| Font          | License                                                                                 |
| ------------- | --------------------------------------------------------------------------------------- |
| IBM Plex Sans | SIL Open Font License 1.1, © IBM Corp. (`body/OFL.txt`)                                 |
| Space Grotesk | SIL Open Font License 1.1, © The Space Grotesk Project Authors (`SpaceGrotesk/OFL.txt`) |
| Space Mono    | SIL Open Font License 1.1, © The Space Mono Project Authors (`SpaceMono/OFL.txt`)       |

Oncyber's commercial fonts (Aeonik, PP Editorial New, PP Neue Bit) are not
in the repository. See [`docs/fonts.md`](docs/fonts.md).

## 3D assets and animation

| Path                                                     | Source                                                                                   | License                                                                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/public/lobby/cc0/`                             | Animations by [Quaternius](https://quaternius.com)                                       | CC0 1.0 (`LICENSE.txt`)                                                                                                         |
| `frontend/public/models/`, `frontend/public/cyber/`      | Avatars and scene models                                                                 | Per file, see `LICENSE.md` in each folder. Most are used by Oncyber with permission and are not MIT-licensed or redistributable |
| `frontend/public/lobby/emote-previews/summer/`           | Renders of the Summer avatar                                                             | CC0, same as the source avatar                                                                                                  |
| `frontend/public/lobby/locomotion/`, `travel/`, `flash/` | Packed animation keys; source clips and hashes are listed in each `source-manifest.json` | See the source manifests                                                                                                        |

Everything else under `frontend/public/` (images, icons, landing media) is
Oncyber's own work and is covered by `LICENSE` unless a file says otherwise.
