import {expect} from "chai";
import path = require("path");
import ParallelESPlugin from "../src/plugin";

import {merge} from "lodash";
import {Stats, Compilation, FileSystem} from "webpack";
import ITestDefinition = Mocha.ITestDefinition;
import * as webpack from "webpack";
import {RawSourceMap, SourceMapConsumer} from "source-map";

function readSourceMap(name: string, compilation: Compilation): RawSourceMap {
    if (!compilation.assets.hasOwnProperty(name)) {
        throw new Error(`The compilation contains no asset with the name '${name}'.`);
    }

    return JSON.parse(compilation.assets[name].source()) as RawSourceMap;
}

function readAsset(name: string, compilation: Compilation): string {
    if (!compilation.assets.hasOwnProperty(name)) {
        throw new Error(`The compilation contains no asset with the name '${name}'.`);
    }

    return compilation.assets[name].source();
}

describe("Plugin", function(this: ITestDefinition) {
    this.timeout(20000);

    it("creates one asset for the main entry and one containing the worker slave code", function() {
        return rewriteTest("simple-parallel-call-test.js").then((compilation) => {
            expect(compilation.assets).to.have.property("main");
            expect(compilation.assets).to.have.property("worker-slave.parallel.js");
        });
    });

    it("replaces the functors passed to parallel with serialized function ids", function() {
        return rewriteTest("simple-parallel-call-test.js").then(compilation => {
            const content = readAsset("main", compilation);
            expect(content).to.have.string(
`parallel_es__WEBPACK_IMPORTED_MODULE_0___default.a.from([1, 2, 3]).map({
  identifier: 'static:./test.js/_anonymous',
  _______isFunctionId: true
}).then(function (result) {
  return console.log(result);
});

/***/ })`);
        });
    });

    it("registers the functors from the 'main-thread' in the parallel worker file", function() {
        return rewriteTest("simple-parallel-call-test.js").then(compilation => {
            const content = readAsset("worker-slave.parallel.js", compilation);
            expect(content).to.have.string(`/*./test.js*/(function () {
        function _anonymous(value) {
            return value * 2;
        }

        slaveFunctionLookupTable.registerStaticFunction({
            identifier: 'static:./test.js/_anonymous',
            _______isFunctionId: true
        }, _anonymous);
    })();`);

        });
    });

    it("sets the source content for the file where functions have been extracted in the output source map", function() {
        return rewriteTest("simple-parallel-call-test.js").then(compilation => {
            /* tslint:disable: no-consecutive-blank-lines */
            const map = readSourceMap("worker-slave.parallel.js.map", compilation);

            const consumer = new SourceMapConsumer(map);
            expect(consumer.sourceContentFor("webpack:///test/cases/simple-parallel-call-test.js")).to.equal(`import parallel from "parallel-es";

parallel.from([1, 2, 3]).map(value => value * 2).then(result => console.log(result));
`);
        });
    });

    it("maps the inserted function correctly to it's original position", function() {
        return rewriteTest("simple-parallel-call-test.js").then(compilation => {
            const map = readSourceMap("worker-slave.parallel.js.map", compilation);
            const code = readAsset("worker-slave.parallel.js", compilation);
            const codeLines = code.split("\n");

            for (let line = 0; line < codeLines.length; ++line) {
                const column = codeLines[line].indexOf("function _anonymous(value)");
                if (column !== -1) {
                    const consumer = new SourceMapConsumer(map);
                    expect(consumer.originalPositionFor({column: column + 20, line: line + 1})).to.include({
                        column: 29,
                        line: 3,
                        name: "value"
                    });
                    return;
                }
            }

            expect.fail(false, true, `Function function _anonymous(value) not found in generated code\n${code}`);
        });
    });
});

function rewriteTest(fileName: string) {
    return new Promise<Compilation>((resolve, reject) => {
        const options = webpackOptions({
            entry: [ `./test/cases/${fileName}` ]
        });

        compile(options, function(error: any, stats: Stats) {
            if (error) {
                reject(error);
            }

            if (stats.compilation.errors && stats.compilation.errors.length > 0) {
                reject(stats.compilation.errors);
            }

            resolve(stats.compilation);
        });
    });
}

function getMajorWebpackVersion() {
    const semver = webpack.version;
    const majorDot = semver.indexOf(".");

    return parseInt(semver.substr(0, majorDot), 10);
}

function webpackOptions(options: object) {
    "use strict";
    return merge({
        devtool: "#source-map",
        mode: getMajorWebpackVersion() >= 4 ? "development" : undefined,
        module: {
            rules: [
                {
                    exclude: /(node_modules|bower_components|worker-slave.parallel-es6\.js)/,
                    loader: "babel-loader",
                    options: {
                        filenameRelative: "./test.js",
                        generatorOpts: {
                            quotes: "single"
                        },
                        plugins: [
                            [require.resolve("babel-plugin-parallel-es")]
                        ],
                        presets: [
                            ["es2015", { modules: false }]
                        ]
                    },
                    test: /\.js$/
                }
            ]
        },

        output: {
            filename: "[name]",
            path: path.join(__dirname, "dist")
        },

        plugins: [
            new ParallelESPlugin({ babelOptions: { generatorOpts: { quotes: "single" } } }),
            new webpack.LoaderOptionsPlugin({ debug: true })
        ]
    }, options);
}

function compile(options: object, callback: (error: any, stats: Stats, fs: FileSystem) => void) {
    const compiler = require("webpack")(options);
    const fs = new (require("memory-fs"))();
    compiler.outputFileSystem = fs;
    compiler.run(function(error: any, stats: Stats) { callback(error, stats, fs); });
}
