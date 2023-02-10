var objectdetect = require('./lib/objectdetect');
var frontalface = require('./lib/objectdetect.frontalface').frontalface;



let imgU8;
let lastHeight = -1;
let lastWidth = -1;



let detectorDimensions = '';
let detector;


self.onmessage = function (e) {
  const { width, height, image, scale, maxDetectedFaces, id } = e.data;

  const newDimensions = `${width}x${height}`;
  if (detectorDimensions !== newDimensions) {
    detector = new objectdetect.detector(width, height, 1.1, objectdetect.frontalface);
  }

  var coords = detector.detect(image, 1);
console.log(coords)
return;
  // keep the best results
  let topResults = rects.sort((recA, recB) => recB.confidence - recA.confidence).slice(0, maxDetectedFaces)
  
  if (topResults.length > 1) {
    // Limit false-positives:
    // if there is any face with positive confidence, exclude all negatives.
    // if all are negative, exclude the lowest score.
    const highestScore = topResults[0].confidence;

    if (highestScore > 0) {
      topResults = topResults.filter((result) => result.confidence > 0)
    } else {
      topResults = topResults.slice(0, 1)
    }
  }

  // scale and remove some values
  const scaledResults = topResults.map(res => ({
    x: res.x * scale,
    y: res.y * scale,
    width: res.width * scale,
    height: res.height * scale,
  }))

  postMessage({
    id: id,
    result: scaledResults,
    err: null,
  });
};
