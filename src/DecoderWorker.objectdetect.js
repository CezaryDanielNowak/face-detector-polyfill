var Detector = require('./lib/objectdetect');
var frontalFaceClassifier = require('./lib/objectdetect.frontalface');
// var frontalface = require('./lib/objectdetect.frontalface_alt').frontalface_alt; // SLOW!

const COORDS_X = 0;
const COORDS_Y = 1;
const COORDS_W = 2;
const COORDS_H = 3;
const COORDS_CONFIDENCE = 4;

const SCALE_FACTOR = 1.1; // NOTE: 1 doesn't detect anything

let detectorDimensions = '';
let detector;

self.onmessage = function (e) {
  const {
    image,
    scale,
    maxDetectedFaces,
    id,
    minConfidence,
  } = e.data;
  const { width, height } = image;

  const newDimensions = `${width}x${height}`;
  if (detectorDimensions !== newDimensions) {
    detector = new Detector(width, height, SCALE_FACTOR, frontalFaceClassifier);
    detectorDimensions = newDimensions;
  }
  const coords = detector.detect(image);

  // keep the best results
  let topResults = coords
    .filter((coord) => coord[COORDS_CONFIDENCE] > minConfidence)
    .slice(0, maxDetectedFaces);

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
