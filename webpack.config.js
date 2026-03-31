'use strict'

const path = require('path')

/** @type {import('webpack').Configuration} */
module.exports = {
  target: 'node', // VS Code extensions run in a Node.js context

  entry: './src/extension.ts',

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },

  devtool: 'nosources-source-map',

  externals: {
    // The `vscode` module is provided by VS Code at runtime — exclude it.
    vscode: 'commonjs vscode',
  },

  resolve: {
    extensions: ['.ts', '.js'],
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              // Speed up builds by skipping type-checking here;
              // run `tsc --noEmit` separately for full type safety.
              transpileOnly: false,
            },
          },
        ],
      },
    ],
  },

  performance: {
    hints: false,
  },

  optimization: {
    // Keep the bundle readable in development mode
    minimize: true,
  },

  stats: {
    errorDetails: true,
  },
}
