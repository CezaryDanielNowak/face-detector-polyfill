var objectdetect = require('./lib/objectdetect');
var frontalface = require('./lib/objectdetect.frontalface').frontalface;



let imgU8;
let lastHeight = -1;
let lastWidth = -1;

const CONFIDENCE_THRESHOLD = 10;
const LIMIT_THRESHOLD = 20;


const COORDS_X = 0;
const COORDS_Y = 1;
const COORDS_W = 2;
const COORDS_H = 3;
const COORDS_CONFIDENCE = 4;

let detectorDimensions = '';
let detector;


self.onmessage = function (e) {
  const { width, height, image, scale, maxDetectedFaces, id } = e.data;

  const newDimensions = `${width}x${height}`;
  if (detectorDimensions !== newDimensions) {
    detector = new objectdetect.detector(width, height, 1.1, frontalface);
  }

  const coords = detector.detect(image, 1);
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
