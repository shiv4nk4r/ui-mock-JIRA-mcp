/**
 * parser.ts — Babel-powered AST parsing engine.
 *
 * Handles four file types used in this monorepo:
 *   .vue      — Vue 2 SFCs  (script block extracted first, then Babel-parsed)
 *   .js/.mjs  — ES module JavaScript
 *   .ts       — TypeScript
 *   .graphql  — GraphQL SDL (parsed with the `graphql` package)
 *
 * For every file it returns a ParseResult containing:
 *   nodes      — all extracted CodeNode objects
 *   edges      — structural (contains) + local call edges resolved within the file
 *   rawImports — unresolved import records (resolved in the indexer second pass)
 *   rawCalls   — unresolved call sites     (resolved in the indexer second pass)
 *   errors     — any parse/traverse errors (non-fatal; file is skipped on hard failure)
 */

import { parse as babelParse, ParserPlugin } from '@babel/parser';
import _traverse                              from '@babel/traverse';
import * as t                                 from '@babel/types';
import { parse as parseGraphQL }              from 'graphql';
import * as gql                               from 'graphql';
import path                                   from 'path';
import fs                                     from 'fs';

import { extractScriptBlock, hasScriptBlock } from './vue-extractor';
import type {
  CodeNode,
  CodeEdge,
  EdgeKind,
  NodeKind,
  NodeMetadata,
  ParseResult,
  SourceLocation,
} from './types';

// @babel/traverse ships as a CJS module with a .default quirk in ESM environments
const traverse = (_traverse as unknown as { default: typeof _traverse }).default ?? _traverse;

// ─── Babel parser options ────────────────────────────────────────────────────
// Enable every plugin that might appear in this codebase so a single parse()
// call works for both JS and TS files without needing per-file detection.

const BABEL_PLUGINS_JS: ParserPlugin[] = [
  'jsx',
  'doExpressions',
  'exportDefaultFrom',
  'functionBind',
  'importMeta',
  'dynamicImport',
  'nullishCoalescingOperator',
  'optionalChaining',
  'logicalAssignment',
  'numericSeparator',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'classStaticBlock',
  'topLevelAwait',
  ['decorators', { decoratorsBeforeExport: true }],
];

const BABEL_PLUGINS_TS: ParserPlugin[] = [
  ...BABEL_PLUGINS_JS.filter((p) => p !== 'jsx'), // TS + JSX handled via tsx
  'typescript',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeLoc(node: t.Node, lineOffset = 0): SourceLocation {
  const s = node.loc?.start ?? { line: 1, column: 0 };
  const e = node.loc?.end   ?? { line: 1, column: 0 };
  return {
    start: { line: s.line + lineOffset, column: s.column },
    end:   { line: e.line + lineOffset, column: e.column },
  };
}

function makeNodeId(relPath: string, kind: NodeKind, scopePath: string): string {
  return `${relPath}::${kind}::${scopePath}`;
}

function makeEdgeId(fromId: string, kind: EdgeKind, toId: string): string {
  return `${fromId}--${kind}--${toId}`;
}

function makeEdge(
  fromId: string,
  kind: EdgeKind,
  toId: string,
  label?: string,
  loc?: SourceLocation,
): CodeEdge {
  return { id: makeEdgeId(fromId, kind, toId), kind, fromId, toId, label, loc };
}

/** Strip this. / self. / vm. prefixes so callee lookup is by bare name */
function normalizeCallee(raw: string): string {
  return raw.replace(/^(?:this|self|vm|that)\./i, '');
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function parseFile(absolutePath: string, repoRoot: string): ParseResult {
  const relPath = path.relative(repoRoot, absolutePath);
  const ext     = path.extname(absolutePath).toLowerCase();

  const result: ParseResult = {
    filePath:   absolutePath,
    nodes:      [],
    edges:      [],
    errors:     [],
    rawImports: [],
    rawCalls:   [],
  };

  let source: string;
  try {
    source = fs.readFileSync(absolutePath, 'utf-8');
  } catch (err) {
    result.errors.push(`Read error: ${(err as Error).message}`);
    return result;
  }

  if (ext === '.graphql' || ext === '.gql') {
    return parseGraphqlFile(source, absolutePath, relPath, result);
  }

  // For .vue files pull the script block; skip if none
  let scriptContent = source;
  let lineOffset    = 0;
  let lang: 'js' | 'ts' = 'js';
  let isVue = false;

  if (ext === '.vue') {
    if (!hasScriptBlock(source)) return result; // template-only component
    const block = extractScriptBlock(source);
    if (!block) return result;
    scriptContent = block.content;
    lineOffset    = block.startLine - 1; // convert to 0-based offset
    lang          = block.lang;
    isVue         = true;
  } else if (ext === '.ts') {
    lang = 'ts';
  } else if (ext === '.mjs' || ext === '.js') {
    // Check for embedded GraphQL SDL in template literals (BFF pattern)
    lang = 'js';
  }

  return parseJsFile(scriptContent, absolutePath, relPath, lineOffset, lang, isVue, result);
}

// ─── JavaScript / TypeScript parser ─────────────────────────────────────────

function parseJsFile(
  source:       string,
  absolutePath: string,
  relPath:      string,
  lineOffset:   number,
  lang:         'js' | 'ts',
  isVue:        boolean,
  result:       ParseResult,
): ParseResult {
  const plugins = lang === 'ts' ? BABEL_PLUGINS_TS : BABEL_PLUGINS_JS;

  let ast: t.File;
  try {
    ast = babelParse(source, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction:  true,
      allowSuperOutsideMethod:     true,
      allowUndeclaredExports:      true,
      errorRecovery:               true,
      plugins,
    });
  } catch (err) {
    // If TS plugins fail, fall back to JS-only parse
    try {
      ast = babelParse(source, {
        sourceType:                  'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction:  true,
        errorRecovery:               true,
        plugins: BABEL_PLUGINS_JS,
      });
    } catch (err2) {
      result.errors.push(`Parse error: ${(err2 as Error).message}`);
      return result;
    }
  }

  // ── File node ────────────────────────────────────────────────────────────
  const fileNodeId = makeNodeId(relPath, 'file', relPath);
  const fileNode: CodeNode = {
    id:        fileNodeId,
    kind:      'file',
    name:      path.basename(absolutePath),
    filePath:  absolutePath,
    scopePath: relPath,
    loc:       { start: { line: 1, column: 0 }, end: { line: source.split('\n').length, column: 0 } },
    metadata:  { language: isVue ? 'vue' : lang, isExported: false },
  };
  result.nodes.push(fileNode);

  // ── Traversal state ──────────────────────────────────────────────────────
  // scopeStack: [parentNodeId, ...] — top is the current containing scope
  const scopeStack: string[] = [fileNodeId];
  // nameToNodeId: local name → node id, for intra-file call resolution
  const localFunctions = new Map<string, string>();
  // Vue-specific metadata accumulator
  const vueMeta: NodeMetadata = { language: 'vue' };

  // ── AST traversal ────────────────────────────────────────────────────────
  try {
    traverse(ast, {
      // ── Imports ──────────────────────────────────────────────────────────
      ImportDeclaration(nodePath) {
        const decl = nodePath.node;
        const specifiers = decl.specifiers.map((s) => {
          if (t.isImportDefaultSpecifier(s)) return 'default';
          if (t.isImportNamespaceSpecifier(s)) return '*';
          if (t.isImportSpecifier(s)) {
            return t.isIdentifier(s.imported) ? s.imported.name : s.imported.value;
          }
          return 'unknown';
        });
        const isDefault = decl.specifiers.some((s) => t.isImportDefaultSpecifier(s));
        result.rawImports.push({
          source:          decl.source.value,
          specifiers,
          isDefaultImport: isDefault,
          loc:             makeLoc(decl, lineOffset),
          fromFileId:      fileNodeId,
        });
      },

      // ── Function declarations ─────────────────────────────────────────────
      FunctionDeclaration: {
        enter(nodePath) {
          const decl  = nodePath.node;
          const name  = decl.id?.name ?? `__anonymous_fn_${decl.loc?.start.line ?? 0}`;
          const scope = buildScopePath(scopeStack, result.nodes, relPath, name);
          const nodeId = makeNodeId(relPath, 'function', scope);
          const params = decl.params.map(paramName);

          const node: CodeNode = {
            id:        nodeId,
            kind:      'function',
            name,
            filePath:  absolutePath,
            scopePath: scope,
            loc:       makeLoc(decl, lineOffset),
            metadata:  {
              isExported: isExportedDecl(nodePath),
              isAsync:    decl.async,
              params,
              language:   lang,
            },
          };
          result.nodes.push(node);
          result.edges.push(makeEdge(scopeStack[scopeStack.length - 1], 'contains', nodeId, name));
          localFunctions.set(name, nodeId);
          scopeStack.push(nodeId);
        },
        exit() { scopeStack.pop(); },
      },

      // ── Variable declarations (const/let/var with function init) ──────────
      VariableDeclaration(nodePath) {
        for (const decl of nodePath.node.declarations) {
          if (!t.isIdentifier(decl.id)) continue;
          const name = decl.id.name;

          // Record all top-level const/let/var (not nested inside functions)
          const isTopLevel = scopeStack.length === 1; // only file scope
          const isFnValue  =
            decl.init &&
            (t.isArrowFunctionExpression(decl.init) || t.isFunctionExpression(decl.init));

          if (isTopLevel || isFnValue) {
            const kind: NodeKind = isFnValue ? 'function' : 'variable';
            const scope = buildScopePath(scopeStack, result.nodes, relPath, name);
            const nodeId = makeNodeId(relPath, kind, scope);
            const params: string[] = isFnValue && t.isFunction(decl.init!)
              ? decl.init.params.map(paramName)
              : [];
            const isAsync = isFnValue && t.isFunction(decl.init!) ? decl.init.async : false;

            const node: CodeNode = {
              id:        nodeId,
              kind,
              name,
              filePath:  absolutePath,
              scopePath: scope,
              loc:       makeLoc(decl, lineOffset),
              metadata:  {
                isExported: isExportedDecl(nodePath),
                isArrow:    isFnValue && t.isArrowFunctionExpression(decl.init) || false,
                isAsync,
                params,
                language:   lang,
              },
            };
            result.nodes.push(node);
            result.edges.push(makeEdge(scopeStack[scopeStack.length - 1], 'contains', nodeId, name));
            if (isFnValue) localFunctions.set(name, nodeId);
          }
        }
      },

      // ── Class declarations ────────────────────────────────────────────────
      ClassDeclaration: {
        enter(nodePath) {
          const decl   = nodePath.node;
          const name   = decl.id?.name ?? `__AnonymousClass_${decl.loc?.start.line ?? 0}`;
          const scope  = buildScopePath(scopeStack, result.nodes, relPath, name);
          const nodeId = makeNodeId(relPath, 'class', scope);

          const node: CodeNode = {
            id:        nodeId,
            kind:      'class',
            name,
            filePath:  absolutePath,
            scopePath: scope,
            loc:       makeLoc(decl, lineOffset),
            metadata:  { isExported: isExportedDecl(nodePath), language: lang },
          };
          result.nodes.push(node);
          result.edges.push(makeEdge(scopeStack[scopeStack.length - 1], 'contains', nodeId, name));
          localFunctions.set(name, nodeId);
          scopeStack.push(nodeId);
        },
        exit() { scopeStack.pop(); },
      },

      // ── Class methods ────────────────────────────────────────────────────
      ClassMethod: {
        enter(nodePath) {
          const method = nodePath.node;
          const name   = t.isIdentifier(method.key)
            ? method.key.name
            : `__method_${method.loc?.start.line ?? 0}`;
          const scope  = buildScopePath(scopeStack, result.nodes, relPath, name);
          const nodeId = makeNodeId(relPath, 'method', scope);

          const node: CodeNode = {
            id:        nodeId,
            kind:      'method',
            name,
            filePath:  absolutePath,
            scopePath: scope,
            loc:       makeLoc(method, lineOffset),
            metadata:  {
              isAsync:  method.async,
              isStatic: method.static,
              params:   method.params.map(paramName),
              language: lang,
            },
          };
          result.nodes.push(node);
          result.edges.push(makeEdge(scopeStack[scopeStack.length - 1], 'contains', nodeId, name));
          scopeStack.push(nodeId);
        },
        exit() { scopeStack.pop(); },
      },

      // ── Call expressions ──────────────────────────────────────────────────
      CallExpression(nodePath) {
        const callee  = nodePath.node.callee;
        const current = scopeStack[scopeStack.length - 1];
        if (current === fileNodeId) return; // skip module-level calls (not in a fn)

        let calleeName: string | null = null;
        if (t.isIdentifier(callee)) {
          calleeName = callee.name;
        } else if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
          calleeName = normalizeCallee(`this.${callee.property.name}`);
        }

        if (calleeName) {
          // Try to resolve locally first
          const targetId = localFunctions.get(calleeName);
          if (targetId && targetId !== current) {
            result.edges.push(makeEdge(current, 'calls', targetId, calleeName, makeLoc(nodePath.node, lineOffset)));
          } else if (!targetId) {
            // Queue for cross-file resolution
            result.rawCalls.push({
              callee:      calleeName,
              fromScopeId: current,
              loc:         makeLoc(nodePath.node, lineOffset),
            });
          }
        }
      },

      // ── Vue: export default { ... } ───────────────────────────────────────
      // Fires for .vue SFCs and for .js files that export a Vue options object
      // (identifiable by having `name` + at least one Vue option key).
      ExportDefaultDeclaration(nodePath) {
        const decl = nodePath.node.declaration;
        if (!t.isObjectExpression(decl)) return;

        // For non-Vue files, require at least one Vue option key to qualify
        if (!isVue) {
          const VUE_KEYS = new Set(['data','methods','computed','props','components','mixins','apollo','watch','mounted','created','beforeDestroy']);
          const hasVueKey = decl.properties.some(
            (p) => (t.isObjectProperty(p) || t.isObjectMethod(p)) && t.isIdentifier(p.key) && VUE_KEYS.has(p.key.name)
          );
          if (!hasVueKey) return;
        }

        // Extract Vue Options API metadata
        const compMeta = extractVueOptionsMetadata(decl);
        Object.assign(vueMeta, compMeta);

        // Create vue-component node (represents the whole SFC)
        const compName = extractVueComponentName(decl) ?? path.basename(absolutePath, '.vue');
        const scope    = `${relPath}::vue-component`;
        const nodeId   = makeNodeId(relPath, 'vue-component', scope);

        const node: CodeNode = {
          id:        nodeId,
          kind:      'vue-component',
          name:      compName,
          filePath:  absolutePath,
          scopePath: scope,
          loc:       makeLoc(decl, lineOffset),
          metadata:  { ...vueMeta, isDefault: true, isExported: true },
        };
        result.nodes.push(node);
        result.edges.push(makeEdge(fileNodeId, 'contains', nodeId, compName));

        // Add `uses` edges for each component in the `components: {}` option
        for (const child of compMeta.components ?? []) {
          // These become raw imports resolved in the indexer
          result.rawCalls.push({
            callee:      child,
            fromScopeId: nodeId,
            loc:         node.loc,
          });
        }
      },

      // ── BFF pattern: resolver object exported as const ────────────────────
      // e.g. export const outboundOrderListResolver = { Query: { async fn(...) {} } }
      ExportNamedDeclaration(nodePath) {
        const decl = nodePath.node.declaration;
        if (!t.isVariableDeclaration(decl)) return;

        for (const declarator of decl.declarations) {
          if (!t.isIdentifier(declarator.id)) continue;
          if (!declarator.id.name.endsWith('Resolver')) continue;
          if (!t.isObjectExpression(declarator.init)) continue;

          extractResolverNodes(
            declarator.init,
            declarator.id.name,
            absolutePath,
            relPath,
            lineOffset,
            lang,
            result,
          );
        }
      },
    });
  } catch (err) {
    result.errors.push(`Traverse error: ${(err as Error).message}`);
  }

  // ── BFF: try to parse any embedded GraphQL SDL template literals ─────────
  extractEmbeddedGraphql(ast, absolutePath, relPath, lineOffset, result);

  return result;
}

// ─── Vue Options API metadata extractor ────────────────────────────────────

function extractVueComponentName(obj: t.ObjectExpression): string | null {
  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop)) continue;
    if (!t.isIdentifier(prop.key, { name: 'name' })) continue;
    if (t.isStringLiteral(prop.value)) return prop.value.value;
  }
  return null;
}

function extractVueOptionsMetadata(obj: t.ObjectExpression): NodeMetadata {
  const meta: NodeMetadata = {};

  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop) && !t.isObjectMethod(prop)) continue;
    if (!t.isIdentifier(prop.key)) continue;
    const key = prop.key.name;

    if (key === 'props' && t.isObjectProperty(prop)) {
      if (t.isObjectExpression(prop.value)) {
        meta.props = prop.value.properties
          .filter(t.isObjectProperty)
          .map((p) => (t.isIdentifier(p.key) ? p.key.name : '?'));
      } else if (t.isArrayExpression(prop.value)) {
        meta.props = prop.value.elements
          .filter((e): e is t.StringLiteral => t.isStringLiteral(e))
          .map((e) => e.value);
      }
    }

    if (key === 'computed' && t.isObjectProperty(prop) && t.isObjectExpression(prop.value)) {
      meta.computed = prop.value.properties
        .filter((p): p is t.ObjectProperty | t.ObjectMethod => t.isObjectProperty(p) || t.isObjectMethod(p))
        .map((p) => (t.isIdentifier(p.key) ? p.key.name : '?'));
    }

    if (key === 'data' && (t.isObjectMethod(prop) || (t.isObjectProperty(prop) && t.isFunction(prop.value)))) {
      // data() returns an object — collect top-level keys
      const fn = t.isObjectMethod(prop) ? prop : (prop.value as t.Function);
      meta.dataKeys = extractReturnObjectKeys(fn);
    }

    if (key === 'methods' && t.isObjectProperty(prop) && t.isObjectExpression(prop.value)) {
      meta.methods = prop.value.properties
        .filter((p): p is t.ObjectProperty | t.ObjectMethod => t.isObjectProperty(p) || t.isObjectMethod(p))
        .map((p) => (t.isIdentifier(p.key) ? p.key.name : '?'));
    }

    if (key === 'mixins' && t.isObjectProperty(prop) && t.isArrayExpression(prop.value)) {
      meta.mixins = prop.value.elements
        .filter((e): e is t.Identifier => t.isIdentifier(e))
        .map((e) => e.name);
    }

    if (key === 'components' && t.isObjectProperty(prop) && t.isObjectExpression(prop.value)) {
      meta.components = prop.value.properties
        .filter(t.isObjectProperty)
        .map((p) => (t.isIdentifier(p.key) ? p.key.name : '?'));
    }

    if (key === 'apollo' && t.isObjectProperty(prop) && t.isObjectExpression(prop.value)) {
      meta.apolloQueries = prop.value.properties
        .filter(t.isObjectProperty)
        .map((p) => (t.isIdentifier(p.key) ? p.key.name : '?'));
    }

    if (key === 'emits' && t.isObjectProperty(prop)) {
      if (t.isArrayExpression(prop.value)) {
        meta.emits = prop.value.elements
          .filter((e): e is t.StringLiteral => t.isStringLiteral(e))
          .map((e) => e.value);
      }
    }
  }

  return meta;
}

function extractReturnObjectKeys(fn: t.Function): string[] {
  const keys: string[] = [];
  if (!t.isBlockStatement(fn.body)) return keys;
  for (const stmt of fn.body.body) {
    if (!t.isReturnStatement(stmt) || !stmt.argument) continue;
    if (!t.isObjectExpression(stmt.argument)) continue;
    for (const prop of stmt.argument.properties) {
      if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
        keys.push(prop.key.name);
      }
    }
  }
  return keys;
}

// ─── BFF resolver extractor ──────────────────────────────────────────────────
// Pattern: { Query: { async fetchData(parent, args, ctx) { ... } } }

function extractResolverNodes(
  obj:          t.ObjectExpression,
  resolverVar:  string,
  absolutePath: string,
  relPath:      string,
  lineOffset:   number,
  lang:         'js' | 'ts',
  result:       ParseResult,
): void {
  for (const typeProp of obj.properties) {
    if (!t.isObjectProperty(typeProp) && !t.isObjectMethod(typeProp)) continue;
    if (!t.isIdentifier(typeProp.key)) continue;
    const gqlTypeName = typeProp.key.name; // "Query" | "Mutation" | "Subscription" | type name

    const methodsObj = t.isObjectProperty(typeProp) && t.isObjectExpression(typeProp.value)
      ? typeProp.value
      : null;
    if (!methodsObj) continue;

    for (const methodProp of methodsObj.properties) {
      if (!t.isObjectProperty(methodProp) && !t.isObjectMethod(methodProp)) continue;
      if (!t.isIdentifier(methodProp.key)) continue;
      const fieldName = methodProp.key.name;

      const scopePath = `${resolverVar}.${gqlTypeName}.${fieldName}`;
      const nodeId    = makeNodeId(relPath, 'graphql-resolver', scopePath);
      const params: string[] = [];
      let isAsync = false;

      if (t.isObjectMethod(methodProp)) {
        params.push(...methodProp.params.map(paramName));
        isAsync = methodProp.async;
      } else if (t.isFunction(methodProp.value)) {
        params.push(...(methodProp.value as t.Function).params.map(paramName));
        isAsync = (methodProp.value as t.Function).async ?? false;
      }

      const node: CodeNode = {
        id:        nodeId,
        kind:      'graphql-resolver',
        name:      fieldName,
        filePath:  absolutePath,
        scopePath,
        loc:       makeLoc(methodProp, lineOffset),
        metadata:  {
          isAsync,
          isExported:        true,
          graphqlOperation:  gqlTypeName,
          graphqlType:       gqlTypeName,
          params,
          language:          lang,
        },
      };
      result.nodes.push(node);

      // File contains this resolver
      const fileNodeId = makeNodeId(relPath, 'file', relPath);
      result.edges.push(makeEdge(fileNodeId, 'contains', nodeId, fieldName));
    }
  }
}

// ─── Embedded GraphQL SDL extractor ─────────────────────────────────────────
// BFF files export schema as template literals: export const fooSchema = `...gql...`

function extractEmbeddedGraphql(
  ast:          t.File,
  absolutePath: string,
  relPath:      string,
  _lineOffset:  number,
  result:       ParseResult,
): void {
  try {
    traverse(ast, {
      ExportNamedDeclaration(nodePath) {
        const decl = nodePath.node.declaration;
        if (!t.isVariableDeclaration(decl)) return;

        for (const declarator of decl.declarations) {
          if (!t.isIdentifier(declarator.id)) continue;
          if (!declarator.id.name.endsWith('Schema')) continue;
          if (!t.isTemplateLiteral(declarator.init)) continue;

          const sdlText = declarator.init.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');

          try {
            const gqlAst = parseGraphQL(sdlText, { noLocation: false });
            extractGraphqlNodes(gqlAst, absolutePath, relPath, result);
          } catch {
            // Embedded SDL might be partial (uses `extend type`) — ignore parse errors
          }
        }
      },
    });
  } catch {
    // Non-fatal: embedded SDL extraction is best-effort
  }
}

// ─── GraphQL SDL file parser ─────────────────────────────────────────────────

function parseGraphqlFile(
  source:       string,
  absolutePath: string,
  relPath:      string,
  result:       ParseResult,
): ParseResult {
  const fileNodeId = makeNodeId(relPath, 'file', relPath);
  const fileNode: CodeNode = {
    id:        fileNodeId,
    kind:      'file',
    name:      path.basename(absolutePath),
    filePath:  absolutePath,
    scopePath: relPath,
    loc:       { start: { line: 1, column: 0 }, end: { line: source.split('\n').length, column: 0 } },
    metadata:  { language: 'graphql' },
  };
  result.nodes.push(fileNode);

  try {
    const gqlAst = parseGraphQL(source, { noLocation: false });
    extractGraphqlNodes(gqlAst, absolutePath, relPath, result);
  } catch (err) {
    result.errors.push(`GraphQL parse error: ${(err as Error).message}`);
  }

  return result;
}

function extractGraphqlNodes(
  gqlAst:       gql.DocumentNode,
  absolutePath: string,
  relPath:      string,
  result:       ParseResult,
): void {
  const fileNodeId = makeNodeId(relPath, 'file', relPath);

  for (const def of gqlAst.definitions) {
    if (
      def.kind === 'ObjectTypeDefinition' ||
      def.kind === 'ObjectTypeExtension' ||
      def.kind === 'InputObjectTypeDefinition' ||
      def.kind === 'EnumTypeDefinition' ||
      def.kind === 'ScalarTypeDefinition' ||
      def.kind === 'InterfaceTypeDefinition' ||
      def.kind === 'UnionTypeDefinition'
    ) {
      const typeDef = def as gql.ObjectTypeDefinitionNode | gql.InputObjectTypeDefinitionNode;
      const name    = typeDef.name.value;
      const scope   = name;
      const nodeId  = makeNodeId(relPath, 'graphql-type', scope);

      const fields  = 'fields' in typeDef
        ? (typeDef.fields ?? []).map((f) => f.name.value)
        : [];

      const node: CodeNode = {
        id:        nodeId,
        kind:      'graphql-type',
        name,
        filePath:  absolutePath,
        scopePath: scope,
        loc:       gqlLocToSrcLoc(typeDef.loc),
        metadata:  {
          graphqlKind:   def.kind,
          graphqlFields: fields,
          language:      'graphql',
        },
      };
      result.nodes.push(node);
      result.edges.push(makeEdge(fileNodeId, 'contains', nodeId, name));

      // Query / Mutation / Subscription: each field is an operation node
      if (name === 'Query' || name === 'Mutation' || name === 'Subscription') {
        for (const field of fields) {
          const opScope  = `${name}.${field}`;
          const opNodeId = makeNodeId(relPath, 'graphql-operation', opScope);
          const opNode: CodeNode = {
            id:        opNodeId,
            kind:      'graphql-operation',
            name:      field,
            filePath:  absolutePath,
            scopePath: opScope,
            loc:       gqlLocToSrcLoc(typeDef.loc),
            metadata:  { graphqlOperation: name, language: 'graphql' },
          };
          result.nodes.push(opNode);
          result.edges.push(makeEdge(nodeId, 'contains', opNodeId, field));
        }
      }
    }
  }
}

function gqlLocToSrcLoc(loc: gql.Location | undefined): SourceLocation {
  if (!loc) return { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } };
  return {
    start: { line: loc.startToken.line, column: loc.startToken.column },
    end:   { line: loc.endToken.line,   column: loc.endToken.column },
  };
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Build a dot-separated scope path by looking up existing node names on the stack */
function buildScopePath(
  stack:    string[],
  nodes:    CodeNode[],
  _relPath: string,
  name:     string,
): string {
  // Skip the file node (index 0) and build scope from remaining containers
  const parts: string[] = [];
  for (let i = 1; i < stack.length; i++) {
    const node = nodes.find((n) => n.id === stack[i]);
    if (node) parts.push(node.name);
  }
  parts.push(name);
  return parts.join('.');
}

/** Extract the string name from any Babel param node */
function paramName(param: t.Node): string {
  if (t.isIdentifier(param))           return param.name;
  if (t.isAssignmentPattern(param))    return paramName(param.left);
  if (t.isRestElement(param))          return `...${paramName(param.argument)}`;
  if (t.isObjectPattern(param))        return '{…}';
  if (t.isArrayPattern(param))         return '[…]';
  if (t.isTSParameterProperty(param))  return paramName(param.parameter);
  return '?';
}

/** Check if the node path sits inside an export declaration */
function isExportedDecl(nodePath: { parentPath: { node: t.Node } | null | undefined }): boolean {
  if (!nodePath.parentPath) return false;
  const parent = nodePath.parentPath.node;
  return !!(t.isExportNamedDeclaration(parent) || t.isExportDefaultDeclaration(parent));
}
