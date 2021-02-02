// polyscope/color_management.cpp
// Clamp to [0,1]
function unitClamp(x) {
  return Math.max(0, Math.min(1, x));
}
function unitClamp3(x) {
  return [unitClamp(x[0]), unitClamp(x[1]), unitClamp(x[2])];
}

// Used to sample colors. Samples a series of most-distant values from a range [0,1]
// offset from a starting value 'start' and wrapped around. index=0 returns start
//
// Example: if start = 0, emits f(0, i) = {0, 1/2, 1/4, 3/4, 1/8, 5/8, 3/8, 7/8, ...}
//          if start = 0.3 emits (0.3 + f(0, i)) % 1
function getIndexedDistinctValue(start, index) {
  if (index < 0) {
    return 0.0;
  }

  // Bit shifty magic to evaluate f()
  let val = 0;
  let p = 0.5;
  while (index > 0) {
    if (index % 2 == 1) {
      val += p;
    }
    index = index / 2;
    p /= 2.0;
  }

  // Apply modular offset
  val = (val + start) % 1.0;

  return unitClamp(val);
}

/**
 * https://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c
 * Converts an HSV color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes h, s, and v are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   Number  h       The hue
 * @param   Number  s       The saturation
 * @param   Number  v       The value
 * @return  Array           The RGB representation
 */
function hsvToRgb(h, s, v) {
  let r, g, b;

  let i = Math.floor(h * 6);
  let f = h * 6 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      (r = v), (g = t), (b = p);
      break;
    case 1:
      (r = q), (g = v), (b = p);
      break;
    case 2:
      (r = p), (g = v), (b = t);
      break;
    case 3:
      (r = p), (g = q), (b = v);
      break;
    case 4:
      (r = t), (g = p), (b = v);
      break;
    case 5:
      (r = v), (g = p), (b = q);
      break;
  }

  return [r * 255, g * 255, b * 255];
}

// Get an indexed offset color. Inputs and outputs in RGB
function indexOffsetHue(baseHSV, index) {
  let newHue = getIndexedDistinctValue(baseHSV[0], index);
  return hsvToRgb(newHue, baseHSV[1], baseHSV[2]);
}

// Keep track of unique structure colors
// let uniqueColorBaseRGB = [28 / 255, 99 / 255, 227 / 255];
let uniqueColorBaseHSV = [219 / 360, 88 / 100, 89 / 100];
let iUniqueColor = 0;

function getNextUniqueColor() {
  return indexOffsetHue(uniqueColorBaseHSV, iUniqueColor++);
}

export { getNextUniqueColor };
