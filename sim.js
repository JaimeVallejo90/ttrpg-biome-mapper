const BIOMES = [
  "Permanent ice",
  "Polar desert",
  "Polar tundra",
  "Seasonal ice",
  "Wet glaciers",
  "Cold desert",
  "Dry tundra",
  "Moist tundra",
  "Taiga",
  "Cold wet forest",
  "Temperate desert",
  "Temperate steppe",
  "Grassland",
  "Temperate forest",
  "Temperate rainforest",
  "Hot desert",
  "Hot steppe",
  "Savanna",
  "Tropical forest",
  "Rainforest",
  "Hyper-arid desert",
  "Dry savanna",
  "Humid savanna",
  "Tropical rainforest",
  "Extreme rainforest",
];

const BIOME_MATRIX = [
  [0, 1, 2, 3, 4], // Very Low temp
  [5, 6, 7, 8, 9], // Low
  [10, 11, 12, 13, 14], // Medium
  [15, 16, 17, 18, 19], // High
  [20, 21, 22, 23, 24], // Very High
];

function createSimState(gridW, gridH) {
  return {
    land: new Uint8Array(gridW * gridH),
    mtn: new Uint8Array(gridW * gridH),
    tempLvl: new Int8Array(gridW * gridH),
    humLvl: new Int8Array(gridW * gridH),
    biomeId: new Int16Array(gridW * gridH),
  };
}

function computeBiomes(sim, gridW, gridH, knobs) {
  const dist = computeDistToCoast(sim.land, gridW, gridH);
  const coastalMask = computeCoastalMask(sim.land, gridW, gridH);
  const { warm, cold } = computeCurrents(sim.land, coastalMask, gridW, gridH);
  const coastRange = Math.max(0, knobs.coastRange ?? 1);
  const oceanWindSteps = Math.max(1, knobs.oceanWindSteps ?? 42);
  const oceanWindThresh = Math.max(1, Math.round(oceanWindSteps * 0.65));
  const oceanWindBonus = windFromOceanBonus(sim.land, gridW, gridH, oceanWindSteps, oceanWindThresh);
  const shadowRange = Math.max(1, knobs.shadowRange ?? 12);
  const { windward, leeward } = mountainWindwardLeeward(
    sim.land,
    sim.mtn,
    gridW,
    gridH,
    knobs.shadowStrength,
    shadowRange
  );

  for (let y = 0; y < gridH; y += 1) {
    const a = absLat(y, gridH);
    for (let x = 0; x < gridW; x += 1) {
      const i = idx(x, y, gridW);
      if (!sim.land[i]) {
        sim.tempLvl[i] = -1;
        sim.humLvl[i] = -1;
        sim.biomeId[i] = -1;
        continue;
      }

      let t = baseTempFromLat(a);
      let h = baseHumFromLat(a);

      if (!knobs.subDry && a > 25 && a <= 35) {
        h = 2;
      }

      if (coastRange > 0 && dist[i] <= coastRange) h += knobs.coastHum;
      if (dist[i] >= knobs.interiorDist) h += knobs.interiorDry;

      if (warm[i]) {
        h += 1;
        t += 1;
      }
      if (cold[i]) {
        h -= 1;
        t -= 1;
      }

      h += oceanWindBonus[i];
      h += windward[i];
      h -= leeward[i];

      if (knobs.cooling > 0 && sim.mtn[i]) t -= knobs.cooling;

      if (knobs.itczFloor) {
        if (a <= 10) h = Math.max(h, 3);
        else if (a <= 15) h = Math.max(h, 2);
      }

      t = clamp(t, 0, 4);
      h = clamp(h, 0, 4);

      sim.tempLvl[i] = t;
      sim.humLvl[i] = h;
      sim.biomeId[i] = BIOME_MATRIX[t][h];
    }
  }
}

function computeCoastalMask(land, gridW, gridH) {
  const mask = new Uint8Array(gridW * gridH);
  for (let y = 0; y < gridH; y += 1) {
    for (let x = 0; x < gridW; x += 1) {
      const i = idx(x, y, gridW);
      if (!land[i]) continue;
      const n = [
        idx(wrapX(x - 1, gridW), y, gridW),
        idx(wrapX(x + 1, gridW), y, gridW),
        y > 0 ? idx(x, y - 1, gridW) : i,
        y < gridH - 1 ? idx(x, y + 1, gridW) : i,
      ];
      for (const j of n) {
        if (!land[j]) {
          mask[i] = 1;
          break;
        }
      }
    }
  }
  return mask;
}

function computeHillshade(mtn, gridW, gridH) {
  const shade = new Int8Array(gridW * gridH);
  for (let y = 1; y < gridH - 1; y += 1) {
    for (let x = 1; x < gridW - 1; x += 1) {
      const i = idx(x, y, gridW);
      if (!mtn[i]) continue;
      const nw =
        mtn[idx(x - 1, y - 1, gridW)] +
        mtn[idx(x - 1, y, gridW)] +
        mtn[idx(x - 1, y + 1, gridW)];
      const se =
        mtn[idx(x + 1, y - 1, gridW)] +
        mtn[idx(x + 1, y, gridW)] +
        mtn[idx(x + 1, y + 1, gridW)];
      shade[i] = clamp(nw - se, -3, 3);
    }
  }
  return shade;
}

function latDegForRow(y, gridH) {
  return 89 - 178 * (y / (gridH - 1));
}

function absLat(y, gridH) {
  return Math.abs(latDegForRow(y, gridH));
}

function baseTempFromLat(a) {
  if (a < 10) return 4;
  if (a < 30) return 3;
  if (a < 40) return 2;
  if (a < 60) return 1;
  return 0;
}

function baseHumFromLat(a) {
  if (a <= 12) return 3;
  if (a <= 25) return 2;
  if (a <= 35) return 1;
  if (a <= 60) return 2;
  return 1;
}

function windVectorForLat(lat) {
  const a = Math.abs(lat);
  let dr = 0;
  let dc = 0;
  if (a < 30) {
    dr = lat > 0 ? 1 : -1;
    dc = lat > 0 ? -1 : 1;
  } else if (a < 60) {
    dr = lat > 0 ? -1 : 1;
    dc = lat > 0 ? 1 : -1;
  } else {
    dr = lat > 0 ? 1 : -1;
    dc = lat > 0 ? -1 : 1;
  }
  return { dr, dc };
}

function computeDistToCoast(land, gridW, gridH) {
  const dist = new Int32Array(gridW * gridH);
  const INF = 1e9;
  for (let i = 0; i < dist.length; i += 1) {
    dist[i] = land[i] ? INF : 0;
  }

  for (let y = 0; y < gridH; y += 1) {
    for (let x = 0; x < gridW; x += 1) {
      const i = idx(x, y, gridW);
      if (!land[i]) continue;
      let d = dist[i];
      if (y > 0) d = Math.min(d, dist[idx(x, y - 1, gridW)] + 1);
      if (x > 0) d = Math.min(d, dist[idx(x - 1, y, gridW)] + 1);
      dist[i] = d;
    }
  }

  for (let y = gridH - 1; y >= 0; y -= 1) {
    for (let x = gridW - 1; x >= 0; x -= 1) {
      const i = idx(x, y, gridW);
      if (!land[i]) continue;
      let d = dist[i];
      if (y < gridH - 1) d = Math.min(d, dist[idx(x, y + 1, gridW)] + 1);
      if (x < gridW - 1) d = Math.min(d, dist[idx(x + 1, y, gridW)] + 1);
      dist[i] = d;
    }
  }
  return dist;
}

function computeCurrents(land, coastalMask, gridW, gridH) {
  const warm = new Uint8Array(gridW * gridH);
  const cold = new Uint8Array(gridW * gridH);
  for (let y = 0; y < gridH; y += 1) {
    const a = absLat(y, gridH);
    for (let x = 0; x < gridW; x += 1) {
      const i = idx(x, y, gridW);
      if (!coastalMask[i]) continue;
      const oceanW = !land[idx(wrapX(x - 1, gridW), y, gridW)];
      const oceanE = !land[idx(wrapX(x + 1, gridW), y, gridW)];
      const inBand = a >= 10 && a <= 45;
      if (inBand) {
        if (oceanW && !oceanE) warm[i] = 1;
        if (oceanE && !oceanW) cold[i] = 1;
      } else if (a < 60) {
        if (oceanW && !oceanE) warm[i] = 1;
        if (oceanE && !oceanW) cold[i] = 1;
      }
    }
  }
  return { warm, cold };
}

function windFromOceanBonus(land, gridW, gridH, steps = 42, oceanThresh = 27) {
  const bonus = new Int8Array(gridW * gridH);
  for (let y = 0; y < gridH; y += 1) {
    const lat = latDegForRow(y, gridH);
    const { dr, dc } = windVectorForLat(lat);
    for (let x = 0; x < gridW; x += 1) {
      const i = idx(x, y, gridW);
      if (!land[i]) continue;
      let oceanCount = 0;
      let rr = y;
      let cc = x;
      for (let s = 0; s < steps; s += 1) {
        rr = clamp(rr - dr, 0, gridH - 1);
        cc = wrapX(cc - dc, gridW);
        if (!land[idx(cc, rr, gridW)]) oceanCount += 1;
      }
      if (oceanCount >= oceanThresh) bonus[i] = 1;
    }
  }
  return bonus;
}

function mountainWindwardLeeward(land, mtn, gridW, gridH, shadowStrength = 1, shadowRange = 12) {
  const windward = new Int8Array(gridW * gridH);
  const leeward = new Int8Array(gridW * gridH);
  if (shadowStrength === 0) return { windward, leeward };
  const range = Math.max(1, shadowRange);

  for (let y = 0; y < gridH; y += 1) {
    const lat = latDegForRow(y, gridH);
    const { dr, dc } = windVectorForLat(lat);
    for (let x = 0; x < gridW; x += 1) {
      const i = idx(x, y, gridW);
      if (!land[i]) continue;

      let rr = y;
      let cc = x;
      for (let s = 1; s <= range; s += 1) {
        rr = clamp(rr + dr, 0, gridH - 1);
        cc = wrapX(cc + dc, gridW);
        if (mtn[idx(cc, rr, gridW)]) {
          windward[i] = shadowStrength;
          break;
        }
      }

      rr = y;
      cc = x;
      for (let s = 1; s <= range; s += 1) {
        rr = clamp(rr - dr, 0, gridH - 1);
        cc = wrapX(cc - dc, gridW);
        if (mtn[idx(cc, rr, gridW)]) {
          leeward[i] = shadowStrength;
          break;
        }
      }
    }
  }
  return { windward, leeward };
}

function idx(x, y, gridW) {
  return y * gridW + x;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapX(x, gridW) {
  return (x + gridW) % gridW;
}

window.Sim = {
  BIOMES,
  BIOME_MATRIX,
  createSimState,
  computeBiomes,
  computeCoastalMask,
  computeHillshade,
  latDegForRow,
  absLat,
};
