//var Worker = require('worker-loader?inline!./DecoderWorker.jsfeat')
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
  fastMode: true,
}

const MAX_WORK_SIZE_FAST = 320
const MAX_WORK_SIZE_SLOW = 640

export default class Library {
  constructor(options) {
    const config = Object.assign({},
      DEFAULT_OPTIONS,
      options
    )

    this.maxDetectedFaces = config.maxDetectedFaces
    this.maxWorkSize = config.fastMode ? MAX_WORK_SIZE_FAST : MAX_WORK_SIZE_SLOW
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })

    this.worker = new Worker();
    this.worker.onmessage = faceDetectorCallback
  }

  detect(input) {
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

      const scale = Math.min(this.maxWorkSize / W, this.maxWorkSize / H);
      this.canvas.width = W * scale;
      this.canvas.height = H * scale;
      
      this.ctx.drawImage(input, 0, 0, this.canvas.width, this.canvas.height);

      this.worker.postMessage({
        id: lastMsgId,
        image: this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height),
        width: this.canvas.width,
        height: this.canvas.height,
        scale: 1 / scale,
        maxDetectedFaces: this.maxDetectedFaces,
      })
    });
  }
}
