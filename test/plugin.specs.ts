import {expect} from "chai";
import path = require("path");
import fs = require("fs");
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

    return compilation.assets[name].map();
}

function readAsset(name: string, compilation: Compilation): string {
    if (!compilation.assets.hasOwnProperty(name)) {
        throw new Error(`The compilation contains no asset with the name '${name}'.`);
    }

    return compilation.assets[name].source();
}

describe("Plugin", function (this: ITestDefinition) {
    this.timeout(20000);

    it("creates one asset for the main entry and one containing the worker slave code", function () {
        return rewriteTest("simple-parallel-call-test.js").then((compilation) => {
            expect(compilation.assets).to.have.property("main");
            expect(compilation.assets).to.have.property("worker-slave.parallel");
        });
    });

    it("replaces the functors passed to parallel with serialized function ids", function () {
        return rewriteTest("simple-parallel-call-test.js").then(compilation => {
            const content =  readAsset("main", compilation);
            expect(content).to.have.match(/\.from\(\[1, 2, 3\]\)\.map\(\{\s*identifier: "static-\/.*\/test\/cases\/simple-parallel-call-test\.js#program\.body\[1\]\.expression\.callee\.object\.arguments\[0\]",\s*_______isFunctionId: true\s*\}\)/);
        });
    });

    it("registers the functors from the 'main-thread' in the parallel worker file", function () {
        return rewriteTest("simple-parallel-call-test.js").then(compilation => {
            const content = readAsset("worker-slave.parallel", compilation);
            expect(content).to.have.match(/slaveFunctionLookupTable\.registerStaticFunction\(\{\s*identifier: 'static-\/.*\/test\/cases\/simple-parallel-call-test\.js#program\.body\[1\]\.expression\.callee\.object\.arguments\[0\]',\s*_______isFunctionId: true\s*\}, value => value \* 2\);/);
        });
    });

    it("sets the source content for the file where functions have been extracted in the output source map", function () {
        return rewriteTest("simple-parallel-call-test.js").then(compilation => {
            const map = readSourceMap("worker-slave.parallel", compilation);

            const consumer = new SourceMapConsumer(map);
            expect(consumer.sourceContentFor(path.resolve("./test/cases/simple-parallel-call-test.js"))).to.equal(fs.readFileSync("./test/cases/simple-parallel-call-test.js", "utf-8"));
        });
    });

    it("maps the inserted function correctly to it's original position", function () {
        return rewriteTest("simple-parallel-call-test.js").then(compilation => {
            const map = readSourceMap("worker-slave.parallel", compilation);
            const code = readAsset("worker-slave.parallel", compilation);
            const codeLines = code.split("\n");

            for (let line = 0; line < codeLines.length; ++line) {
                const column = codeLines[line].indexOf("value => value * 2");
                if (column !== -1) {
                    const consumer = new SourceMapConsumer(map);
                    expect(consumer.originalPositionFor({line: line + 1, column})).to.include({
                        column: 29,
                        line: 3,
                        name: "value"
                    });
                    return;
                }
            }

            expect.fail("Function value => value * 2 not found in generated code");
        });
    });
});

function rewriteTest(fileName: string) {
    return new Promise<Compilation>((resolve, reject) => {
        const options = webpackOptions({
            entry: [ `./test/cases/${fileName}` ]
        });

        compile(options, function (error: any, stats: Stats) {
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

function webpackOptions(options: Object) {
    "use strict";
    return merge({
        devtool: "#source-map",
        module: {
            loaders: [
                {
                    loader: "babel-loader",
                    query: {
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
            new ParallelESPlugin(),
            new webpack.LoaderOptionsPlugin({ debug: true })
        ]
    }, options);
}

function compile(options: Object, callback: (error: any, stats: Stats, fs: FileSystem) => void) {
    const compiler = require("webpack")(options);
    const fs = new (require("memory-fs"))();
    compiler.outputFileSystem = fs;
    compiler.run(function (error: any, stats: Stats) { callback(error, stats, fs); });
}
