// var Worker = require('worker-loader?inline!./DecoderWorker.jsfeat')
// var Worker = require('worker-loader?inline!./DecoderWorker.objectdetect-haar')
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
}

export default class Library {
  constructor(options) {
    this.config = Object.assign({},
      DEFAULT_OPTIONS,
      options
    )

    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })

    this.worker = new Worker();
    this.worker.onmessage = faceDetectorCallback
  }

  remove() {
    this.worker.terminate();
    this.worker = null;
    this.canvas.remove();
    this.canvas = null;
    this.ctx = null;
    this.config = null;
  }

  detect(input) {
    const { worker, canvas, ctx, config } = this;
    return new Promise((resolve, reject) => {
      // book keeping
      ++lastMsgId;

      resolves[lastMsgId] = resolve
      rejects[lastMsgId] = reject

      // videoWidth = HTMLVideoElement
      // naturalWidth = HTMLImageElement
      // width = HTMLCanvasElement
      const W = input.videoWidth || input.naturalWidth || input.width
      const H = input.videoHeight || input.naturalHeight || input.height

      const scale = Math.min(config.maxWorkSize / W, config.maxWorkSize / H);
      canvas.width = W * scale;
      canvas.height = H * scale;
      
      ctx.drawImage(input, 0, 0, canvas.width, canvas.height);

      worker.postMessage({
        id: lastMsgId,
        image: ctx.getImageData(0, 0, canvas.width, canvas.height),
        width: canvas.width,
        height: canvas.height,
        scale: 1 / scale,
        maxDetectedFaces: config.maxDetectedFaces,
      })
    });
  }
}
