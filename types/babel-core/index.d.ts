declare module "babel-core" {
    import {GeneratorResult, GeneratorOptions} from "babel-generator";
    import * as t from "babel-types";

    export interface GeneratorOpts extends GeneratorOptions {
        generator?: (ast: t.Node, opts?: GeneratorOptions, code?: string | {[filename: string]: string}) => GeneratorResult;
    }

    export interface TransformOptions {
        generatorOpts?: GeneratorOpts;
    }
}
