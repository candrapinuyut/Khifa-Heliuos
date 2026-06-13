# Khifa-Heliuos

An interactive "Selected Works" 3D card gallery — an Awwwards-style portfolio
experience built with Three.js and GSAP. Eighteen image cards float in a
near-black 3D scene and can be rearranged between four layout modes, driven by
inertial scroll and smooth FLIP-style transitions, with a fullscreen detail view
for each card.

## Features

- **Four layout modes** — `Flat` (2D wheel), `Tilt` (perspective table),
  `Ring` (3D cylinder), and `Gallery` (stacked cluster that scatters). Cards
  animate between modes with staggered GSAP tweens; meshes are never destroyed
  or remounted.
- **Scroll-driven motion** — virtual scroll with damping/inertia rotates and
  shifts the layout; a live `NN — 18` counter tracks the front card.
- **Fullscreen detail view** — click a card to bring it forward as a hero while
  the others scatter, then reveal eyebrow, title, and description.
- **Polish** — custom lerped cursor, hover lift/scale, vignette, dimming by
  depth, keyboard controls, responsive layout, and `prefers-reduced-motion`
  support.

## Tech Stack

- [Vite](https://vitejs.dev/) + vanilla TypeScript
- [Three.js](https://threejs.org/) for the 3D scene
- [GSAP](https://gsap.com/) for transitions and the detail view

## Getting Started

```bash
npm install     # install dependencies
npm run dev     # start the dev server
npm run build   # type-check and build for production
npm run preview # preview the production build
```

## Project Structure

```
src/
  main.ts         bootstrap, resize, RAF loop
  scene.ts        renderer, camera, card creation
  layouts.ts      flat() tilt() ring() gallery() — pure layout functions
  transitions.ts  GSAP timelines between modes + detail view
  scroll.ts       virtual scroll, damping, counter
  cursor.ts       custom cursor
  data.ts         the 18 card items
  ui.ts           HTML chrome + segmented control
index.html
style.css
```

See [`SPEC-selected-works-gallery.md`](./SPEC-selected-works-gallery.md) for the
full design specification.
