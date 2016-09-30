import {Compiler, Compilation} from "../types/webpack";
const SingleEntryPlugin = require("webpack/lib/SingleEntryPlugin");

class ParallelESPlugin {
    constructor(private options) {

    }

    public apply(compiler: Compiler) {

        /* tslint:disable:no-console */


        compiler.plugin("compilation", compilation => {
            if (compilation.compiler.isChild()) {
                return;
            }

            console.log("Create Child Compiler");
            const childCompiler = compilation.createChildCompiler("parallel-es-worker", {});

            // fix module name
            // FIx should be non entry... otherwise webpack bootstrap is added twice
            childCompiler.apply(new SingleEntryPlugin(compiler.context, `${require.resolve("./worker-functions-registrator-loader")}!parallel-es/dist/worker-slave.parallel.js`, "worker-slave.parallel"));
            /*childCompiler.plugin("compilation", (childCompilation, data) => {
                data.normalModuleFactory.plugin("parser", function (parser, options) {
                    let slavePlaceholderComment: any = undefined;
                    parser.plugin("program", function (ast, _comments) {
                        slavePlaceholderComment = _comments.find(comment => comment.value.includes("WORKER_SLAVE_STATIC_FUNCTIONS_PLACEHOLDER"));
                    });

                    parser.plugin("statement", function (statement) {
                        if (!slavePlaceholderComment) {
                            return;
                        }

                        if (slavePlaceholderComment.loc.end.line < statement.loc.start.line || (slavePlaceholderComment.loc.end.line === statement.loc.start.line && slavePlaceholderComment.loc.end.column < statement.loc.start.column)) {
                            slavePlaceholderComment = undefined;
                        }
                        console.log(statement);

                    })
                });*/
                // const mod = new PrefetchDependency(require.resolve("./worker-functions-registrator-loader"));
                // childCompilation.prefetch(compiler.context, mod, callback);

                //        console.log(error, resolved);
                //    });
                //});
                //childCompilation.addEntry(childCompiler.context, mod, "test", (error, result) => {
                //    console.log(error, result);
                //});

            childCompiler.runAsChild((error, entries, compilation: Compilation) => {
                if (error) {
                    console.error("Error", error);
                } else {
                    const file = entries[0].files[0];

                    console.log(file);
                }
            });
        });
    }
}

export default ParallelESPlugin;
