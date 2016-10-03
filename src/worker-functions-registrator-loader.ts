import {transform, BabelFileResult} from "babel-core";
import {Visitor, NodePath} from "babel-traverse";
import * as t from "babel-types";
import generate from "babel-generator";
import {SourceMapGenerator, SourceMapConsumer, RawSourceMap} from "source-map";
import {GeneratorResult} from "babel-generator";
import {registry} from "babel-plugin-parallel-es";
import {createFunctionId} from "babel-plugin-parallel-es/dist/src/util";
import {Loader} from "webpack";

function isAfterWorkerSlaveMarker(path: NodePath<t.Node>): boolean {
    if (!path.node.leadingComments) {
        return false;
    }

    const markerComment = path.node.leadingComments.find(comment => comment.value.includes("WORKER_SLAVE_STATIC_FUNCTIONS_PLACEHOLDER"));
    return !!markerComment;
}

const StaticFunctionRegistratorVisitor: Visitor = {
    Statement(path: NodePath<t.Statement>) {
        if (!isAfterWorkerSlaveMarker(path)) {
            return;
        }

        const registerStaticFunctionMember = t.memberExpression(t.identifier("slaveFunctionLookupTable"), t.identifier("registerStaticFunction"));
        for (const module of registry.modules) {
            for (const definition of module.functions) {
                path.debug(() => definition.node.loc);

                const id = createFunctionId(definition);

                let functionDefinition = definition.node as t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression;
                let functorReference: t.Expression;

                if (t.isFunctionDeclaration(functionDefinition)) {
                    functionDefinition.id = path.scope.generateUidIdentifierBasedOnNode(functionDefinition.id);
                    path.insertBefore(definition.node);
                    functorReference = functionDefinition.id;
                } else {
                    functorReference = functionDefinition as t.FunctionExpression | t.ArrowFunctionExpression;
                }

                const registerCall = t.callExpression(registerStaticFunctionMember, [id, functorReference]);
                path.insertBefore(registerCall);
            }
        }
    }
};

function removeSourceFromMap(sourceToRemove: string, map: RawSourceMap): RawSourceMap {
    const consumer = new SourceMapConsumer(map);
    const generator = new SourceMapGenerator({ file: map.file, sourceRoot: map.sourceRoot });

    map.sources.forEach(function (sourceFile) {
        if (sourceFile === sourceToRemove) {
            return;
        }

        const content = consumer.sourceContentFor(sourceFile);
        if (content != null) {
            generator.setSourceContent(sourceFile, content);
        }
    });

    consumer.eachMapping(function (mapping) {
        if (mapping.source !== sourceToRemove) {
            generator.addMapping({
                generated: { column: mapping.generatedColumn, line: mapping.generatedLine },
                name: mapping.name,
                original: { column: mapping.originalColumn, line: mapping.originalLine },
                source: mapping.source
            });
        }
    });

    return generator.toJSON();
}

function mergeSourceMaps(filePath: string, loaderSourceMap?: RawSourceMap, babelSourceMap?: RawSourceMap): RawSourceMap | undefined {
    if (babelSourceMap) {
        const consumer = new SourceMapConsumer(babelSourceMap as RawSourceMap);
        const sourceMapGenerator = SourceMapGenerator.fromSourceMap(consumer);

        if (loaderSourceMap) {
            sourceMapGenerator.applySourceMap(new SourceMapConsumer(loaderSourceMap), filePath);
        }

        for (const module of registry.modules) {
            if (module.map) {
                sourceMapGenerator.applySourceMap(new SourceMapConsumer(module.map));
            }
        }

        let map = sourceMapGenerator.toJSON();

        if (loaderSourceMap) {
            map = removeSourceFromMap(filePath, map);
        }
        return map;
    }

    return undefined;
}

export default function workerFunctionsRegistratorLoader(this: Loader, file: string, sourceMap?: RawSourceMap) {
    const callback = this.async();
    const filePath = this.resourcePath;

    const generator = function(this: any): GeneratorResult {
        const result = generate.apply(this, arguments);
        const map = mergeSourceMaps(filePath, sourceMap, result.map);

        return { code: result.code, map: map as Object};
    };

    let result: BabelFileResult | undefined = undefined;

    try {
        result = transform(file, {
            babelrc: false,
            filename: this.resourcePath,
            generatorOpts: {
                generator
            },
            plugins: [{visitor: StaticFunctionRegistratorVisitor }],
            sourceFileName: this.resourcePath,
            sourceMapTarget: this.resourcePath,
            sourceMaps: true,
            sourceRoot: process.cwd()
        });
    } catch (error) {
        callback(error);
    }

    if (result) {
        callback(null, result.code, result.map as RawSourceMap);
    }
}
