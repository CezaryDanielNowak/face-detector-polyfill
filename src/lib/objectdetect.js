// FROM: https://github.com/mtschirs/js-objectdetect/blob/master/

/**
 * Real-time object detector based on the Viola Jones Framework.
 * Compatible to OpenCV Haar Cascade Classifiers (stump based only).
 *
 * Copyright (c) 2012, Martin Tschirsich
 */
module.exports = (function() {
	"use strict";
	
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
		
		for (var i = 0; i < srcLength; i += 2) {
			dst[i >> 2] = (src[i] * 4899 + src[++i] * 9617 + src[++i] * 1868 + 8192) >> 14;
		}
		return dst;
	}
	
	/**
	 * Reduces the size of a given image by the given factor. Does NOT 
	 * perform interpolation. If interpolation is required, prefer using
	 * the drawImage() method of the <canvas> element.
	 * 
	 * @param {Array}  src	   1-channel source image
	 * @param {Number} srcWidth	 Width of the source image
	 * @param {Number} srcHeight Height of the source image
	 * @param {Number} factor	Scaling down factor (> 1.0)
	 * @param {Array}  [dst]	 1-channel destination image
	 * 
	 * @return {Array} 1-channel destination image
	 */
	function rescaleImage(src, srcWidth, srcHeight, factor, dst) {
		var srcLength = srcHeight * srcWidth,
			dstWidth = ~~(srcWidth / factor),
			dstHeight = ~~(srcHeight / factor);
		var dstIndex,
			srcIndex,
			srcEnd;
		
		if (!dst) dst = new src.constructor(dstWidth * srcHeight);
		
		for (var x = 0; x < dstWidth; ++x) {
			dstIndex = x;
			for (srcIndex = ~~(x * factor), srcEnd = srcIndex + srcLength; srcIndex < srcEnd; srcIndex += srcWidth) {
				dst[dstIndex] = src[srcIndex];
				dstIndex += dstWidth;
			}
		}
		
		dstIndex = 0;
		for (var y = 0, yEnd = dstHeight * factor; y < yEnd; y += factor) {
			for (srcIndex = ~~y * dstWidth, srcEnd = srcIndex + dstWidth; srcIndex < srcEnd; ++srcIndex) {
				dst[dstIndex] = dst[srcIndex];
				++dstIndex;
			}
		}
		return dst;
	}
	
	/**
	 * Computes the gradient magnitude using a sobel filter after
	 * applying gaussian smoothing (5x5 filter size). Useful for canny
	 * pruning.
	 * 
	 * @param {Array}  src	  1-channel source image
	 * @param {Number} srcWidth Width of the source image
	 * @param {Number} srcWidth Height of the source image
	 * @param {Array}  [dst]	1-channel destination image
	 * 
	 * @return {Array} 1-channel destination image
	 */
	function computeCanny(src, srcWidth, srcHeight, dst) {
		var srcLength = srcWidth * srcHeight;
		if (!dst) dst = new src.constructor(srcLength);
		var buffer1 = dst === src ? new src.constructor(srcLength) : dst;
		var buffer2 = new src.constructor(srcLength);
		var x, y, index;
		
		// Gaussian filter with size=5, sigma=sqrt(2) horizontal pass:
		for (x = 2; x < srcWidth - 2; ++x) {
			index = x;
			for (y = 0; y < srcHeight; ++y) {
				buffer1[index] =
					0.1117 * src[index - 2] +
					0.2365 * src[index - 1] +
					0.3036 * src[index] +
					0.2365 * src[index + 1] +
					0.1117 * src[index + 2];
				index += srcWidth;
			}
		}
		
		// Gaussian filter with size=5, sigma=sqrt(2) vertical pass:
		for (x = 0; x < srcWidth; ++x) {
			index = x + srcWidth;
			for (y = 2; y < srcHeight - 2; ++y) {
				index += srcWidth;
				buffer2[index] =
					0.1117 * buffer1[index - srcWidth - srcWidth] +
					0.2365 * buffer1[index - srcWidth] +
					0.3036 * buffer1[index] +
					0.2365 * buffer1[index + srcWidth] +
					0.1117 * buffer1[index + srcWidth + srcWidth];
			}
		}
		
		// Compute gradient:
		var abs = Math.abs;
		for (x = 2; x < srcWidth - 2; ++x) {
			index = x + srcWidth;
			for (y = 2; y < srcHeight - 2; ++y) {
				index += srcWidth;
				
				dst[index] = 
					abs(-	 buffer2[index - 1 - srcWidth]
						+	 buffer2[index + 1 - srcWidth]
						- 2 * buffer2[index - 1]
						+ 2 * buffer2[index + 1]
						-	 buffer2[index - 1 + srcWidth]
						+	 buffer2[index + 1 + srcWidth]) +
					
					abs(	  buffer2[index - 1 - srcWidth]
						+ 2 * buffer2[index - srcWidth]
						+	 buffer2[index + 1 - srcWidth]
						-	 buffer2[index - 1 + srcWidth]
						- 2 * buffer2[index + srcWidth]
						-	 buffer2[index + 1 + srcWidth]);
			}
		}
		return dst;
	}

	/**
	 * Computes the integral image of a 1-channel image. Arithmetic
	 * overflow may occur if the integral exceeds the limits for the
	 * destination image values ([0, 2^32-1] for an unsigned 32-bit image).
	 * The integral image is 1 pixel wider both in vertical and horizontal
	 * dimension compared to the source image.
	 * 
	 * SAT = Summed Area Table.
	 * 
	 * @param {Array}	   src	   1-channel source image
	 * @param {Number}	  srcWidth  Width of the source image
	 * @param {Number}	  srcHeight Height of the source image
	 * @param {Uint32Array} [dst]	 1-channel destination image
	 * 
	 * @return {Uint32Array} 1-channel destination image
	 */
	function computeSat(src, srcWidth, srcHeight, dst) {
		var dstWidth = srcWidth + 1;
		
		if (!dst) dst = new Uint32Array(srcWidth * srcHeight + dstWidth + srcHeight);
		
		for (var i = srcHeight * dstWidth; i >= 0; i -= dstWidth)
			dst[i] = 0;
		
		for (var x = 1; x <= srcWidth; ++x) {
			var columnSum = 0;
			var index = x;
			dst[x] = 0;
			
			for (var y = 1; y <= srcHeight; ++y) {
				columnSum += src[index - y];
				index += dstWidth;
				dst[index] = dst[index - 1] + columnSum;
			}
		}
		return dst;
	}
	
	/**
	 * Computes the squared integral image of a 1-channel image.
	 * @see computeSat()
	 * 
	 * @param {Array}	   src	   1-channel source image
	 * @param {Number}	  srcWidth  Width of the source image
	 * @param {Number}	  srcHeight Height of the source image
	 * @param {Uint32Array} [dst]	 1-channel destination image
	 * 
	 * @return {Uint32Array} 1-channel destination image
	 */
	function computeSquaredSat(src, srcWidth, srcHeight, dst) {
		var dstWidth = srcWidth + 1;
	
		if (!dst) dst = new Uint32Array(srcWidth * srcHeight + dstWidth + srcHeight);
		
		for (var i = srcHeight * dstWidth; i >= 0; i -= dstWidth)
			dst[i] = 0;
		
		for (var x = 1; x <= srcWidth; ++x) {
			var columnSum = 0;
			var index = x;
			dst[x] = 0;
			for (var y = 1; y <= srcHeight; ++y) {
				var val = src[index - y];
				columnSum += val * val;
				index += dstWidth;
				dst[index] = dst[index - 1] + columnSum;
			}
		}
		return dst;
	}
	
	/**
	 * Computes the rotated / tilted integral image of a 1-channel image.
	 * @see computeSat()
	 * 
	 * @param {Array}	   src	   1-channel source image
	 * @param {Number}	  srcWidth  Width of the source image
	 * @param {Number}	  srcHeight Height of the source image
	 * @param {Uint32Array} [dst]	 1-channel destination image
	 * 
	 * @return {Uint32Array} 1-channel destination image
	 */
	function computeRsat(src, srcWidth, srcHeight, dst) {
		var dstWidth = srcWidth + 1,
			srcHeightTimesDstWidth = srcHeight * dstWidth;
		var i, y, x;
			
		if (!dst) dst = new Uint32Array(srcWidth * srcHeight + dstWidth + srcHeight);
		
		for (i = srcHeightTimesDstWidth; i >= 0; i -= dstWidth)
			dst[i] = 0;
		
		for (i = 0; i < dstWidth; ++i)
			dst[i] = 0;
		
		var index = 0;
		for (y = 0; y < srcHeight; ++y) {
			for (x = 0; x < srcWidth; ++x) {
				dst[index + dstWidth + 1] = src[index - y] + dst[index];
				++index;
			}
			dst[index + dstWidth] += dst[index];
			index++;
		}
		
		for (x = srcWidth - 1; x > 0; --x) {
			index = x + srcHeightTimesDstWidth;
			for (y = srcHeight; y > 0; --y) {
				index -= dstWidth;
				dst[index + dstWidth] += dst[index] + dst[index + 1];
			}
		}
		
		return dst;
	}
	
	/**
	 * Compiles a cascade classifier to be applicable to images
	 * of given dimensions. Speeds-up the actual detection process later on.
	 * 
	 * @param {Array}		src	Cascade classifier
	 * @param {Number}	   width  Width of the source image
	 * @param {Float32Array} [dst]  Compiled cascade classifier
	 * 
	 * @return {Float32Array} Compiled cascade classifier
	 */
	function compileClassifier(src, width, scale, dst) {
		width += 1;
		if (!dst) dst = new Float32Array(src.length);
		var dstUint32 = new Uint32Array(dst.buffer);
		var kEnd;

		dstUint32[0] = src[0];
		dstUint32[1] = src[1];
		var dstIndex = 1;
		for (var srcIndex = 1, iEnd = src.length - 1; srcIndex < iEnd; ) {
			dst[++dstIndex] = src[++srcIndex];
			
			var numComplexClassifiers = dstUint32[++dstIndex] = src[++srcIndex];
			for (var j = 0, jEnd = numComplexClassifiers; j < jEnd; ++j) {
				
				var tilted = dst[++dstIndex] = src[++srcIndex];
				var numFeaturesTimes3 = dstUint32[++dstIndex] = src[++srcIndex] * 3;
				if (tilted) {
					for (kEnd = dstIndex + numFeaturesTimes3; dstIndex < kEnd; ) {
						dstUint32[++dstIndex] = src[++srcIndex] + src[++srcIndex] * width;
						dstUint32[++dstIndex] = src[++srcIndex] * (width + 1) + ((src[++srcIndex] * (width - 1)) << 16);
						dst[++dstIndex] = src[++srcIndex];
					}
				} else {
					for (kEnd = dstIndex + numFeaturesTimes3; dstIndex < kEnd; ) {
						dstUint32[++dstIndex] = src[++srcIndex] + src[++srcIndex] * width;
						dstUint32[++dstIndex] = src[++srcIndex] + ((src[++srcIndex] * width) << 16);
						dst[++dstIndex] = src[++srcIndex];
					}
				}
				
				var inverseClassifierThreshold = 1 / src[++srcIndex];
				for (var k = 0; k < numFeaturesTimes3; ) {
					dst[dstIndex - k] *= inverseClassifierThreshold;
					k += 3;
				}

				if (inverseClassifierThreshold < 0) {
					dst[dstIndex + 2] = src[++srcIndex];
					dst[dstIndex + 1] = src[++srcIndex];
					dstIndex += 2;
				} else {
					dst[++dstIndex] = src[++srcIndex];
					dst[++dstIndex] = src[++srcIndex];
				}
			}
		}

		return dst.subarray(0, dstIndex + 1);
	}
	
	/**
	 * Evaluates a compiled cascade classifier. Sliding window approach.
	 * 
	 * @param {Uint32Array}  sat		SAT of the source image
	 * @param {Uint32Array}  rsat	   Rotated SAT of the source image
	 * @param {Uint32Array}  ssat	   Squared SAT of the source image
	 * @param {Uint32Array}  [cannySat] SAT of the canny source image
	 * @param {Number}	   width	  Width of the source image
	 * @param {Number}	   height	 Height of the source image
	 * @param {Number}	   step	   Stepsize, increase for performance
	 * @param {Float32Array} classifier Compiled cascade classifier
	 *
	 * @return {Array} Rectangles representing detected objects
	 */
	function detect(sat, rsat, ssat, cannySat, width, height, step, classifier) {
		width  += 1;
		height += 1;
		
		var classifierUint32 = new Uint32Array(classifier.buffer),
			windowWidth  = classifierUint32[0],
			windowHeight = classifierUint32[1],
			windowHeightTimesWidth = windowHeight * width,
			area = windowWidth * windowHeight,
			inverseArea = 1 / area,
			widthTimesStep = width * step,
			rects = [],
			kEnd, packed, f1, f2, f3;
		
		for (var x = 0; x + windowWidth < width; x += step) {
			var satIndex = x;
			for (var y = 0; y + windowHeight < height; y += step) {					
				var satIndex1 = satIndex + windowWidth,
					satIndex2 = satIndex + windowHeightTimesWidth,
					satIndex3 = satIndex2 + windowWidth,
					canny = false;

				// Canny test:
				if (cannySat) {
					var edgesDensity = (cannySat[satIndex] -
										cannySat[satIndex1] -
										cannySat[satIndex2] +
										cannySat[satIndex3]) * inverseArea;
					if (edgesDensity < 60 || edgesDensity > 200) {
						canny = true;
						satIndex += widthTimesStep;
						continue;
					}
				}
				
				// Normalize mean and variance of window area:
				var mean = (sat[satIndex] -
							sat[satIndex1] -
							sat[satIndex2] +
							sat[satIndex3]),
					
					variance = (ssat[satIndex] -
								ssat[satIndex1] -
								ssat[satIndex2] +
								ssat[satIndex3]) * area - mean * mean,
								
					std = variance > 1 ? Math.sqrt(variance) : 1,
					found = true;
				
				// Evaluate cascade classifier aka 'stages':
				for (var i = 1, iEnd = classifier.length - 1; i < iEnd; ) {
					var complexClassifierThreshold = classifier[++i];
					// Evaluate complex classifiers aka 'trees':
					var complexClassifierSum = 0;
					for (var j = 0, jEnd = classifierUint32[++i]; j < jEnd; ++j) {
						
						// Evaluate simple classifiers aka 'nodes':
						var simpleClassifierSum = 0;
						
						if (classifierUint32[++i]) {
							// Simple classifier is tilted:
							for (kEnd = i + classifierUint32[++i]; i < kEnd; ) {
								f1 = satIndex + classifierUint32[++i];
								packed = classifierUint32[++i];
								f2 = f1 + (packed & 0xFFFF);
								f3 = f1 + (packed >> 16 & 0xFFFF);
								
								simpleClassifierSum += classifier[++i] *
									(rsat[f1] - rsat[f2] - rsat[f3] + rsat[f2 + f3 - f1]);
							}
						} else {
							// Simple classifier is not tilted:
							for (kEnd = i + classifierUint32[++i]; i < kEnd; ) {
								f1 = satIndex + classifierUint32[++i];
								packed = classifierUint32[++i];
								f2 = f1 + (packed & 0xFFFF);
								f3 = f1 + (packed >> 16 & 0xFFFF);
								
								simpleClassifierSum += classifier[++i] *
									(sat[f1] - sat[f2] - sat[f3] + sat[f2 + f3 - f1]);
							}
						}
						complexClassifierSum += classifier[i + (simpleClassifierSum > std ? 2 : 1)];
						i += 2;
					}
					if (complexClassifierSum < complexClassifierThreshold) {
						found = false;
						break;
					}
				}
				if (found) rects.push([x, y, windowWidth, windowHeight]);
				satIndex += widthTimesStep;
			}
		}
		return rects;
	}
	
	/**
	 * Groups rectangles together using a rectilinear distance metric. For
	 * each group of related rectangles, a representative mean rectangle
	 * is returned.
	 * 
	 * @param {Array}  rects		Rectangles (Arrays of 4 floats)
	 * @param {Number} minNeighbors Minimum neighbors for returned groups
	 * @param {Number} confluence	Neighbor distance threshold factor
	 * @return {Array} Mean rectangles (Arrays of 4 floats)
	 */
	function groupRectangles(rects, minNeighbors, confluence) {
		var rectsLength = rects.length;
		var i, j, group;
		if (!confluence) confluence = 0.25;
		
		// Partition rects into similarity classes:
		var numClasses = 0;
		var labels = new Array(rectsLength);
		for (i = 0; i < rectsLength; ++i) {
			labels[i] = 0;
		}
		
		var abs = Math.abs, min = Math.min;
		for (i = 0; i < rectsLength; ++i) {
			var found = false;
			for (j = 0; j < i; ++j) {
				
				// Determine similarity:
				var rect1 = rects[i];
				var rect2 = rects[j];
				var delta = confluence * (min(rect1[2], rect2[2]) + min(rect1[3], rect2[3]));
				if (abs(rect1[0] - rect2[0]) <= delta &&
					abs(rect1[1] - rect2[1]) <= delta &&
					abs(rect1[0] + rect1[2] - rect2[0] - rect2[2]) <= delta &&
					abs(rect1[1] + rect1[3] - rect2[1] - rect2[3]) <= delta) {
					
					labels[i] = labels[j];
					found = true;
					break;
				}
			}
			if (!found) {
				labels[i] = numClasses++;
			}
		}
		
		// Compute average rectangle (group) for each cluster:
		var groups = new Array(numClasses);
		
		for (i = 0; i < numClasses; ++i) {
			groups[i] = [0, 0, 0, 0, 0];
		}
		
		for (i = 0; i < rectsLength; ++i) {
			var rect = rects[i];
			group = groups[labels[i]];
			group[0] += rect[0];
			group[1] += rect[1];
			group[2] += rect[2];
			group[3] += rect[3];
			++group[4];
		}
		
		for (i = 0; i < numClasses; ++i) {
			var numNeighbors = groups[i][4];
			if (numNeighbors >= minNeighbors) {
				group = groups[i];
				numNeighbors = 1 / numNeighbors;
				group[0] *= numNeighbors;
				group[1] *= numNeighbors;
				group[2] *= numNeighbors;
				group[3] *= numNeighbors;
			} else groups.splice(i, 1);
		}
		
		// Filter out small rectangles inside larger rectangles:
		var filteredGroups = [];
		for (i = 0; i < numClasses; ++i) {
			var r1 = groups[i];
			
			for (j = i + 1; j < numClasses; ++j) {
				var r2 = groups[j];
				
				var dx = r2[2] * confluence;// * 0.2;
				var dy = r2[3] * confluence;// * 0.2;
				
				// Not antisymmetric, must check both r1 > r2 and r2 > r1:
				if ((r1[0] >= r2[0] - dx &&
					 r1[1] >= r2[1] - dy &&
					 r1[0] + r1[2] <= r2[0] + r2[2] + dx &&
					 r1[1] + r1[3] <= r2[1] + r2[3] + dy) ||
					(r2[0] >= r1[0] - dx &&
					 r2[1] >= r1[1] - dy &&
					 r2[0] + r2[2] <= r1[0] + r1[2] + dx &&
					 r2[1] + r2[3] <= r1[1] + r1[3] + dy)) {
					break;
				}
			}
			
			if (j === numClasses) {
				filteredGroups.push(r1);
			}
		}
		return filteredGroups;
	}
		
	return class Detector {
		/**
		 * Creates a new detector - basically a convenient wrapper class around
		 * the js-objectdetect functions and hides away the technical details
		 * of multi-scale object detection on image, video or canvas elements.
		 * 
		 * @param width	   Width of the detector
		 * @param height	  Height of the detector
		 * @param scaleFactor Scaling factor for multi-scale detection
		 * @param classifier  Compiled cascade classifier
		 */
		constructor(width, height, scaleFactor, classifier) {
			// this.canvas = document.createElement('canvas');
			// this.canvas.width = width;
			// this.canvas.height = height;
			// this.context = this.canvas.getContext('2d');
			this.tilted = classifier.tilted;
			this.scaleFactor = scaleFactor;
			this.scaledGray = new Uint32Array(width * height);

			var numScales = ~~(Math.log(Math.min(width / classifier[0], height / classifier[1])) / Math.log(scaleFactor));
			this.compiledClassifiers = Array.from({ length: numScales });
			var scale = 1;
			for (var i = 0; i < numScales; ++i) {
				var scaledWidth = ~~(width / scale);
				this.compiledClassifiers[i] = compileClassifier(classifier, scaledWidth);
				scale *= scaleFactor;
			}
		}

		/**
		 * Multi-scale object detection on image, video or canvas elements. 
		 * 
		 * @param image		  HTML image, video or canvas element
		 * @param [group]		Detection results will be grouped by proximity
		 * @param [stepSize]	 Increase for performance
		 * @param [roi]		  Region of interest, i.e. search window
		 * 
		 * @return Grouped rectangles
		 */
		detect(_imageData, group, stepSize, roi, canny) {
			if (stepSize === undefined) stepSize = 1;
			if (group === undefined) group = 1;
			
			// var width = this.canvas.width;
			// var height = this.canvas.height;
			
			// if (roi)
			// 	this.context.drawImage(image, roi[0], roi[1], roi[2], roi[3], 0, 0, width, height);
			// else
			// 	this.context.drawImage(image, 0, 0, width, height);
			// var imageData = this.context.getImageData(0, 0, width, height).data;
			const width = _imageData.width;
			const height = _imageData.height;
			const imageData = _imageData.data;
			const isGray = imageData.length < width * height * 4;

			this.gray = isGray
				? imageData
				: convertRgbaToGrayscale(imageData, this.gray);
			
			var rects = [];
			var scale = 1;
			for (var i = 0; i < this.compiledClassifiers.length; ++i) {
				var scaledWidth = ~~(width / scale);
				var scaledHeight = ~~(height / scale);
				
				if (scale === 1) {
					this.scaledGray.set(this.gray);
				} else {
					this.scaledGray = rescaleImage(this.gray, width, height, scale, this.scaledGray);
				}
				
				if (canny) {
					this.canny = computeCanny(this.scaledGray, scaledWidth, scaledHeight, this.canny);
					this.cannySat = computeSat(this.canny, scaledWidth, scaledHeight, this.cannySat);
				}
				
				this.sat = computeSat(this.scaledGray, scaledWidth, scaledHeight, this.sat);
				this.ssat = computeSquaredSat(this.scaledGray, scaledWidth, scaledHeight, this.ssat);
				if (this.tilted) this.rsat = computeRsat(this.scaledGray, scaledWidth, scaledHeight, this.rsat);

				var newRects = detect(this.sat, this.rsat, this.ssat, this.cannySat, scaledWidth, scaledHeight, stepSize, this.compiledClassifiers[i]);
				for (var j = newRects.length - 1; j >= 0; --j) {
					var newRect = newRects[j];
					newRect[0] *= scale;
					newRect[1] *= scale;
					newRect[2] *= scale;
					newRect[3] *= scale;
				}
				rects = rects.concat(newRects);
				
				scale *= this.scaleFactor;
			}
			return (group ? groupRectangles(rects, group) : rects).sort(function(r1, r2) {return r2[4] - r1[4];});
		}
	};
})();