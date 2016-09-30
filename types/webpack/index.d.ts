export interface Tapable {
    apply(...toApply: { apply: (tapable: this) => void }[]): void;
}

export interface Compiler extends Tapable {
    context: string;

    /**
     * A Compilation is created. A plugin can use this to obtain a reference to the Compilation object. The params object contains useful references.
     */
    plugin(name: "compilation", callback: (c: Compilation, params: any) => void): void;
    plugin(name: "compile", callback: (params: any) => void): void;

    /**
     * A NormalModuleFactory is created. A plugin can use this to obtain a reference to the NormalModuleFactory object.
     */
    plugin(name: "normal-module-factory", callback: (factory: NormalModuleFactory) => void): void;

    /**
     * A ContextModuleFactory is created. A plugin can use this to obtain a reference to the ContextModuleFactory object.
     */
    plugin(name: "context-module-factory", callback: (factory: ContextModuleFactory) => void): void;

    /**
     * The Compiler starts compiling. This is used in normal and watch mode. Plugins can use this point to modify the params object (i. e. to decorate the factories).
     */
    plugin(name: "compile", callback: (params: any) => void): void;

    /**
     * Plugins can use this point to add entries to the compilation or prefetch modules. They can do this by calling addEntry(context, entry, name, callback) or prefetch(context, dependency, callback) on the Compilatio
     */
    plugin(name: "make", callback: (c: Compilation) => void): void;

    isChild(): boolean;
}

export interface Compilation extends Tapable {
    compiler: Compiler;
    addEntry(context: any, entry: any, name: string, callback: Function): void;
    createChildCompiler(name: string, outputOptions: WebpackOptions): Compiler;
}

export interface NormalModuleFactory {

}

export interface ContextModuleFactory {
}

export interface WebpackOptions {
    debug?: boolean;
    devtool?: string;
}