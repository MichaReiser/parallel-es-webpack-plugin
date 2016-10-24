# Parallel.ES Webpack Plugin
[![Build Status](https://travis-ci.org/DatenMetzgerX/parallel-es-webpack-plugin.svg?branch=master)](https://travis-ci.org/DatenMetzgerX/parallel-es-webpack-plugin) [![Coverage Status](https://coveralls.io/repos/github/DatenMetzgerX/parallel-es-webpack-plugin/badge.svg?branch=master)](https://coveralls.io/github/DatenMetzgerX/parallel-es-webpack-plugin?branch=master)

A Webpack Plugin that rewrites your [Parallel.ES](https://datenmetzgerx.github.io/parallel.es/) code to add support for debugging your worker code, accessing variables and calling functions from the outer scope from parallel functions and using imports.

## Getting Started
Install the webpack plugin using npm:

```sh
npm install --save-dev parallel-es-wepback-plugin
```

Import the plugin, add it to your webpack configuration and enable babel loader for your source files: 

```js
var path = require("path");
var ParallelEsPlugin = require("parallel-es-webpack-plugin"); // <—— Import Plugin

const FILE_NAME = "[name].js";

module.exports = {
    devtool: "#source-map",
    entry: {
        examples: "./src/browser-example.js"
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "[name].js"
    },
    module: {
        loaders: [
            {
                test: /\.js$/,         // <—— Add Babel-Loader
                loader: "babel-loader",
                query: {
	                "plugins": ["parallel-es"]   // <— Add Babel Plugin
                }
            }
        ]
    },
    plugins: [
        new ParallelEsPlugin()  // <———— Add Webpack Plugin
    ]
};
```

Of course, you can also add the babel-plugin in your `.babelrc`

## Use ES5 Version of Parallel.ES
The Plugin uses by default the ES6 Version of Parallel.ES. If you want to use the ES5 version instead, you can define the file to use in the plugin constructor:

```js
…
plugins: [
	new ParallelEsPlugin({
		workerSlaveFileName: "parallel-es/dist/worker-slave.parallel-es.js" 
	})  
]
…
```

## Transpile Source Code
You can normally transpile your source code using babel (in combination with the babel loader). However, the code of the parallel-es plugin is not transpiled by default. The babel options for the parallel-es plugin can be configured by passing them in the plugin constructor:

```js
…
new ParallelEsPlugin({
	babelOptions: {
		"presets": [
			["es2015", { "modules": false }]
		]
	}
})
…
```

## Sample Configuration / Project
The [Parallel-ES-Rewriter-Example](https://github.com/DatenMetzgerX/parallel-es-rewriter-example) is a small project that is using the parallel-es-webpack-plugin to rewrite the code.

## Internals
The Plugin does not perform the code rewriting itself. The code rewriting is performed by the [babel-plugin-parallel-es](https://github.com/DatenMetzgerX/babel-plugin-parallel-es)
