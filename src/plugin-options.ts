import {TransformOptions} from "babel-core";

export interface IPluginOptions {
    workerSlaveFileName?: string;
    babelOptions?: TransformOptions;
}
