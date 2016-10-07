import {Compiler} from "webpack";
import SingleEntryPlugin = require("webpack/lib/SingleEntryPlugin");
import {IPluginOptions} from "./plugin-options";

class ParallelESPlugin {
    private options: IPluginOptions;

    constructor(options?: IPluginOptions) {
        options = options || {};
        options.workerSlaveFileName = options.workerSlaveFileName || "parallel-es/dist/worker-slave.parallel-es6.js";
        options.babelOptions = options.babelOptions || {};
        options.babelOptions.babelrc = false;
        options.babelOptions.plugins = options.babelOptions.plugins || [];
        options.babelOptions.plugins.push(require.resolve("babel-plugin-parallel-es/dist/src/worker-rewriter/worker-rewriter-plugin"));

        this.options = options;
    }

    public apply(compiler: Compiler) {
        compiler.plugin("compilation", compilation => {
            if (compilation.compiler.isChild()) {
                return;
            }

            const childCompiler = compilation.createChildCompiler("parallel-es-worker", {});
            const query = this.options.babelOptions;

            const loader = require.resolve("babel-loader");
            const request = `${loader}?${JSON.stringify(query)}!${this.options.workerSlaveFileName}`;
            childCompiler.apply(new SingleEntryPlugin(compiler.context, request, "worker-slave.parallel"));

            childCompiler.runAsChild(error => {
                if (error) {
                    compilation.errors.push(error);
                }
            });
        });
    }
}

export default ParallelESPlugin;
