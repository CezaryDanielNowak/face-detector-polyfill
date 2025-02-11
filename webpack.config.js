/* global __dirname, require, module*/

const webpack = require('webpack');
const UglifyJsPlugin = webpack.optimize.UglifyJsPlugin;
const path = require('path');
const isBuild = JSON.parse(process.env.npm_config_argv).cooked.includes('build');

let libraryName = 'FaceDetector';

let plugins = [], outputFile;

// plugins.push(
//   new webpack.LoaderOptionsPlugin({
//     options: {
//       worker: {
//         output: {
//           filename: "hash.worker.js",
//           chunkFilename: "[id].hash.worker.js"
//         }
//       }
//     }
//   })
// )

if (isBuild) {
  plugins.push(new UglifyJsPlugin({ minimize: true }));
  outputFile = libraryName + '.min.js';
} else {
  outputFile = libraryName + '.js';
}

const config = {
  entry: __dirname + '/src/index',
  devtool: 'source-map',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: outputFile,
    library: [libraryName],
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    rules: [
      {
        test: /(\.jsx|\.js)$/,
        loader: 'babel-loader',
        exclude: /(node_modules|bower_components)/
      },
      // {
      //   test: /(\.jsx|\.js)$/,
      //   loader: 'eslint-loader',
      //   exclude: /node_modules/
      // }
    ]
  },
  resolve: {
    modules: [path.resolve('./src')],
    extensions: ['.json', '.js']
  },
  plugins: plugins
};

module.exports = config;
