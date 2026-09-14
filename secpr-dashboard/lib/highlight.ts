// Deliberately tiny per-line tokenizer for code views. It only needs to make
// strings, comments and keywords legible — it is not a parser and it does not
// track multi-line constructs.

export type TokenKind = 'kw' | 'str' | 'cmt' | 'num' | 'plain'

export interface Token {
  kind: TokenKind
  text: string
}

const KEYWORDS: Record<string, string[]> = {
  go: ['package', 'import', 'func', 'return', 'var', 'const', 'type', 'struct', 'interface', 'if', 'else', 'for', 'range', 'defer', 'go', 'select', 'switch', 'case', 'default', 'break', 'continue', 'map', 'chan', 'nil', 'true', 'false', 'string', 'int', 'int64', 'byte', 'error', 'bool', 'any'],
  js: ['import', 'export', 'from', 'function', 'return', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'new', 'class', 'extends', 'async', 'await', 'try', 'catch', 'throw', 'null', 'undefined', 'true', 'false', 'this', 'default'],
  py: ['import', 'from', 'def', 'return', 'class', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or', 'try', 'except', 'raise', 'with', 'as', 'lambda', 'None', 'True', 'False', 'pass', 'yield', 'async', 'await'],
  java: ['import', 'package', 'public', 'private', 'protected', 'static', 'final', 'class', 'interface', 'void', 'return', 'new', 'if', 'else', 'for', 'while', 'try', 'catch', 'throw', 'throws', 'null', 'true', 'false', 'this', 'int', 'String', 'boolean'],
  rs: ['use', 'fn', 'let', 'mut', 'pub', 'struct', 'enum', 'impl', 'return', 'if', 'else', 'for', 'while', 'loop', 'match', 'mod', 'crate', 'self', 'Some', 'None', 'Ok', 'Err', 'true', 'false'],
  rb: ['def', 'end', 'class', 'module', 'return', 'if', 'elsif', 'else', 'unless', 'while', 'do', 'yield', 'require', 'nil', 'true', 'false', 'self', 'begin', 'rescue'],
}
KEYWORDS.ts = KEYWORDS.js
KEYWORDS.tsx = KEYWORDS.js

const HASH_COMMENT = new Set(['py', 'rb', 'sh', 'unknown'])

const KEYWORD_SETS = new Map<string, Set<string>>()
function keywordsFor(lang: string): Set<string> {
  let set = KEYWORD_SETS.get(lang)
  if (!set) {
    set = new Set(KEYWORDS[lang] ?? [])
    KEYWORD_SETS.set(lang, set)
  }
  return set
}

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*/
const NUM_RE = /^\d[\d_.xXa-fA-F]*/

export function tokenize(line: string, lang: string): Token[] {
  const out: Token[] = []
  const kws = keywordsFor(lang)
  const commentPrefix = HASH_COMMENT.has(lang) ? '#' : '//'
  let i = 0
  let plain = ''
  const flush = () => { if (plain) { out.push({ kind: 'plain', text: plain }); plain = '' } }

  while (i < line.length) {
    const ch = line[i]
    if (line.startsWith(commentPrefix, i)) {
      flush()
      out.push({ kind: 'cmt', text: line.slice(i) })
      return out
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < line.length && line[j] !== ch) { if (line[j] === '\\' && ch !== '`') j++; j++ }
      flush()
      out.push({ kind: 'str', text: line.slice(i, Math.min(j + 1, line.length)) })
      i = j + 1
      continue
    }
    const num = NUM_RE.exec(line.slice(i))
    if (num && !/[A-Za-z0-9_]/.test(line[i - 1] ?? '')) {
      flush()
      out.push({ kind: 'num', text: num[0] })
      i += num[0].length
      continue
    }
    const id = IDENT_RE.exec(line.slice(i))
    if (id) {
      if (kws.has(id[0])) { flush(); out.push({ kind: 'kw', text: id[0] }) }
      else plain += id[0]
      i += id[0].length
      continue
    }
    plain += ch
    i++
  }
  flush()
  return out
}
