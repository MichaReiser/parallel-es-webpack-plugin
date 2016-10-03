import {Compiler} from "webpack";
import SingleEntryPlugin from "webpack/lib/SingleEntryPlugin";

class ParallelESPlugin {
    public apply(compiler: Compiler) {

        compiler.plugin("compilation", compilation => {
            if (compilation.compiler.isChild()) {
                return;
            }

            const childCompiler = compilation.createChildCompiler("parallel-es-worker", {});

            // fix module name
            // FIx should be non entry...
            childCompiler.apply(new SingleEntryPlugin(compiler.context, `${require.resolve("./worker-functions-registrator-loader")}!parallel-es/dist/worker-slave.parallel.js`, "worker-slave.parallel"));

            childCompiler.runAsChild(error => {
                if (error) {
                    console.error("Error", error);
                    // what to do here?
                }
            });
        });
    }
}

export default ParallelESPlugin;
