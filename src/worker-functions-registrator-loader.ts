import {transform, BabelFileResult} from "babel-core";
import {Visitor, NodePath} from "babel-traverse";
import * as t from "babel-types";
import generate from "babel-generator";
import {registry} from "babel-plugin-parallel-es";
import {SourceMapGenerator, SourceMapConsumer} from "source-map";
import {GeneratorResult} from "babel-generator";
import {GeneratorOptions} from "babel-generator";
import * as path from "path";

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
                console.log(definition.node.loc);
                const id = t.objectExpression([
                    t.objectProperty(t.identifier("identifier"), t.stringLiteral(definition.identifier)),
                    t.objectProperty(t.identifier("_______isFunctionId"), t.booleanLiteral(true))
                ]);

                let funcNode = definition.node;
                if (t.isFunctionDeclaration(funcNode)) {
                    const newId = path.scope.generateUidIdentifier(funcNode.id.name);
                    // funcNode.id = newId;
                    path.insertBefore(definition.node);
                    funcNode = funcNode.id;
                }

                const registerCall = t.callExpression(registerStaticFunctionMember, [id, funcNode]);
                path.insertBefore(registerCall);
            }
        }

        console.log("expr");
    }
};

function removeSourceFromMap(sourceToRemove, map) {
    var consumer = new SourceMapConsumer(map);
    var generator = new SourceMapGenerator({ file: map.file, sourceRoot: map.sourceRoot });

    consumer.sources.forEach(function (sourceFile) {
        if (sourceFile === sourceToRemove) {
            return;
        }

        var content = consumer.sourceContentFor(sourceFile);
        if (content != null) {
            generator.setSourceContent(sourceFile, content);
        }
    });

    consumer.eachMapping(function (mapping) {
        if (mapping.source !== sourceToRemove) {
            generator.addMapping({
                generated: {line: mapping.generatedLine, column: mapping.generatedColumn},
                source: mapping.source,
                original: {line: mapping.originalLine, column: mapping.originalColumn},
                name: mapping.name
            });
        }
    });

    return generator.toJSON();
}

export default function workerFunctionsRegistratorLoader(file: string, sourceMap?: Object) {
    const callback = this.async();
    const filePath = this.resourcePath;

    const generator = (ast: Node, options: GeneratorOptions, files: string | {[name: string]: string}): GeneratorResult => {
        if (typeof files === "string") {
            files = {
                [options.filename]: files
            };
        }

        for (const module of registry.modules) {
            files[module.fileName] = module.code;
        }

        options.quotes = "double";
        const result = generate(ast, options, files);
        const consumer = new SourceMapConsumer(result.map);
        const generator = SourceMapGenerator.fromSourceMap(consumer);
        generator.applySourceMap(new SourceMapConsumer(sourceMap), this.resourcePath);

        for (const module of registry.modules) {
            if (module.map) {
                generator.applySourceMap(new SourceMapConsumer(module.map));
            }
        }
        let map = generator.toJSON();

        if (sourceMap) {
            map = removeSourceFromMap(filePath, map);
        }

        return { code: result.code, map};
    };

    let result: BabelFileResult;

    try {
        result = transform(file, {
            filename: this.resourcePath,
            plugins: [{visitor: StaticFunctionRegistratorVisitor }],
            // code: false,
            sourceFileName: this.resourcePath,
            sourceMaps: true,
            sourceMapTarget: this.resourcePath,
            babelrc: false,
            sourceRoot: process.cwd(),
            generatorOpts: {
                generator
            }
        });
    } catch (error) {
        callback(error);
    }
    if (result) {
        callback(null, result.code, result.map);
    }
}