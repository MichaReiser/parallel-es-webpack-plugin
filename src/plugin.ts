import {Compiler} from "webpack";
import SingleEntryPlugin = require("webpack/lib/SingleEntryPlugin");

class ParallelESPlugin {
    public apply(compiler: Compiler) {
        compiler.plugin("compilation", compilation => {
            if (compilation.compiler.isChild()) {
                return;
            }

            const childCompiler = compilation.createChildCompiler("parallel-es-worker", {});
            const query = {
                babelrc: false,
                plugins: [
                    require.resolve("babel-plugin-parallel-es/dist/src/worker-rewriter/worker-rewriter-plugin")
                ]
            };

            const loader = require.resolve("babel-loader");
            const request = `${loader}?${JSON.stringify(query)}!parallel-es/dist/worker-slave.parallel.js`;
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
