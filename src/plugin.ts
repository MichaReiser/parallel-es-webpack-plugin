import {Compiler, Compilation, Module} from "webpack";
import {uniq} from "lodash";
import SingleEntryPlugin = require("webpack/lib/SingleEntryPlugin");
import WebWorkerTemplatePlugin = require("webpack/lib/webworker/WebWorkerTemplatePlugin");
import {SHARED_MODULES_USING_PARALLEL_REGISTRY} from "babel-plugin-parallel-es/dist/src/modules-using-parallel-registry";
import {IPluginOptions} from "./plugin-options";

class ParallelESPlugin {
    private options: IPluginOptions;

    /**
     * The child compilation that is used inside the worker code
     */
    private childCompilation: Compilation;

    /**
     * Name of the resources using the parallel api
     */
    private workerDependencies = new Set<string>();

    /**
     * Flag if in this pass an additional file has been added that is using the parallel api
     */
    private newDependencyAdded = false;

    /**
     * Is this the first compilation?
     */
    private initialCompilation = true;

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
        compiler.plugin("make", (compilation, callback) => {
            if (compilation.compiler.isChild()) {
                return;
            }

            this.createChildCompilation(compilation, callback);

            compilation.plugin("succeed-module", module => this.onModuleBuild(module));
            compilation.plugin("failed-module", module => this.onModuleBuild(module));

            /**
             * An additional pass is needed if a new file is using the parallel api. Otherwise the function of the
             * newly added file are not included in the compilation. Do not trigger a rebuild if this is the first build
             * (in this case the parallel module has never been built, so no rebuild is needed).
             */
            compilation.plugin("need-additional-pass", () => {
                if (this.initialCompilation) {
                    return false;
                }
                return this.newDependencyAdded;
            });
        });

        compiler.plugin("after-compile", (compilation, callback) => this.onMainAfterCompile(compilation, callback));
        compiler.plugin("done", () => this.initialCompilation = false);
    }

    private createChildCompilation(mainCompilation: Compilation, callback: (error?: any) => void) {
        const outputOptions = { filename: "worker-slave.parallel.js" };
        const childCompiler = mainCompilation.createChildCompiler("parallel-es-worker", outputOptions);
        childCompiler.context = mainCompilation.compiler.context;
        childCompiler.apply(new WebWorkerTemplatePlugin(outputOptions));
        childCompiler.apply(new SingleEntryPlugin(childCompiler.context, this.getWorkerRequest(), "main"));
        childCompiler.plugin("compilation", (childCompilation) => this.onChildCompilation(childCompilation));
        childCompiler.runAsChild(callback);
    }

    private getWorkerRequest(): string {
        const query = this.options.babelOptions;
        const loader = require.resolve("babel-loader");
        return `${loader}?${JSON.stringify(query)}!${this.options.workerSlaveFileName}`;
    }

    /**
     * Triggered when the child compilation is created.
     * Stores a reference inside of the class and resets all compilation (run) specific flags
     * @param childCompilation the child compilation
     */
    private onChildCompilation(childCompilation: Compilation): void {
        const subCache = "parallel-es-worker";
        this.newDependencyAdded = false;

        this.childCompilation = childCompilation;
        if (childCompilation.cache) {
            if (!childCompilation.cache[subCache]) {
                childCompilation.cache[subCache] = {};
            }

            childCompilation.cache = childCompilation.cache[subCache];
        }
    }

    /**
     * Triggered whenver a module from the main compilation has been built.
     * If the module is using the parallel api, add id to the list of dependencies (the worker therefore depends upon this module)
     * @param module the module that has been successfully build
     */
    private onModuleBuild(module: Module): void {
        const usesParallel = SHARED_MODULES_USING_PARALLEL_REGISTRY.has(module.resource);

        if (usesParallel) {
            this.addWorkerDependency(module);
        } else {
            this.workerDependencies.delete(module.resource);
        }
    }

    /**
     * Triggered when the main compilation is complete. Sets the file dependencies of the worker module
     * @param compilation the compilation for which the compile is complete
     * @param callback callback that needs to trigger the continuation of the compilation
     */
    private onMainAfterCompile(compilation: Compilation, callback: (error?: any) => void): void {
        // Only update the dependencies if it is the main compiler. Doesn't seem to work if it is the child compilation :(
        if (!compilation.compiler.isChild()) {
            const parallelWorkerRequest = this.getWorkerRequest();
            const workerModule = this.childCompilation.modules.find(module => module.rawRequest === parallelWorkerRequest);

            if (workerModule) {
                workerModule.fileDependencies = uniq(workerModule.fileDependencies.concat(Array.from(this.workerDependencies.values())));
            } else {
                callback(new Error(`The worker module could not be found in the child compilation`));
                return;
            }
        }

        callback();
    }

    private addWorkerDependency(module: Module) {
        this.newDependencyAdded = !this.workerDependencies.has(module.resource);
        this.workerDependencies.add(module.resource);
    }
}

export default ParallelESPlugin;
