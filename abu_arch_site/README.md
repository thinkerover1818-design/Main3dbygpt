# ABU ARCH — Premium 3D Architecture Portfolio

Vite + React + Three.js site using the supplied GLB as the real interactive model.

## Run
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
npm run preview
```

### Assets
- `public/model/abu-arch-house.glb` — supplied GLB, used directly by Three.js/GLTFLoader.
- `public/assets/logo.jpg` — supplied ABU ARCH logo.
- `public/assets/*` — supplied project visuals, with crops prepared from the uploaded portfolio sheet.

### Notes
The 3D viewer uses the original GLB geometry/materials/textures and only applies a uniform world-scale normalization so the model is comfortably framed. The guided route is camera-driven; the exact visibility of interior spaces depends on whether the supplied GLB contains those interior meshes.
