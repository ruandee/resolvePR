package ast

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	sitter "github.com/smacker/go-tree-sitter"
	"github.com/smacker/go-tree-sitter/golang"
	"github.com/smacker/go-tree-sitter/java"
	"github.com/smacker/go-tree-sitter/javascript"
	"github.com/smacker/go-tree-sitter/python"
	"github.com/smacker/go-tree-sitter/ruby"
	"github.com/smacker/go-tree-sitter/rust"
	"github.com/smacker/go-tree-sitter/typescript/tsx"
	"github.com/smacker/go-tree-sitter/typescript/typescript"
)

// Chunk is a unit of context sent to the LLM for review.
type Chunk struct {
	File         string
	Language     string
	FunctionName string
	FunctionBody string
	StartLine    int
	ChangedLines []int // 1-based, relative to FunctionBody start
}

// DetectLang returns a short language tag based on file extension.
func DetectLang(path string) string {
	switch filepath.Ext(path) {
	case ".go":
		return "go"
	case ".js", ".jsx", ".mjs", ".cjs":
		return "js"
	case ".ts":
		return "ts"
	case ".tsx":
		return "tsx"
	case ".py", ".pyw":
		return "py"
	case ".java":
		return "java"
	case ".rs":
		return "rs"
	case ".rb":
		return "rb"
	case ".c", ".h":
		return "c"
	case ".cpp", ".cc", ".cxx", ".hpp":
		return "cpp"
	case ".kt", ".kts":
		return "kt"
	case ".swift":
		return "swift"
	case ".cs":
		return "cs"
	case ".php":
		return "php"
	case ".sh", ".bash":
		return "sh"
	}
	return "unknown"
}

// grammar returns the tree-sitter language for a given lang tag.
func grammar(lang string) *sitter.Language {
	switch lang {
	case "go":
		return golang.GetLanguage()
	case "js":
		return javascript.GetLanguage()
	case "ts":
		return typescript.GetLanguage()
	case "tsx":
		return tsx.GetLanguage()
	case "py":
		return python.GetLanguage()
	case "java":
		return java.GetLanguage()
	case "rs":
		return rust.GetLanguage()
	case "rb":
		return ruby.GetLanguage()
	}
	return nil
}

// funcNodeTypes lists tree-sitter node types that represent a callable unit.
var funcNodeTypes = map[string][]string{
	"go":   {"function_declaration", "method_declaration", "func_literal"},
	"js":   {"function_declaration", "function_expression", "arrow_function", "method_definition", "generator_function_declaration"},
	"ts":   {"function_declaration", "function_expression", "arrow_function", "method_definition", "generator_function_declaration"},
	"tsx":  {"function_declaration", "function_expression", "arrow_function", "method_definition", "generator_function_declaration"},
	"py":   {"function_definition", "async_function_definition"},
	"java": {"method_declaration", "constructor_declaration"},
	"rs":   {"function_item"},
	"rb":   {"method", "singleton_method"},
}

// nameField is the child field name that holds a node's identifier.
var nameField = map[string]string{
	"go":   "name",
	"js":   "name",
	"ts":   "name",
	"tsx":  "name",
	"py":   "name",
	"java": "name",
	"rs":   "name",
	"rb":   "name",
}

// MakeChunks builds context chunks from file source.
// It uses tree-sitter AST parsing for supported languages and falls back
// to a ±30-line window for unsupported ones.
func MakeChunks(source []byte, lang, file string, changedLines []int) []Chunk {
	if len(changedLines) == 0 {
		return nil
	}
	if g := grammar(lang); g != nil {
		if chunks := treeChunks(source, lang, file, changedLines, g); len(chunks) > 0 {
			return chunks
		}
	}
	return makeChunksFallback(source, lang, file, changedLines)
}

// treeChunks parses source with tree-sitter and extracts the enclosing
// function for each changed line. Changed lines outside any function are
// grouped and emitted as fallback window chunks.
func treeChunks(source []byte, lang, file string, changedLines []int, g *sitter.Language) []Chunk {
	parser := sitter.NewParser()
	parser.SetLanguage(g)
	tree, err := parser.ParseCtx(context.Background(), nil, source)
	if err != nil || tree == nil {
		return nil
	}

	types, ok := funcNodeTypes[lang]
	if !ok {
		return nil
	}
	typeSet := make(map[string]bool, len(types))
	for _, t := range types {
		typeSet[t] = true
	}

	funcs := collectFuncNodes(tree.RootNode(), typeSet)
	lines := strings.Split(string(source), "\n")
	field := nameField[lang]

	type fnKey struct{ start, end uint32 }
	fnChunks := map[fnKey]*Chunk{}
	fnOrder := []fnKey{}
	var orphans []int

	for _, cl := range changedLines {
		row := uint32(cl - 1) // tree-sitter rows are 0-based
		fn := innermostFunc(funcs, row)
		if fn == nil {
			orphans = append(orphans, cl)
			continue
		}
		key := fnKey{fn.StartPoint().Row, fn.EndPoint().Row}
		if _, exists := fnChunks[key]; !exists {
			startLine := int(fn.StartPoint().Row) + 1
			endLine := int(fn.EndPoint().Row) + 1
			if endLine > len(lines) {
				endLine = len(lines)
			}
			body := strings.Join(lines[startLine-1:endLine], "\n")
			name := nodeIdentifier(fn, source, field)
			if name == "" {
				name = fmt.Sprintf("%s@%d", fn.Type(), startLine)
			}
			fnChunks[key] = &Chunk{
				File:         file,
				Language:     lang,
				FunctionName: name,
				FunctionBody: body,
				StartLine:    startLine,
			}
			fnOrder = append(fnOrder, key)
		}
		c := fnChunks[key]
		rel := cl - c.StartLine + 1
		c.ChangedLines = append(c.ChangedLines, rel)
	}

	var out []Chunk
	for _, k := range fnOrder {
		out = append(out, *fnChunks[k])
	}
	if len(orphans) > 0 {
		out = append(out, makeChunksFallback(source, lang, file, orphans)...)
	}
	return out
}

// collectFuncNodes does a depth-first walk and returns every node whose type
// is in the provided set.
func collectFuncNodes(n *sitter.Node, types map[string]bool) []*sitter.Node {
	var out []*sitter.Node
	var walk func(*sitter.Node)
	walk = func(node *sitter.Node) {
		if types[node.Type()] {
			out = append(out, node)
		}
		for i := 0; i < int(node.ChildCount()); i++ {
			walk(node.Child(i))
		}
	}
	walk(n)
	return out
}

// innermostFunc returns the smallest enclosing function node for the given row.
func innermostFunc(funcs []*sitter.Node, row uint32) *sitter.Node {
	var best *sitter.Node
	bestSpan := uint32(0xFFFFFFFF)
	for _, fn := range funcs {
		start := fn.StartPoint().Row
		end := fn.EndPoint().Row
		if row < start || row > end {
			continue
		}
		span := end - start
		if best == nil || span < bestSpan {
			best = fn
			bestSpan = span
		}
	}
	return best
}

// nodeIdentifier extracts the identifier of a function node.
func nodeIdentifier(n *sitter.Node, src []byte, field string) string {
	if named := n.ChildByFieldName(field); named != nil {
		return named.Content(src)
	}
	// Fallback: first identifier child
	for i := 0; i < int(n.ChildCount()); i++ {
		ch := n.Child(i)
		if ch.Type() == "identifier" || ch.Type() == "property_identifier" {
			return ch.Content(src)
		}
	}
	return ""
}

// makeChunksFallback groups consecutive changed lines and emits a ±30-line
// window around each group.
func makeChunksFallback(source []byte, lang, file string, changedLines []int) []Chunk {
	if len(changedLines) == 0 {
		return nil
	}
	lines := strings.Split(string(source), "\n")
	groups := groupConsecutive(changedLines)

	var chunks []Chunk
	for _, group := range groups {
		first := group[0]
		last := group[len(group)-1]

		startLine := first - 30
		if startLine < 1 {
			startLine = 1
		}
		endLine := last + 30
		if endLine > len(lines) {
			endLine = len(lines)
		}

		body := strings.Join(lines[startLine-1:endLine], "\n")
		relativeChanged := make([]int, len(group))
		for i, line := range group {
			relativeChanged[i] = line - startLine + 1
		}

		chunks = append(chunks, Chunk{
			File:         file,
			Language:     lang,
			FunctionName: fmt.Sprintf("chunk@%d-%d", startLine, endLine),
			FunctionBody: body,
			StartLine:    startLine,
			ChangedLines: relativeChanged,
		})
	}
	return chunks
}

func groupConsecutive(lines []int) [][]int {
	if len(lines) == 0 {
		return nil
	}
	var groups [][]int
	current := []int{lines[0]}
	for i := 1; i < len(lines); i++ {
		if lines[i]-lines[i-1] <= 5 {
			current = append(current, lines[i])
		} else {
			groups = append(groups, current)
			current = []int{lines[i]}
		}
	}
	groups = append(groups, current)
	return groups
}
