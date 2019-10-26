const path = require('path');
const glob = require('glob')

const fs = require('fs')
const webpack = require('webpack');
const HappyPack = require('happypack');
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const BrowserSyncPlugin = require('browser-sync-webpack-plugin');
const ImageminPlugin = require('imagemin-webpack-plugin').default;
const imageminMozjpeg = require('imagemin-mozjpeg');
const multiJsonLoader = require('multi-json-loader');
const smp = new SpeedMeasurePlugin();
const happyThreadPool = HappyPack.ThreadPool({ size: 4 });
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const PACKAGE = require('./package.json');
const assetPath = PACKAGE.assetPath;
const SpriteLoaderPlugin = require('svg-sprite-loader/plugin');


const siteData = multiJsonLoader.loadFiles('./src/_data');

let runMod = "development";


if (process.argv.indexOf('--dev') === -1) {
  console.log('Running production build......');
  runMod = 'production'
} else {
  console.log('Running development build......');
  runMod = 'development'
}


function loadJsonFiles(startPath, parentObj) {
  var files=fs.readdirSync(startPath);

  for(var i=0;i<files.length;i++){
    var filename=path.join(startPath,files[i]);
    var stat = fs.lstatSync(filename);
    if (stat.isDirectory()){
      parentObj[`${files[i]}`] = multiJsonLoader.loadFiles(filename);
      loadJsonFiles(filename, parentObj[`${files[i]}`]);
    }
  } 
}

loadJsonFiles('./src/_data', siteData);

function findFilesInDir(startPath,filter){

  var results = [];

  if (!fs.existsSync(startPath)){
      console.log("no dir ",startPath);
      return;
  }

  var files=fs.readdirSync(startPath);
  for(var i=0;i<files.length;i++){
      var filename=path.join(startPath,files[i]);
      var stat = fs.lstatSync(filename);
      if (stat.isDirectory()){
          results = results.concat(findFilesInDir(filename,filter)); //recurse
      }
      else if ((filename.indexOf(filter)>=0) && (filename.indexOf('_modules') === -1) && (filename.indexOf('_layouts') === -1)) {
          //console.log('-- found: ',filename);
        var actualFilename = filename.replace('src/','');
        actualFilename = actualFilename.replace(/src\\/g, '');
        results.push(actualFilename);
      }
  }
  return results;
}

function generateHtmlPlugins (templateDir) {
  // Read files in template directory
  const templateFiles = findFilesInDir(templateDir,'.pug');
  return templateFiles.map(item => {
    // Split names and extension
    const parts = item.split('.')
    const name = parts[0]
    const extension = parts[1]
    // Create new HTMLWebpackPlugin with options
    return new HtmlWebpackPlugin({
      filename: `${name}.html`,
      template: path.resolve(__dirname, `${templateDir}/${name}.${extension}`),
      cache: false,
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true
      },
      hash: true,
      inject: false,
      alwaysWriteToDisk: true,
      data: siteData,
    })
  })
}


function generateModRules(envMode) {

  const devModRules = [
    {
      test: /\.js$/,
      exclude: /node_modules/,
      use: "happypack/loader?id=js"
    },
    {
      test: /\.(sa|sc|c)ss$/,
      use: [
        MiniCssExtractPlugin.loader,
        'css-loader',
        'postcss-loader',
        'fast-sass-loader',
      ],
    },
    {
      test: /\.pug$/,
      use: "happypack/loader?id=html"
    },
    {
      test: /\.svg$/,
      use: [
        'svg-sprite-loader',
        'svgo-loader'
      ]
    },
  ]

  const prodModRules = [
    {
      test: /\.js$/,
      exclude: /node_modules/,
      use: "babel-loader?cacheDirectory"
    },
    {
      test: /\.(sa|sc|c)ss$/,
      use: [
        MiniCssExtractPlugin.loader,
        'css-loader',
        'postcss-loader',
        'fast-sass-loader',
      ],
    },
    {
      test: /\.pug$/,
      use: "pug-loader?pretty=true"
    },
    {
      test: /\.svg$/,
      use: [
        'svg-sprite-loader',
        'svgo-loader'
      ]
    },
  ]

  if (envMode === 'production') {
    return prodModRules;
  } else {
    return devModRules;
  }
}


function generatePlugins (envMode) {

  const devPlugins = [
    new webpack.HotModuleReplacementPlugin(),

    new HappyPack({
      id: 'html',
      loaders: ['pug-loader?pretty=true'],
      threadPool: happyThreadPool
    }),
    
    new HappyPack({
      id: 'js',
      loaders: ['babel-loader?cacheDirectory' ],
      threadPool: happyThreadPool
    }),

    new BrowserSyncPlugin(
      {
        files: ['styles/**/*.css', '**/*.html', '!/assets/**/*'],
        host: 'localhost',
        port: 3001,
        proxy: 'http://localhost:3000/'
      },
      {
        reload: true,
        injectCss: true
      },
      
    )
  ] 


  const prodPlugins = [
    
    new ImageminPlugin({ 
      test: /\.(jpe?g|png|gif)$/i,
      plugins: [
        imageminMozjpeg({
          quality: 70,
          progressive: true
        })
      ]
    })
  ]


  if ( envMode === 'production') {
    return prodPlugins;
  } else {
    return devPlugins;
  }
}

const htmlPlugins = generateHtmlPlugins('./src');

const buildPlugins = generatePlugins(runMod);

const moduleRules = generateModRules(runMod);

// modules for css minification and trash removing
const PurgecssPlugin    = require('purgecss-webpack-plugin')

const PATHS = {
  src: path.join(__dirname, 'src')
}


module.exports = smp.wrap({
  entry:  path.resolve(__dirname, 'src/_scripts/main.js'),
  mode: process.env.NODE_ENV,
  output: {
    filename: `${assetPath}/scripts/main.js`,
    path: path.resolve(__dirname, 'docs'),
    publicPath: "/"
  },
  module: {
    rules: moduleRules
  },
  plugins: [
    new SpriteLoaderPlugin(),
    new CleanWebpackPlugin(),
    new CopyWebpackPlugin([
      {from:'src/_images',to:`${assetPath}/images`},
      // {from:'src/_fonts',to:`${assetPath}/fonts`},
      {from:'src/_api',to:'api'},
      {from:'src/php',to:'php'},
      {from:'CNAME',to:'CNAME',toType: 'file',},
    ]),
   
    // new webpack.ProvidePlugin({
    //   $: 'jquery',
    //   jQuery: 'jquery',
    //   'window.jQuery': 'jquery',
    //   $j: 'jquery'
    // }),

    new MiniCssExtractPlugin({
      filename: `${assetPath}/styles/main.css?[contenthash]`
    }),

    // определение css файлов, которые будут минимизированны
    new PurgecssPlugin({
      paths: glob.sync(`${PATHS.src}/**/*`, { nodir: true }),
      whitelistPatterns: [/link_.*/,/header_.*/]
    }),

  ].concat(htmlPlugins, buildPlugins),
  devServer: {
    contentBase: path.resolve(__dirname, 'docs'),
    watchContentBase: true,
    publicPath: '/',
    hot:false,
    inline: true,
    port: 3000
  },
  resolve: {
    modules: [
      "node_modules"
    ],
    alias: {
 
    }
  },
  optimization: {
    minimizer: [
      new UglifyJsPlugin({
        test: /\.js(\?.*)?$/i,
        extractComments: true,
      }),
    ],
  },
});
