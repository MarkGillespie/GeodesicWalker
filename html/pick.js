import { WebGLRenderTarget } from "https://unpkg.com/three@0.125.1/build/three.module.js";

let currLocalPickInd = 0;
let currPickStructure = undefined;
let haveSelectionVal = false;

// The next pick index that a structure can use to identify its elements
// (get it by calling request pickBufferRange())
let nextPickBufferInd = 1; // 0 returned by dat.gui?

let structureRanges = [];

function requestPickBufferRange(structure, count) {
  let structureStart = nextPickBufferInd;
  let structureEnd = nextPickBufferInd + count;

  structureRanges.push({
    start: structureStart,
    end: structureEnd,
    structure: structure,
  });

  nextPickBufferInd = structureEnd;
  return structureStart;
}

function globalIndexToLocal(globalInd) {
  // Loop through the ranges that we have allocated to find the one correpsonding to this structure.
  for (let range of structureRanges) {
    if (globalInd >= range.start && globalInd < range.end) {
      return { localInd: globalInd - range.start, structure: range.structure };
    }
  }

  return { localInd: 0, structure: undefined };
}

function localIndexToGlobal(structure, localInd) {
  if (!structure) return 0;

  // Loop through the ranges that we have allocated to find the one correpsonding to this structure.
  for (let range of structureRanges) {
    if (range.structure == structure) {
      return range.start + localInd;
    }
  }
  return 0;
}

function evaluatePickQuery(pickRenderer, pickScene, camera, xPos, yPos) {
  // draw
  let pickTarget = new WebGLRenderTarget(window.innerWidth, window.innerHeight);
  pickTarget.texture.generateMipmaps = false;
  pickRenderer.setRenderTarget(pickTarget);
  pickRenderer.render(pickScene, camera);

  // read color
  let pixelBuffer = new Uint8Array(4);
  pickRenderer.readRenderTargetPixels(
    pickTarget,
    xPos,
    pickTarget.height - yPos,
    1,
    1,
    pixelBuffer
  );

  // convert color to id
  let globalInd =
    pixelBuffer[0] + pixelBuffer[1] * 256 + pixelBuffer[2] * 256 * 256;

  return globalIndexToLocal(globalInd);
}

function pickIndToVector(pickInd) {
  return [
    ((pickInd & 0x000000ff) >> 0) / 255.0,
    ((pickInd & 0x0000ff00) >> 8) / 255.0,
    ((pickInd & 0x00ff0000) >> 16) / 255.0,
  ];
}

export {
  requestPickBufferRange,
  globalIndexToLocal,
  localIndexToGlobal,
  evaluatePickQuery,
  pickIndToVector,
};
