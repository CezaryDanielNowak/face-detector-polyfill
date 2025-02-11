var jsfeat = require('./lib/jsfeat');
var bbfFaceCascade = require('./lib/bbf_face');

let imgU8;
let lastHeight = -1;
let lastWidth = -1;

jsfeat.bbf.prepare_cascade(bbfFaceCascade);

self.onmessage = function (e) {
  const { width, height, image, scale, maxDetectedFaces, id } = e.data;

  if (width !== lastWidth || height !== lastHeight) {
    // eslint-disable-next-line new-cap
    imgU8 = new jsfeat.matrix_t(width, height, jsfeat.U8_t | jsfeat.C1_t);
    lastWidth = width;
    lastHeight = height;
  }
  
  jsfeat.imgproc.grayscale(image.data, width, height, imgU8);

  // possible options
  // jsfeat.imgproc.equalize_histogram(imgU8, imgU8);
  
  const pyr = jsfeat.bbf.build_pyramid(imgU8, 24 * 2, 24 * 2, 4);
  let rects = jsfeat.bbf.detect(pyr, bbfFaceCascade);
  rects = jsfeat.bbf.group_rectangles(rects, 1);

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
