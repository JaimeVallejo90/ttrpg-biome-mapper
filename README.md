# Biome Mapper (Earth scale)

Biome Mapper is a canvas-based tool for painting land and mountains on a 1080x540 grid (Earth-scale), then generating a biome map using a 5x5 Temperature x Humidity matrix.

## Features
- Paint land and mountains with a brush + eraser
- Compute biome map using latitude bands, coast distance, currents, and rain shadow logic
- Toggle views: editor and biome
- Tune coastal influence, interior dryness, rain shadow reach, and ocean wind reach

## Run locally
No build step required.

1) Open `index.html` in your browser.

## GitHub Pages deployment
This project is static, so it works directly with GitHub Pages.

1) Push the repository to GitHub.
2) In GitHub, go to Settings -> Pages.
3) Set "Build and deployment" to deploy from the `main` branch and `/root`.
4) Save. Your site will be available at the Pages URL shown.

## Files
- `index.html` - UI layout and canvas
- `style.css` - Layout and theme styles
- `app.js` - UI and rendering
- `sim.js` - Biome simulation logic

## Usage tips
- Right-click to erase.
- Mouse wheel adjusts brush size.
- For strong rain shadows, paint a coastal mountain chain on the windward side.
