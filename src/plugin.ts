import {Compiler, Compilation, Module} from "webpack";
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
        options.workerSlaveFileName = options.workerSlaveFileName || "parallel-es/dist/browser/slave.js";
        options.babelOptions = options.babelOptions || {};
        options.babelOptions.babelrc = false;
        options.babelOptions.plugins = options.babelOptions.plugins || [];
        options.babelOptions.plugins.push(require.resolve("babel-plugin-parallel-es/dist/src/worker-rewriter/worker-rewriter-plugin"));

        this.options = options;
    }

    public apply(compiler: Compiler) {
        compiler.hooks.make.tapAsync("parallel-es", (compilation, callback) => {
            if (compilation.compiler.isChild()) {
                return;
            }

            this.createChildCompilation(compilation, callback);

            compilation.hooks.succeedModule.tap("parallel-es", module => this.onModuleBuild(module));
            compilation.hooks.failedModule.tap("parallel-es", module => this.onModuleBuild(module));

            /**
             * An additional pass is needed if a new file is using the parallel api. Otherwise the function of the
             * newly added file are not included in the compilation. Do not trigger a rebuild if this is the first build
             * (in this case the parallel module has never been built, so no rebuild is needed).
             */
            compilation.hooks.needAdditionalPass.tap("parallel-es", () => {
                if (this.initialCompilation) {
                    return false;
                }
                return this.newDependencyAdded;
            });
        });

        compiler.hooks.afterCompile.tap("parallel-es", (compilation) => this.onMainAfterCompile(compilation));
        compiler.hooks.done.tap("parallel-es", () => this.initialCompilation = false);
    }

    private createChildCompilation(mainCompilation: Compilation, callback: (error?: any) => void) {
        const outputOptions = { filename: "parallel-slave.js" };
        const childCompiler = mainCompilation.createChildCompiler("parallel-es-worker", outputOptions);
        childCompiler.context = mainCompilation.compiler.context;

        new WebWorkerTemplatePlugin(outputOptions).apply(childCompiler);
        new SingleEntryPlugin(childCompiler.context, this.getWorkerRequest(), "main").apply(childCompiler);
        childCompiler.hooks.compilation.tap("parallel-es", childCompilation => this.onChildCompilation(childCompilation));
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
     * Triggered whenever a module from the main compilation has been built.
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
     */
    private onMainAfterCompile(compilation: Compilation): void {
        // Only update the dependencies if it is the main compiler. Doesn't seem to work if it is the child compilation :(
        if (!compilation.compiler.isChild()) {
            const parallelWorkerRequest = this.getWorkerRequest();
            const workerModule = this.childCompilation.modules.find(module => module.rawRequest === parallelWorkerRequest);

            if (workerModule) {
                workerModule.buildInfo.fileDependencies = new Set(Array.from(workerModule.buildInfo.fileDependencies).concat(Array.from(this.workerDependencies.values())));
            } else {
                throw new Error(`The worker module could not be found in the child compilation`);
            }
        }
    }

    private addWorkerDependency(module: Module) {
        this.newDependencyAdded = !this.workerDependencies.has(module.resource);
        this.workerDependencies.add(module.resource);
    }
}

export default ParallelESPlugin;
