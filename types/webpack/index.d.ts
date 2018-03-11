// tslint:disable:interface-name no-empty-interface max-classes-per-file

declare module "webpack" {
    import {RawSourceMap} from "source-map";

    export const version: string;

    export interface Tapable {
        apply(...toApply: Array<{ apply: (tapable: Tapable) => void }>): void;
    }

    export interface FileSystem {
        exists(path: string, callback: (error: any, exists: boolean) => void): void;

        existsSync(path: string): boolean;

        readFile(path: string, callback?: (error: any, content: string) => void): void;

        readFile(path: string, encoding?: string, callback?: (error: any, content: string) => void): void;

        readFileSync(path: string, encoding?: string): string;
    }

    export class LoaderOptionsPlugin {
        constructor(options: { debug?: boolean });
    }

    export type CallbackFunction = (error?: Error, result?: any, ...args: any[]) => void;

    export interface Hook {
        tap(pluginName: string, handler: () => any): void;
        tapAsync(pluginName: string, handler: (callback: CallbackFunction) => void): void;
    }

    export interface HookWithArg<T> {
        tap(pluginName: string, handler: (o: T) => any): void;
        tapAsync(pluginName: string, handler: (o: T, callback: CallbackFunction) => void): void;
    }

    export interface Compiler extends Tapable {
        context: string;
        inputFileSystem: FileSystem;
        outputFileSystem: FileSystem;

        hooks: {
            make: HookWithArg<Compilation>;
            afterCompile: HookWithArg<Compilation>;
            compilation: HookWithArg<Compilation>;
            done: Hook;
        };
        isChild(): boolean;

        runAsChild(callback: (error: any, entries: any[], compilation: Compilation) => void): void;
    }

    interface Asset {
        emitted: boolean;
        existsAt: string;

        map(): RawSourceMap;

        source(): string;
    }

    export interface Compilation extends Tapable {
        cache: { [name: string]: {} };
        compiler: Compiler;
        errors: Error[];
        assets: { [name: string]: Asset };
        modules: Module[];
        hooks: {
            succeedModule: HookWithArg<Module>;
            failedModule: HookWithArg<Module>;
            needAdditionalPass: Hook;
        };

        addEntry(context: any, entry: any, name: string, callback: CallbackFunction): void;

        createChildCompiler(name: string, outputOptions: WebpackOptions): Compiler;
    }

    export interface Module {
        resource: string;
        rawRequest: string;
        request: string;
        buildInfo: {
            fileDependencies: Set<string>
        };
    }

    export interface NormalModuleFactory {
    }

    export interface ContextModuleFactory {
    }

    export interface WebpackOptions {
        debug?: boolean;
        devtool?: string;
        filename?: string;
    }

    export interface Loader {
        resourcePath: string;

        async(): (error: any, code?: string, map?: RawSourceMap) => void;
    }

    export interface Stats {
        compilation: Compilation;
    }
}

declare module "webpack/lib/SingleEntryPlugin" {
    import {Tapable} from "webpack";

    class SingleEntryPlugin implements Tapable {
        constructor(context: string, request: string, entryName: string);

        public apply(...toApply: { apply: ((tapable: Tapable) => void) }[]): void;
    }

    export = SingleEntryPlugin;
}

declare module "webpack/lib/webworker/WebWorkerTemplatePlugin" {
    import {Tapable} from "webpack";

    class WebWorkerTemplatePlugin implements Tapable {
        constructor(outputOptions: any);

        public apply(...toApply: Array<{ apply: ((tapable: Tapable) => void) }>): void;
    }

    export = WebWorkerTemplatePlugin;
}
