// var Worker = require('worker-loader?inline!./DecoderWorker.jsfeat')
var Worker = require('worker-loader?inline!./DecoderWorker.objectdetect')

// static
let lastMsgId = 0
const resolves = {}
const rejects = {}

const faceDetectorCallback = (e) => {
  // transform results in e.data.result
  const id = e.data.id
  const resolve = resolves[id]

  if (resolve) {
    const results = e.data.result.map(res => ({
      boundingBox: res,
      landmarks: null,
    }))

    resolve(results)
  }

  // cleanup
  delete resolves[id]
  delete rejects[id]
}

const DEFAULT_OPTIONS = {
  maxDetectedFaces: 1,
  maxWorkSize: 320,

  /**
   * sendGray converts ImageData to gray scale before sending it to web worker.
   * This way we are sending 4x less data to the worker but some calculations are
   * performed on the UI thread.
   *
   * @type {Boolean}
   */
  sendGray: true,
}

/**
 * Converts from a 4-channel RGBA source image to a 1-channel grayscale
 * image. Corresponds to the CV_RGB2GRAY OpenCV color space conversion.
 *
 * @param {Array} src   4-channel 8-bit source image
 * @param {Array} [dst] 1-channel 32-bit destination image
 *
 * @return {Array} 1-channel 32-bit destination image
 */
function convertRgbaToGrayscale(src, dst) {
  var srcLength = src.length;
  if (!dst) dst = new Uint32Array(srcLength >> 2);
  
  for (let i = 0; i < srcLength; i += 2) {
    dst[i >> 2] = (src[i] * 4899 + src[++i] * 9617 + src[++i] * 1868 + 8192) >> 14;
  }

  return dst;
}

export default class Library {
  constructor(config) {
    this.config = Object.assign({},
      DEFAULT_OPTIONS,
      config,
    )

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    this.worker = new Worker();
    this.worker.onmessage = faceDetectorCallback;

    this.prevGrayScaldImage = [];
  }

  remove() {
    this.worker.terminate();
    this.worker = null;
    this.canvas.remove();
    this.canvas = null;
    this.ctx = null;
    this.config = null;
    this.prevGrayScaldImage = null;
  }

  detect(input) {
    const { worker, canvas, ctx, config } = this;
    return new Promise((resolve, reject) => {
      // book keeping
      ++lastMsgId;

      resolves[lastMsgId] = resolve;
      rejects[lastMsgId] = reject;

      // videoWidth = HTMLVideoElement
      // naturalWidth = HTMLImageElement
      // width = HTMLCanvasElement
      const W = input.videoWidth || input.naturalWidth || input.width;
      const H = input.videoHeight || input.naturalHeight || input.height;

      const scale = Math.min(config.maxWorkSize / W, config.maxWorkSize / H);
      canvas.width = W * scale;
      canvas.height = H * scale;
      
      ctx.drawImage(input, 0, 0, canvas.width, canvas.height);

      let image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (config.sendGray) {
        if (this.prevGrayScaldImage.length !== image.data.length / 4) {
          this.prevGrayScaldImage = null;
        }

        this.prevGrayScaldImage = convertRgbaToGrayscale(image.data, this.prevGrayScaldImage);

        image = {
          width: image.width,
          height: image.height,
          data: this.prevGrayScaldImage,
        };
      }

      worker.postMessage({
        id: lastMsgId,
        image,
        scale: 1 / scale,
        maxDetectedFaces: config.maxDetectedFaces,
      })
    });
  }
}

