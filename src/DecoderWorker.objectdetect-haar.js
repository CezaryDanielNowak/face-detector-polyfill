var objectdetect = require('./lib/objectdetect-haar');
var frontalface = require('./lib/objectdetect.frontalface').frontalface;
// var frontalface = require('./lib/objectdetect.frontalface_alt').frontalface_alt; // SLOW!

const CONFIDENCE_THRESHOLD = 10;
const LIMIT_THRESHOLD = 20;

const COORDS_X = 0;
const COORDS_Y = 1;
const COORDS_W = 2;
const COORDS_H = 3;
const COORDS_CONFIDENCE = 4;

const SCALE_FACTOR = 1.1;

let detectorDimensions = '';
let detect;

self.onmessage = function (e) {
  const { width, height, image, scale, maxDetectedFaces, id } = e.data;

  const newDimensions = `${width}x${height}`;
  if (detectorDimensions !== newDimensions) {
    detect = objectdetect(frontalface, { width, height, scale: SCALE_FACTOR });
    detectorDimensions = newDimensions;
  }

  const coords = detect(image);
  // keep the best results
  let topResults = coords.filter((coord) => coord[COORDS_CONFIDENCE] > CONFIDENCE_THRESHOLD).slice(0, maxDetectedFaces);
  
  if (topResults.length > 1) {
    // Limit false-positives:
    // if there is any face with positive confidence, exclude all negatives.
    // if all are negative, exclude the lowest score.
    const highestScore = topResults[0][COORDS_CONFIDENCE];

    if (highestScore > LIMIT_THRESHOLD) {
      topResults = topResults.filter((result) => result[LIMIT_THRESHOLD] > LIMIT_THRESHOLD)
    } else {
      topResults = topResults.slice(0, 1)
    }
  }

  // scale and remove some values
  const scaledResults = topResults.map(res => ({
    x: res[COORDS_X] * scale,
    y: res[COORDS_Y] * scale,
    width: res[COORDS_W] * scale,
    height: res[COORDS_H] * scale,
  }))

  postMessage({
    id: id,
    result: scaledResults,
    err: null,
  });
};
