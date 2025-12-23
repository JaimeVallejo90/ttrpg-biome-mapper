(function () {
  function showError(message) {
    console.error(message);
    const canvas = document.getElementById("c");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width || 360;
    const height = canvas.height || 180;
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = "#0b1b2b";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#f2f5f8";
    ctx.font = "14px Space Grotesk, sans-serif";
    ctx.fillText(message, 12, 24);
  }

  function boot(Sim) {
    if (!Sim) {
      showError("Simulation unavailable.");
      return;
    }

    const { BIOMES, createSimState, computeBiomes } = Sim;
    if (!BIOMES || !createSimState || !computeBiomes) {
      showError("Simulation incomplete. Check sim.js.");
      return;
    }

    const GRID_W = 1080;
    const GRID_H = 540;
    const CANVAS_W = GRID_W;
    const CANVAS_H = GRID_H;
    const BRUSH_MIN = 1;
    const BRUSH_MAX = 40;

    const DEFAULT_KNOBS = {
      itczFloor: true,
      subDry: true,
      interiorDist: 54,
      interiorDry: -1,
      coastHum: 1,
      coastRange: 12,
      shadowStrength: 1,
      shadowRange: 18,
      cooling: 1,
      oceanWindSteps: 42,
    };

    const COLORS = {
      ocean: "#0b1b2b",
      land: "#2a6b3f",
      mountain: "#7f8a94",
    };

    const BIOME_COLORS = new Map([
      ["Ocean", "#0b2a3a"],
      ["Permanent ice", "#e5f6ff"],
      ["Wet glaciers", "#cfe9ff"],
      ["Seasonal ice", "#d6f0ff"],
      ["Polar desert", "#d0d6df"],
      ["Polar tundra", "#9fb3b8"],
      ["Cold desert", "#b6ad94"],
      ["Dry tundra", "#8a9a7c"],
      ["Moist tundra", "#6b8f6f"],
      ["Taiga", "#2f6a50"],
      ["Cold wet forest", "#247b62"],
      ["Temperate desert", "#e1c98f"],
      ["Temperate steppe", "#b7c56f"],
      ["Grassland", "#7ecf6b"],
      ["Temperate forest", "#2f9a4b"],
      ["Temperate rainforest", "#1e8f68"],
      ["Hot desert", "#f0d082"],
      ["Hyper-arid desert", "#f6e6b2"],
      ["Hot steppe", "#d8c15e"],
      ["Savanna", "#b7d35f"],
      ["Dry savanna", "#c7c768"],
      ["Humid savanna", "#9edb6a"],
      ["Tropical forest", "#30a356"],
      ["Rainforest", "#149058"],
      ["Tropical rainforest", "#0f8348"],
      ["Extreme rainforest", "#0b713f"],
    ]);

    const LEGEND_GROUPS = [
      { title: "Ocean", items: ["Ocean"] },
      {
        title: "Polar & Ice",
        items: ["Permanent ice", "Seasonal ice", "Wet glaciers", "Polar desert", "Polar tundra"],
      },
      {
        title: "Cold",
        items: ["Cold desert", "Dry tundra", "Moist tundra", "Taiga", "Cold wet forest"],
      },
      {
        title: "Temperate",
        items: [
          "Temperate desert",
          "Temperate steppe",
          "Grassland",
          "Temperate forest",
          "Temperate rainforest",
        ],
      },
      {
        title: "Hot & Tropical",
        items: [
          "Hyper-arid desert",
          "Hot desert",
          "Hot steppe",
          "Savanna",
          "Dry savanna",
          "Humid savanna",
          "Tropical forest",
          "Rainforest",
          "Tropical rainforest",
          "Extreme rainforest",
        ],
      },
    ];

    const LAT_LINES = [-60, -30, 0, 30, 60];

    const canvas = document.getElementById("c");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const ui = {
      brushMode: document.getElementById("brushMode"),
      brushSize: document.getElementById("brushSize"),
      brushSizeVal: document.getElementById("brushSizeVal"),
      viewMode: document.getElementById("viewMode"),
      computeBtn: document.getElementById("computeBtn"),
      clearBtn: document.getElementById("clearBtn"),
      legend: document.getElementById("legend"),
      inspector: document.getElementById("biomeInspector"),
      coastRange: document.getElementById("coastRange"),
      coastRangeVal: document.getElementById("coastRangeVal"),
      interiorDist: document.getElementById("interiorDist"),
      interiorDistVal: document.getElementById("interiorDistVal"),
      shadowRange: document.getElementById("shadowRange"),
      shadowRangeVal: document.getElementById("shadowRangeVal"),
      oceanWind: document.getElementById("oceanWind"),
      oceanWindVal: document.getElementById("oceanWindVal"),
    };

    const sim = createSimState(GRID_W, GRID_H);
    const state = {
      brushSize: parseInt(ui.brushSize.value, 10),
      brushMode: ui.brushMode.value,
      viewMode: ui.viewMode.value,
      painting: false,
      erasing: false,
      needsCompute: true,
      pointer: { x: 0, y: 0, active: false },
      hoverBiome: null,
      focusBiome: null,
    };

    let renderPending = false;

    function updateBrushSize() {
      state.brushSize = parseInt(ui.brushSize.value, 10);
      ui.brushSizeVal.textContent = state.brushSize;
    }

    function readInt(input, fallback) {
      if (!input) return fallback;
      const value = parseInt(input.value, 10);
      return Number.isFinite(value) ? value : fallback;
    }

    function currentKnobs() {
      return {
        itczFloor: DEFAULT_KNOBS.itczFloor,
        subDry: DEFAULT_KNOBS.subDry,
        interiorDist: readInt(ui.interiorDist, DEFAULT_KNOBS.interiorDist),
        interiorDry: DEFAULT_KNOBS.interiorDry,
        coastHum: DEFAULT_KNOBS.coastHum,
        coastRange: readInt(ui.coastRange, DEFAULT_KNOBS.coastRange),
        shadowStrength: DEFAULT_KNOBS.shadowStrength,
        shadowRange: readInt(ui.shadowRange, DEFAULT_KNOBS.shadowRange),
        cooling: DEFAULT_KNOBS.cooling,
        oceanWindSteps: readInt(ui.oceanWind, DEFAULT_KNOBS.oceanWindSteps),
      };
    }

    function updateClimateValues() {
      if (ui.coastRangeVal) ui.coastRangeVal.textContent = readInt(ui.coastRange, 0);
      if (ui.interiorDistVal) ui.interiorDistVal.textContent = readInt(ui.interiorDist, 0);
      if (ui.shadowRangeVal) ui.shadowRangeVal.textContent = readInt(ui.shadowRange, 0);
      if (ui.oceanWindVal) ui.oceanWindVal.textContent = readInt(ui.oceanWind, 0);
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function wrapX(x) {
      return (x + GRID_W) % GRID_W;
    }

    function idx(x, y) {
      return y * GRID_W + x;
    }

    function hexToRGBA(hex, alpha = 255) {
      const h = hex.replace("#", "");
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return [r, g, b, alpha];
    }

    function mixRGBA(base, target, amount) {
      const inv = 1 - amount;
      return [
        Math.round(base[0] * inv + target[0] * amount),
        Math.round(base[1] * inv + target[1] * amount),
        Math.round(base[2] * inv + target[2] * amount),
        255,
      ];
    }

    function clientToCanvas(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }

    function clientToGrid(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const nx = clamp((clientX - rect.left) / rect.width, 0, 1);
      const ny = clamp((clientY - rect.top) / rect.height, 0, 1);
      const gx = clamp(Math.floor(nx * GRID_W), 0, GRID_W - 1);
      const gy = clamp(Math.floor(ny * GRID_H), 0, GRID_H - 1);
      return { gx, gy };
    }

    function paintAt(gx, gy) {
      const radius = state.brushSize;
      const mode = state.brushMode;
      const erase = state.erasing;
      let changed = false;

      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const x = wrapX(gx + dx);
          const y = clamp(gy + dy, 0, GRID_H - 1);
          const i = idx(x, y);

          const prevLand = sim.land[i];
          const prevMtn = sim.mtn[i];
          let nextLand = prevLand;
          let nextMtn = prevMtn;

          if (!erase) {
            if (mode === "land") {
              nextLand = 1;
            } else {
              nextLand = 1;
              nextMtn = 1;
            }
          } else if (mode === "land") {
            nextLand = 0;
            nextMtn = 0;
          } else {
            nextMtn = 0;
          }

          if (nextLand === prevLand && nextMtn === prevMtn) continue;
          sim.land[i] = nextLand;
          sim.mtn[i] = nextMtn;
          changed = true;
        }
      }

      if (changed) state.needsCompute = true;
      scheduleRender();
    }

    function drawGridToCanvas(drawFn) {
      const img = ctx.createImageData(GRID_W, GRID_H);
      const data = img.data;
      for (let y = 0; y < GRID_H; y += 1) {
        for (let x = 0; x < GRID_W; x += 1) {
          const i = idx(x, y);
          const [r, g, b, a] = drawFn(i, x, y);
          const p = (y * GRID_W + x) * 4;
          data[p] = r;
          data[p + 1] = g;
          data[p + 2] = b;
          data[p + 3] = a;
        }
      }
      ctx.putImageData(img, 0, 0);
    }

    function drawLatitudeLines() {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "10px Space Grotesk, sans-serif";
      for (const lat of LAT_LINES) {
        const t = (89 - lat) / 178;
        const y = Math.round(t * (GRID_H - 1)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(GRID_W, y);
        ctx.stroke();
        ctx.fillText(`${lat}º`, 6, y - 3);
      }
      ctx.restore();
    }

    function drawBrushPreview() {
      if (!state.pointer.active) return;
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(state.pointer.x, state.pointer.y, state.brushSize, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function render() {
      const mode = state.viewMode;

      if (mode === "editor") {
        drawGridToCanvas((i) => {
          if (!sim.land[i]) return hexToRGBA(COLORS.ocean, 255);
          if (sim.mtn[i]) return hexToRGBA(COLORS.mountain, 255);
          return hexToRGBA(COLORS.land, 255);
        });
      } else {
        const focusBiome = state.focusBiome;
        const oceanColor = hexToRGBA(BIOME_COLORS.get("Ocean") || COLORS.ocean, 255);
        drawGridToCanvas((i) => {
          const isLand = sim.land[i];
          const bname = isLand ? BIOMES[sim.biomeId[i]] : "Ocean";
          const base = isLand
            ? hexToRGBA(BIOME_COLORS.get(bname) || COLORS.land, 255)
            : oceanColor;
          if (focusBiome && bname !== focusBiome) {
            return mixRGBA(base, oceanColor, 0.75);
          }
          return base;
        });
      }

      drawLatitudeLines();
      drawBrushPreview();
    }

    function scheduleRender() {
      if (renderPending) return;
      renderPending = true;
      requestAnimationFrame(() => {
        renderPending = false;
        render();
      });
    }

    function updateLegendActive() {
      if (!ui.legend) return;
      const chips = ui.legend.querySelectorAll(".chip");
      chips.forEach((chip) => {
        const name = chip.dataset.biome;
        chip.classList.toggle("active", state.focusBiome === name);
        chip.classList.toggle("hover", !state.focusBiome && state.hoverBiome === name);
      });
      ui.legend.classList.toggle("has-focus", Boolean(state.focusBiome));
    }

    function buildLegend() {
      if (!ui.legend) return;
      ui.legend.innerHTML = LEGEND_GROUPS.map((group) => {
        const chips = group.items
          .map((name) => {
            const color = BIOME_COLORS.get(name) || "#444";
            return `
              <button class="chip" type="button" data-biome="${name}" style="--swatch:${color}">
                <span class="sw"></span>
                <span>${name}</span>
              </button>
            `;
          })
          .join("");
        return `
          <div class="legend-group">
            <div class="legend-group-title">${group.title}</div>
            <div class="legend-group-grid">${chips}</div>
          </div>
        `;
      }).join("");
      updateLegendActive();
    }

    function updateInspector(clientX, clientY, i) {
      if (!ui.inspector) return;
      const nameEl = ui.inspector.querySelector(".inspector-name");
      const labelEl = ui.inspector.querySelector(".inspector-label");
      const swatchEl = ui.inspector.querySelector(".inspector-swatch");

      let name = "Ocean";
      let color = BIOME_COLORS.get("Ocean") || COLORS.ocean;
      if (sim.land[i]) {
        if (state.viewMode === "biome") {
          name = BIOMES[sim.biomeId[i]] || "Uncomputed biome";
          color = BIOME_COLORS.get(name) || COLORS.land;
        } else if (sim.mtn[i]) {
          name = "Mountain";
          color = COLORS.mountain;
        } else {
          name = "Land";
          color = COLORS.land;
        }
      }

      if (nameEl) nameEl.textContent = name;
      if (labelEl) labelEl.textContent = state.viewMode === "biome" ? "Biome" : "Surface";
      if (swatchEl) swatchEl.style.background = color;

      const rect = canvas.getBoundingClientRect();
      const localX = clamp(clientX - rect.left, 0, rect.width);
      const localY = clamp(clientY - rect.top, 0, rect.height);
      const boxW = ui.inspector.offsetWidth || 140;
      const boxH = ui.inspector.offsetHeight || 32;
      let x = localX + 14;
      let y = localY + 14;
      if (x + boxW > rect.width) x = localX - boxW - 14;
      if (y + boxH > rect.height) y = localY - boxH - 14;
      x = clamp(x, 8, rect.width - boxW - 8);
      y = clamp(y, 8, rect.height - boxH - 8);

      ui.inspector.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      ui.inspector.classList.add("visible");
    }

    function hideInspector() {
      if (!ui.inspector) return;
      ui.inspector.classList.remove("visible");
    }

    function compute() {
      computeBiomes(sim, GRID_W, GRID_H, currentKnobs());
      state.needsCompute = false;
    }

    function clearAll() {
      sim.land.fill(0);
      sim.mtn.fill(0);
      sim.tempLvl.fill(-1);
      sim.humLvl.fill(-1);
      sim.biomeId.fill(-1);
      state.viewMode = "editor";
      ui.viewMode.value = "editor";
      state.needsCompute = true;
      state.focusBiome = null;
      state.hoverBiome = null;
      updateLegendActive();
      hideInspector();
      scheduleRender();
    }

    function stopPainting(event) {
      if (!state.painting) return;
      state.painting = false;
      state.erasing = false;
      if (state.viewMode === "biome" && state.needsCompute) {
        compute();
      }
      if (event && canvas.releasePointerCapture) {
        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch (error) {
          // Ignore if capture was not active.
        }
      }
      scheduleRender();
    }

    function handlePointerDown(event) {
      const button = event.button ?? 0;
      if (button !== 0 && button !== 2) return;
      if (canvas.setPointerCapture) {
        canvas.setPointerCapture(event.pointerId);
      }
      state.painting = true;
      state.erasing = button === 2;
      const { gx, gy } = clientToGrid(event.clientX, event.clientY);
      paintAt(gx, gy);
    }

    function handlePointerMove(event) {
      const point = clientToCanvas(event.clientX, event.clientY);
      state.pointer.x = point.x;
      state.pointer.y = point.y;
      state.pointer.active = true;
      const { gx, gy } = clientToGrid(event.clientX, event.clientY);
      const i = idx(gx, gy);
      updateInspector(event.clientX, event.clientY, i);
      let nextHover = null;
      if (state.viewMode === "biome") {
        const bname = sim.land[i] ? BIOMES[sim.biomeId[i]] : "Ocean";
        nextHover = bname || null;
      }
      if (nextHover !== state.hoverBiome) {
        state.hoverBiome = nextHover;
        updateLegendActive();
      }
      if (!state.painting) {
        scheduleRender();
        return;
      }
      if (typeof event.buttons === "number" && event.buttons === 0) {
        stopPainting(event);
        return;
      }
      paintAt(gx, gy);
    }

    function handlePointerUp(event) {
      stopPainting(event);
    }

    function handlePointerLeave() {
      state.pointer.active = false;
      state.hoverBiome = null;
      updateLegendActive();
      hideInspector();
      scheduleRender();
    }

    function handleWheel(event) {
      event.preventDefault();
      const v = parseInt(ui.brushSize.value, 10);
      const next = clamp(v + (event.deltaY < 0 ? 1 : -1), BRUSH_MIN, BRUSH_MAX);
      ui.brushSize.value = next;
      updateBrushSize();
    }

    function handleClimateInput() {
      updateClimateValues();
      state.needsCompute = true;
      if (state.viewMode === "biome") {
        compute();
        scheduleRender();
      }
    }

    function setupEvents() {
      ui.brushSize.addEventListener("input", updateBrushSize);
      ui.brushMode.addEventListener("change", (event) => {
        state.brushMode = event.target.value;
      });
      if (ui.coastRange) ui.coastRange.addEventListener("input", handleClimateInput);
      if (ui.interiorDist) ui.interiorDist.addEventListener("input", handleClimateInput);
      if (ui.shadowRange) ui.shadowRange.addEventListener("input", handleClimateInput);
      if (ui.oceanWind) ui.oceanWind.addEventListener("input", handleClimateInput);
      ui.viewMode.addEventListener("change", (event) => {
        state.viewMode = event.target.value;
        if (state.viewMode === "biome" && state.needsCompute) {
          compute();
        }
        state.hoverBiome = null;
        updateLegendActive();
        scheduleRender();
      });
      ui.computeBtn.addEventListener("click", () => {
        compute();
        state.viewMode = "biome";
        ui.viewMode.value = "biome";
        scheduleRender();
      });
      ui.clearBtn.addEventListener("click", clearAll);
      if (ui.legend) {
        ui.legend.addEventListener("click", (event) => {
          const chip = event.target.closest(".chip");
          if (!chip) return;
          const name = chip.dataset.biome;
          if (state.focusBiome === name) state.focusBiome = null;
          else state.focusBiome = name;
          state.viewMode = "biome";
          ui.viewMode.value = "biome";
          if (state.needsCompute) compute();
          updateLegendActive();
          scheduleRender();
        });
      }

      canvas.addEventListener("contextmenu", (event) => event.preventDefault());
      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("pointermove", handlePointerMove);
      canvas.addEventListener("pointerup", handlePointerUp);
      canvas.addEventListener("pointercancel", handlePointerUp);
      canvas.addEventListener("pointerleave", handlePointerLeave);
      window.addEventListener("pointerup", handlePointerUp);
      canvas.addEventListener("wheel", handleWheel, { passive: false });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && state.focusBiome) {
          state.focusBiome = null;
          updateLegendActive();
          scheduleRender();
        }
      });
    }

    function initialize() {
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      ctx.imageSmoothingEnabled = false;
      sim.tempLvl.fill(-1);
      sim.humLvl.fill(-1);
      sim.biomeId.fill(-1);
      updateBrushSize();
      updateClimateValues();
      buildLegend();
      scheduleRender();
    }

    initialize();
    setupEvents();
  }

  if (window.Sim) {
    boot(window.Sim);
    return;
  }

  const loader = document.createElement("script");
  loader.src = "./sim.js";
  loader.onload = () => {
    if (window.Sim) boot(window.Sim);
    else showError("sim.js loaded, but initialization failed.");
  };
  loader.onerror = () => {
    showError("Failed to load sim.js.");
  };
  document.head.appendChild(loader);
})();
