const path = require('path')
const html = require('html-webpack-plugin')

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: path.resolve(__dirname, '../src/vue.js'),
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: '[name].esm-browser.js',
    clean: true //每次构建清除dist包
  },
  plugins: [
    new html({
      template: path.resolve(__dirname, '../src/index.html'),
      filename: 'index.html',
      minify: {
        // 移除空格
        collapseWhitespace: true,
        // 移除注释
        removeComments: true
      }
    })
    // {
    //   test: /\.(css|scss|sass)$/,
    //   use: [
    //     'style-loader',
    //     'css-loader',
    //     {
    //       loader: 'postcss-loader',
    //       options: {
    //         postcssOptions: {
    //           plugins: ['autoprefixer']
    //         }
    //       }
    //     },
    //     'sass-loader'
    //   ]
    // }
  ]
}
