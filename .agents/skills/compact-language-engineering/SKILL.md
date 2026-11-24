---
name: compact-language-engineering
description: >
  Build and maintain language tooling for Midnight's Compact language (parsers, grammars,
  syntax highlighters, formatters, linters, language servers, IntelliJ/Grammar-Kit plugins,
  tree-sitter grammars) without changing what the language accepts. Use this skill when a user
  asks to write or fix a Compact grammar, port the grammar to tree-sitter, Grammar-Kit, JFlex,
  ANTLR, Lezer, or TextMate, check operator precedence or associativity, track down parser
  ambiguities or nullable and left-recursive rules, generate parser regression tests, compare a
  third-party parser against the compiler, or build an LSP or editor extension for `.compact`
  files. Also use it for questions like "what tokens does Compact have", "is `/` or unary minus
  valid Compact", "why does my highlighter break on block comments", "tree-sitter-compact
  rejects valid code", or "how does the Nite language server get its diagnostics".
---

# Compact Language Engineering

Build Compact language tooling that accepts exactly what the compiler accepts, and prove it with differential tests.

> **Pinned to (Nov 2026):** Compact toolchain **0.36.1**, language version **0.28.0**. Grammar source: `LFDT-Minokawa/compact` at tag **`compactc-v0.36.1`**. At that tag the grammar, keywords, lexer and parser are identical to `main` (Nov 24 2026); only the version label in the generated doc differs. Re-check this whenever the toolchain moves.

**What this skill produces:** grammar files (tree-sitter `grammar.js`, Grammar-Kit `.bnf`, JFlex `.flex`, TextMate JSON), test corpora, and a differential test harness that uses the compiler as the oracle.

**Primary references (read these, not memory):**
- `compiler/parser.ss`: the real grammar (the `define-grammar Compact` form). The published grammar doc is **generated from it**.
- `compiler/lexer.ss`: the real token rules.
- `doc/compact-grammar.mdx` and `doc/compact-keywords.mdx`: generated, readable views of the two files above. Both say "DO NOT EDIT".
- `editor-support/vsc/compact/syntaxes/compact.tmLanguage.json`: the official VS Code TextMate grammar.
- `github.com/midnightntwrk/compact-tree-sitter`: the official tree-sitter grammar. It **lags the compiler** (section 5).
- `github.com/nite-framework/nite-compact-language-vsc-extension`: the Nite LSP. Its diagnostics come from the compiler.
- JetBrains Grammar-Kit `HOWTO.md`, for IntelliJ plugins.

**Key rules an agent must not get wrong:**
- The compiler is the only authority. When a doc, a tree-sitter grammar, a blog post and the compiler disagree, the compiler wins.
- Compact has **no** `/`, `%`, unary `-`, bitwise operators, `++`/`--`, `while`, `let` or `class`. Never add them "for completeness".
- Relational operators (`<`, `<=`, `>=`, `>`) are **non-associative**. `==` and `!=` are left-associative.
- `as` binds **looser** than `+`/`-`/`*`: `a + b as T` is `(a + b) as T`.
- `<` after an identifier can open a **generic argument list**, so `a < b < c` is a parse error, not a chained comparison.
- Block comments `/* */` exist and **do not nest**.

---

## Workflow

1. **Get the source of truth.** Clone the compiler at the tag that matches the user's toolchain (section 1). Do not work from a cached copy of the docs page.
2. **Write down the lexical layer first** (section 2): tokens, comments, literals, keywords. Most highlighter and tree-sitter bugs are lexer bugs.
3. **Map the syntactic layer** (section 3): the precedence tower, statements, special forms.
4. **List the hazards** (section 4) and decide how your parser technology handles each one.
5. **Port to the target**: tree-sitter (section 5), Grammar-Kit/JFlex (section 6), TextMate/LSP (section 7).
6. **Prove equivalence** with the differential harness and the probe set (section 8). Run it on the compiler's own 689 test and example contracts.
7. **Make optimizations behavior-preserving** (section 9). Run the harness before and after every change.
8. **Record the pinned version** in your tool and re-run the harness when the toolchain changes (section 10).

---

## 1) Getting the source of truth

```bash
git clone --depth 1 --branch compactc-v0.36.1 https://github.com/LFDT-Minokawa/compact.git
cd compact
ls compiler/parser.ss compiler/lexer.ss doc/compact-grammar.mdx doc/compact-keywords.mdx
compact compile --language-version     # 0.28.0 for toolchain 0.36.1
```

How the pieces relate:

| File | Role | Edit it? |
|---|---|---|
| `compiler/lexer.ss` | Hand-written state machine that produces tokens: `id`, `field`, `string`, `version`, `binop`, `punctuation`, comments, whitespace | Upstream only |
| `compiler/parser.ss` | `define-grammar Compact` built from parser combinators (`third_party/compiler/ez-grammar.ss`). Each alternative has a label and a semantic action | Upstream only |
| `doc/compact-grammar.mdx` | Generated from `parser.ss` when the compiler builds | Never |
| `doc/compact-keywords.mdx` | Generated from the `define-keyword-group` forms in `parser.ss` | Never |

The parser uses combinators with backtracking. It is not LALR or LL(1). This matters when you port it: an ordered choice that "just works" in the compiler can produce conflicts in tree-sitter or need lookahead in Grammar-Kit.

---

## 2) Lexical specification (from `lexer.ss`)

**Whitespace:** any Unicode whitespace. It is dropped before parsing, together with comments.

**Comments:**
- Line: `//` up to the newline.
- Block: `/* ... */`. A `/*` inside a block comment is the error `attempt to nest block comment`.

**Identifiers:** same as ECMAScript. The first character is a Unicode letter (`Lu Ll Lt Lm Lo Nl`), `_` or `$`. Later characters may also be `Mn Mc Nd Pc`. So `$café` is a valid identifier. An ASCII-only `[a-zA-Z_][a-zA-Z0-9_]*` regex is wrong.

**Numeric (Field) literals:**
- `0`, or decimal digits starting with `1`–`9`.
- `0b…`/`0B…`, `0o…`/`0O…`, `0x…`/`0X…`. Hex digits can be upper or lower case.
- A leading zero followed by a digit (`007`) is an error: `unsupported numeric syntax syntax: leading 0 must be followed by b, B, o, O, x, X`. (The word "syntax" really is doubled in the message.)
- A value above the maximum Field value is a **lexer** error: `… is out of Field range`.
- There are no underscores, no exponents and no decimal fractions.

**Version literals:** `nat.nat` or `nat.nat.nat` lexes as one `version` token (used in `pragma`). The lexer keeps this apart from ranges: after `0.`, a second `.` makes it put both dots back, so `0..3` lexes as `0`, `..`, `3`, while `0.3` is a version token. A naive regex lexer that sees `\d+\.\d+` first will break `for (const i of 0..3)` and `Uint<0..255>`.

**String literals:** single **or** double quotes, as in TypeScript. Escapes: `\" \' \\ \n \r \0 \b \f \t \v`, `\uXXXX` (exactly 4 hex digits), `\xXX` (2 hex digits), and backslash-newline as a line continuation. Any other escape is an error. Strings may not run to end of file.

**Operators and punctuation (complete list):**

| Kind | Tokens |
|---|---|
| Binary ops | `+ - * < > <= >= == != && \|\| = += -=` |
| Punctuation | `: ; , ( ) { } [ ] ? . .. ... => ! #` |
| Lexed but used by no rule | `/` (always a parse error) |
| Not tokens at all | a lone `&` or `\|`, `%`, `^`, `~`, `....` (four dots): each is a lexer error `unexpected character` |

**Keywords** (`doc/compact-keywords.mdx`). Reserved keywords can never be identifiers:
- Module: `export from import module prefix`
- Statement and expression: `as assert circuit const constructor contract default disclose else emit enum fold for if implements include ledger map new of pad pragma pure return sealed slice struct type witness`
- Built-in types: `Boolean Bytes Field Opaque Uint Vector`
- Literals: `false true`
- Reserved for future use: `arguments await break case catch class continue debugger delete do eval event extends finally function in instanceof interface let null package private protected public static super switch this throw try typeof var void while with yield`

`Maybe`, `Either`, `Counter`, `Map`, `Set`, `MerkleTree` and the other ledger ADTs and standard-library types are **not keywords**. They are ordinary identifiers resolved by the type checker. Highlight them as types or builtins, but your parser must accept them anywhere an `id` is allowed.

The compiler's errors name the token class, which helps when you write tests:
- `found keyword "slice" looking for a const binding`
- `found keyword "let" (which is reserved for future use) looking for a const binding`

---

## 3) Syntactic structure

**Program elements** (top level and inside `module { }`): `pragma`, `include "file";`, `[export] module Name<gparams> { … }`, `import { a, b as c } from Name<gargs> prefix P_;` (also `import "path";`), `export { a, b };`, `struct`, `enum`, `contract Name { circuit …; }`, `contract implements T;`, `[export] [new] type T<…> = …;`, `[export] [sealed] ledger x: T;`, `[export] witness w<…>(…): T;`, `constructor(…) { … }`, `[export] [pure] circuit f<…>(…): T { … }`.

**Generic parameters:** `<#N, T>`. `#` marks a size (numeric) parameter. Generic arguments are a `nat` or a type.

**Types:** `Boolean`, `Field`, `Uint<n>`, `Uint<lo..hi>`, `Bytes<n>`, `Opaque<"str">`, `Vector<n, T>`, tuple `[T, …]`, or a reference `Name<gargs>`. A size is a `nat` or an identifier.

**Expression precedence** (lowest at the top, all checked against `parser.ss`):

| Level | Operators | Associativity | Grammar |
|---|---|---|---|
| expr | `? :`, `=`, `+=`, `-=` | right | `expr0 ? expr : expr`, `expr0 = expr` |
| expr0 | `\|\|` | left | `expr0 \|\| expr1` |
| expr1 | `&&` | left | `expr1 && expr2` |
| expr2 | `==` `!=` | left | `expr2 == expr3` |
| expr3 | `<` `<=` `>=` `>` | **none** | `expr4 < expr4` |
| expr4 | `as Type` (postfix cast) | left | `expr4 as type` |
| expr5 | `+` `-` | left | `expr5 + expr6` |
| expr6 | `*` | left | `expr6 * expr7` |
| expr7 | `!` (prefix) | right | `! expr7` |
| expr8 | `e[expr]`, `e.id`, `e.id(args)` | left | postfix |
| expr9 | calls, `map`, `fold`, `slice<n>(e, i)`, `[…]` tuples, `Bytes[…]`, `T { … }` struct literals, `assert(e, "msg")`, `emit(e)`, `disclose(e)`, terms | n/a | n/a |
| term | `id`, `true`, `false`, nat, string, `pad(n, "s")`, `default<T>`, `( expr-seq )` | n/a | n/a |

**Assignment is an expression in the grammar.** Its left side is `expr0`, which the later passes restrict. Do not parse it as a statement-only rule.

**Expression sequences:** `a, b, c` is allowed in `( … )`, in `return …;`, in `if (…)` conditions and in expression statements. Commas are not only argument separators.

**Statements:** `if (…) stmt [else stmt]`, `const p[: T] = e, …;`, `for (const i of lo..hi) stmt` (lo and hi are a nat or an id), `for (const x of expr-seq) stmt`, `return [expr-seq];`, `{ … }`, `expr-seq;`.
- Dangling `else` goes to the **innermost** `if`. The grammar enforces this with the `stmt`/`stmt0` split.
- The old statement form `assert cond "msg";` is **gone**. Only `assert(cond, "msg")` parses. The compiler reports `found "a" looking for "("`.

**Patterns** (in `const` and parameters): `id`, tuple `[p, , p]` (holes allowed), struct `{ a, b: p }`.

**Arrow functions** (only as `map`/`fold` arguments or call heads): `(p[: T], …)[: R] => block-or-expr`.

**Spread:** `...e` is allowed inside tuple literals, `Bytes[…]` and struct literals.

---

## 4) Ambiguities and hazards

Each item below was confirmed with compiler 0.36.1 unless it is marked as a reading of the grammar.

1. **`<` means two things: generics and comparison.** `fun → id gargs`, so after `f` a `<` may start `<3>`. The compiler's backtracking parser accepts `a < b`. For `a < b < c` it commits to `b<…>` as a generic list and fails: `parse error: found ";" looking for ",", ">", or a generic argument list`. Your parser must accept `a < b` and `f<3>(x)` and must **reject** `a < b < c`. In LR tools, resolve `id '<'` by looking ahead for a closing `>` followed by `(` or `{`, or with a declared conflict (tree-sitter).
2. **`{` after an identifier:** `T { a: 1 }` is a struct literal (`tref { struct-arg… }`), and `{` also opens blocks. In statement position a block cannot follow an expression directly, so this ambiguity stays local, but LR generators will report it.
3. **`(` at expression start:** it can open a parenthesized `expr-seq`, an arrow function's parameter list `(x: T) => …`, or a `(fun)` call head. You only know which after the matching `)`, by whether `=>` or `:` follows. Tree-sitter needs conflicts here (the official grammar declares `[fun, term]`, `[fun, pattern]`, `[pattern, term]` and others).
4. **`[` at expression start:** a tuple literal, or in `const` a tuple pattern. Patterns allow holes (`[a, , c]`); expressions do not.
5. **Non-associative comparison:** `expr4 < expr4` takes no `expr3` on either side. Writing it as `prec.left` is a **behavior change**: the tool then accepts `a < b < c`, which the compiler rejects.
6. **Cast precedence:** `a + b as Field` parses as `(a + b) as Field`. `expr5` cannot contain `as`, so only that reading exists. A tool that binds `as` tighter (as TypeScript does) builds a different tree.
7. **No unary minus:** `-a` gives `parse error: found "-" looking for an expression sequence or ";"`. `0 - a` is the only form.
8. **No division:** `a / b` is lexed, then fails to parse. Do not "helpfully" add `/` to a precedence level.
9. **Ranges against versions:** see section 2. Handle this in the lexer, not the parser.
10. **Keywords that look like functions:** `map`, `fold`, `slice`, `assert`, `emit`, `disclose`, `pad`, `default` are keywords with dedicated rules, not calls to identifiers. `slice<2>(v, 1)` puts its generic size before the call parentheses.
11. **Type errors are not parse errors.** `emit(1)` parses and then fails with `expected structure type (representation of an event)`. Indexing `v[i]` with a non-literal `i` parses (the grammar takes any `expr`). Never tighten the grammar to catch semantic errors: that rejects code the compiler accepts.

**Nullable and recursion checks for ported grammars:**
- The only nullable sequences in the reference are comma or semicolon lists with zero items (parameters, args, struct fields, imports, the `*` lists of program elements and statements). `enum` needs **at least one** member (`⋯¹`). `map` needs at least one collection and `fold` an initial value plus at least one collection.
- Left recursion appears only in the binary and postfix levels (expr0–expr8, version-expr). Tree-sitter and Grammar-Kit both support direct left recursion with precedence annotations. ANTLR4 supports it directly. LL(1) and recursive-descent ports must rewrite each level as `level → next (op next)*`, except expr3, which becomes `expr4 (relop expr4)?`.
- No indirect left recursion exists. If your port introduces one, you changed the structure.

---

## 5) Tree-sitter (`midnightntwrk/compact-tree-sitter`)

Status (read from `grammar.js` at commit `6693aff`, Apr 8 2026, version 0.1.0, `tree-sitter-cli ^0.25.1`): the README says it parses "the entire Compact language". It does **not** match compiler 0.36.1. These gaps come from reading the source. Confirm each one with `tree-sitter parse` before you file or fix it.

| Area | tree-sitter-compact | Compiler 0.36.1 |
|---|---|---|
| Comments | `//` only | `//` and non-nesting `/* */` |
| Identifiers | `/[a-zA-Z_][a-zA-Z0-9_]*/` | Unicode letters, `_`, `$` |
| Numbers | decimal only | also `0b`, `0o`, `0x` |
| Strings | `"…"` with no escapes | `'…'` or `"…"` with escapes |
| Index | `e[nat]` | `e[expr]` |
| Relational ops | left-recursive on `_expr3` (accepts `a<b<c`) | non-associative |
| `assert` | statement `assert e "msg";` | expression `assert(e, "msg")` |
| `for` range | `nat..nat` | `tsize..tsize` (nat or id) |
| Missing forms | none of these appear | `slice<n>(…)`, `emit(…)`, `contract implements T;`, `new type`, `Bytes[…]`, tuple spread `[...t]` |

Working with it:

```bash
git clone https://github.com/midnightntwrk/compact-tree-sitter && cd compact-tree-sitter
npm install
npx tree-sitter generate      # regenerates src/parser.c from grammar.js
npx tree-sitter test          # runs test/corpus/*.txt
npx tree-sitter parse file.compact
```

Corpus format (`test/corpus/*.txt`): a header line between `===` lines, the source, `---`, then the expected S-expression:

```
===============
block comment between declarations
===============
/* a */ export circuit f(): Field { return 1; }
---
(source_file (comment) (cdefn ...))
```

Rules for changes:
- Add `word: $ => $.id` to turn on tree-sitter's keyword extraction. It gives a smaller, faster lexer and stops keywords from being split out of longer identifiers. Reserved-for-future words such as `let` still need an explicit rule if you want them rejected as identifiers.
- Use an `externals` scanner only if you must. Block comments can be done with a single regex token (`/\/\*[^*]*\*+([^/*][^*]*\*+)*\//`), because they cannot nest. That regex treats `/* a /* b */` as one comment and leaves the trailing ` */` as an error, while the compiler rejects the inner `/*` itself. If you need the compiler's exact error position, add a check for `/*` inside comment nodes.
- Keep every entry in `conflicts` justified by one of the hazards in section 4. A new conflict usually hides a real precedence mistake.
- Every grammar fix gets a corpus case **and** a compiler probe proving the compiler agrees (section 8).
- Highlights live in `queries/highlights.scm`. When you add a keyword rule, add its capture there.

---

## 6) IntelliJ: Grammar-Kit and JFlex

Grammar-Kit builds a PSI parser from a `.bnf` file. "Generate JFlex Lexer" creates a `.flex` file from the BNF tokens, and "Run JFlex Generator" turns that into the lexer class. Expression rules follow the Pratt-style pattern from Grammar-Kit's `HOWTO.md`: priority rises from top to bottom, binary rules are left-recursive, and `rightAssociative=true` sets right associativity.

Compact's tower in that style (a starting point; check it against the Grammar-Kit version you pin):

```bnf
{
  parserClass="dev.compact.parser.CompactParser"
  extends(".*_expr")=expr
  tokens=[
    LINE_COMMENT='regexp://.*'
    ID='regexp:[\p{L}\p{Nl}_$][\p{L}\p{Nl}\p{Mn}\p{Mc}\p{Nd}\p{Pc}_$]*'
    NAT='regexp:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|0|[1-9][0-9]*'
  ]
}

expr ::= cond_expr
  | assign_expr
  | or_expr
  | and_expr
  | eq_group
  | rel_expr
  | cast_expr
  | add_group
  | mul_expr
  | not_expr
  | postfix_group
  | primary_group

cond_expr   ::= expr '?' expr ':' expr { rightAssociative=true }
assign_expr ::= expr ('=' | '+=' | '-=') expr { rightAssociative=true }
or_expr     ::= expr '||' expr
and_expr    ::= expr '&&' expr
private eq_group ::= eq_expr | ne_expr
eq_expr     ::= expr '==' expr
ne_expr     ::= expr '!=' expr
rel_expr    ::= expr ('<' | '<=' | '>=' | '>') expr   // non-assoc: see note
cast_expr   ::= expr 'as' type
private add_group ::= plus_expr | minus_expr
plus_expr   ::= expr '+' expr
minus_expr  ::= expr '-' expr
mul_expr    ::= expr '*' expr
not_expr    ::= '!' expr
private postfix_group ::= index_expr | member_call_expr | member_expr
index_expr  ::= expr '[' expr ']'
member_call_expr ::= expr '.' ID '(' arg_list? ')'
member_expr ::= expr '.' ID
```

Notes:
- **Non-associativity.** Pratt-style Grammar-Kit rules are associative. Either reject chained comparisons in an `Annotator` (point it at a `rel_expr` whose operand is another `rel_expr`), or write expr3 as a plain non-Pratt rule `rel_level ::= add_level (rel_op add_level)?`. Never leave `a<b<c` silently accepted.
- **Generic `<`.** Write `call_expr ::= ID generic_args? '(' arg_list? ')'` **without** `pin` on `<`. Grammar-Kit sequences backtrack unless pinned, so a failed `generic_args` falls back to comparison, just as the compiler does.
- **Error recovery.** Pin top-level declarations on their leading keyword (`circuit_def ::= EXPORT? PURE? CIRCUIT … {pin=3}`, `ledger_decl ::= … LEDGER … {pin=…}`). Put `recoverWhile` on the program-element rule with a predicate such as `!(CIRCUIT | LEDGER | WITNESS | STRUCT | ENUM | MODULE | IMPORT | EXPORT | PRAGMA | CONSTRUCTOR | CONTRACT | TYPE | INCLUDE | '}')`, so one broken circuit does not wipe out the PSI for the rest of the file.
- **JFlex lexer.** Write the version/range rule by hand (section 2): match `{NAT}"."{NAT}("."{NAT})?` only when the character after the first dot is a digit, and emit `NAT` `..` `NAT` for `0..3`. Block comments: `"/*" ~"*/"`. A nested `/*` should become a `BAD_CHARACTER` or error token, matching the compiler.
- Unquoted implicit tokens in the BNF become keywords named by their value. Keep the keyword set exactly equal to `compact-keywords.mdx`, reserved words included, so `let` and `class` are not accepted as identifiers.

---

## 7) Highlighting, formatting and language servers

**TextMate.** Start from the official `editor-support/vsc/compact/syntaxes/compact.tmLanguage.json`. It changes between releases, so take it from the tag you pinned. TextMate cannot parse. Use it only for tokens: keywords from `compact-keywords.mdx`, numbers in all four bases, both string quotes, block comments, `#` size parameters, and stdlib or ADT names as `support.type`.

**Formatter.** `compact format` is the canonical formatter (`compiler/formatter.ss`). Do not write a second one. Use it as an oracle instead:
- `compact format --check <files>` exits `1` when a file would change and `0` when it is already formatted.
- Formatting is idempotent (checked: formatting already-formatted output gives no diff).
- `compact fixup` rewrites source for recent language changes and then reformats it. Use it for migrations, not as your formatter oracle.

**Diagnostics: use the compiler, not a hand parser.**
- `compact compile --skip-zk <file> <outdir>` runs every front-end pass without generating proving keys.
- Error format: `Exception: <file> line <L> char <C>:` followed by indented message lines.
- `--vscode` prints each error on one line for editor integration.

**Nite language server** (`nite-framework/nite-compact-language-vsc-extension`, v0.2.2) is a reference design built this way:
1. It mirrors the workspace's `.compact` files into a temporary shadow workspace, overlaying unsaved buffers.
2. It builds an import graph from `import "…"` and `include "…"` and picks the root contracts affected by an edit.
3. It runs `compact compile --skip-zk` on those roots (cancelling superseded runs, debounced by 400 ms by default) and parses `Exception: … line N char M:` with a regex into LSP diagnostics.
4. It provides completion, hover and outline from its own symbol index and stdlib tables. Formatting calls `compact format`.

Its roadmap lists a tree-sitter grammar "for instant syntax errors without spawning the compiler". That is only safe once the tree-sitter grammar passes the differential harness in section 8. Until then, a tree-sitter error should never hide or replace a compiler diagnostic.

---

## 8) Proving equivalence: differential tests

The compiler is the oracle. A file is a **parse reject** only when the compiler's message comes from the lexer or parser. Type errors mean the parse was **accepted**.

```bash
#!/usr/bin/env bash
# difftest.sh <dir> [parser-cmd]. parser-cmd gets the file path and must exit 0 iff it parses.
set -u
DIR=$1; PARSER=${2:-}
OUT=$(mktemp -d)
PARSE_RE='parse error|unexpected character|unexpected end of file|unexpected newline|attempt to nest block comment|unsupported numeric syntax|unexpected digit|out of Field range'
pass=0; fail=0
while IFS= read -r f; do
  msg=$(compact compile --skip-zk "$f" "$OUT/x" 2>&1)
  if grep -Eq "$PARSE_RE" <<<"$msg"; then oracle=reject; else oracle=accept; fi
  if [ -n "$PARSER" ]; then
    if $PARSER "$f" >/dev/null 2>&1; then mine=accept; else mine=reject; fi
    if [ "$oracle" = "$mine" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "DIFF $f compiler=$oracle parser=$mine"; fi
  else
    echo "$oracle $f"
  fi
done < <(find "$DIR" -name '*.compact' | sort)
[ -n "$PARSER" ] && echo "agree=$pass disagree=$fail"
rm -rf "$OUT"
```

For tree-sitter, put a small wrapper script in the grammar directory so its exit code means accepted or rejected:

```bash
cat > ts-accepts.sh <<'EOF'
#!/usr/bin/env bash
# exit 0 iff tree-sitter parses $1 with no ERROR or MISSING nodes
! npx tree-sitter parse -q "$1" 2>&1 | grep -q 'ERROR\|MISSING'
EOF
chmod +x ts-accepts.sh
./difftest.sh ../compact/test-contracts ./ts-accepts.sh
```

**Corpus:**
- Positive: the 689 `.compact` files under `test-contracts/` and `examples/` in the compiler repo. Do not assume all of them are valid: the harness asks the oracle for each file's label.
- Negative: the probe set below. Every row was compiled with 0.36.1.

| Probe | Compiler result |
|---|---|
| `return a / b;` | reject: `parse error: found "/" looking for …` |
| `return -a;` | reject: `found "-" looking for an expression sequence or ";"` |
| `return a % b;` | reject: `unexpected character '%'` |
| `return a & b;` | reject: `unexpected character ' '` (a lone `&`) |
| `return a < b < c;` | reject: `found ";" looking for ",", ">", or a generic argument list` |
| `return a == b == c;` | accept |
| `return 007;` | reject: `leading 0 must be followed by b, B, o, O, x, X` |
| `return 0xFF + 0b101 + 0o17;` | accept (type `Uint<0..276>`) |
| `/* a /* b */ */` | reject: `attempt to nest block comment` |
| `/* outer */` before a declaration | accept |
| `return 'hi\n';` | accept (type `Bytes<3>`) |
| `const $café = 1;` | accept |
| `const let = 1;` | reject: `keyword "let" (which is reserved for future use)` |
| `const slice = 1;` | reject: `found keyword "slice"` |
| `return v[i];` (i a const) | accept |
| `return slice<2>(v, 1);` | accept |
| `assert a "nope";` | reject: `found "a" looking for "("` |
| `assert(a, "nope");` | accept |
| `return a + b as Field;` | accept, parsed as `(a + b) as Field` |
| `return [...t, 3];` | accept |
| `return Bytes[1, 2];` | accept |
| `if (a) if (b) return 1; else return 2;` | accept (`else` goes to the inner `if`) |
| `emit(1);` | parse accept, then type error `expected structure type (representation of an event)` |

Wrap each probe in `pragma language_version >= 0.28; import CompactStandardLibrary; export circuit f(…): T { … }`.

---

## 9) Safe grammar optimization

An optimization is any change that should leave the set of accepted programs **and** the tree shape your consumers rely on unchanged.

1. Run the harness and save the baseline (`agree=N disagree=M`).
2. Make one change: inline a rule, merge precedence levels, drop a conflict, swap a regex for a keyword token.
3. Re-run. `disagree` must not go up, and no `DIFF` line may flip from agree to disagree.
4. For tree-sitter, also diff the S-expressions of the whole positive corpus before and after. Highlight queries and LSP symbol extraction depend on node names and `field()` labels, so renaming a node is a breaking change.
5. Measure: time `tree-sitter parse` on the largest contracts in the corpus, and use IntelliJ's PSI viewer for Grammar-Kit. Typical gains come from removing unnecessary `conflicts` (each one forks the GLR parser), from `word` keyword extraction, and from collapsing `_hidden` single-child rules.

**Incremental parsing (tree-sitter and IntelliJ):** keep errors local. Make program elements and blocks self-contained (each closes on its own `}`), avoid tokens whose meaning depends on distant context, and keep block comments as one token so a stray `*/` does not re-lex the rest of the file.

**Never do any of these to "optimize":**
- Merge the relational level into equality or make it associative.
- Reorder `as` above `+`.
- Restrict `e[expr]` to literals.
- Accept reserved words as identifiers.
- Add operators the lexer does not produce.

---

## 10) Tracking language versions

- Each toolchain release ships a language version (`compact compile --language-version`). Contracts declare `pragma language_version …;` with `>=`, `<`, `&&`, `||` and `!` over versions.
- On a toolchain bump, diff the source of truth between tags:
  ```bash
  git diff compactc-v<old> compactc-v<new> -- compiler/lexer.ss compiler/parser.ss doc/compact-keywords.mdx
  ```
  Then read `CHANGELOG_compactc.md` and `doc/release-notes/` for syntax changes, re-run the harness, and update the pinned version in your tool.
- A generated doc version such as `0.28.101` on `main` marks an unreleased dev build. Pin tools to release tags, not to `main`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Highlighter turns the rest of the file into a comment after `/* … */` | Block comment regex is greedy or nested | Use the non-greedy single-token regex; do not support nesting |
| `for (const i of 0..3)` fails in your parser | Lexer reads `0.` as the start of a version | Look ahead: emit `..` when two dots follow a nat |
| Your parser accepts `a < b < c` | Relational level written left-associative | Make it `add (relop add)?` or reject it in an annotator |
| Your parser rejects `f<3>(x)` or `slice<2>(v, 0)` | `<` always treated as an operator | Try generic args first, with backtracking or a GLR conflict |
| tree-sitter fails on valid contracts with `assert(` | Grammar still has the old `assert e "msg";` statement | Replace it with an expression rule `assert ( expr , str )` |
| Identifiers with `$` or non-ASCII letters show as errors | ASCII-only `id` regex | Use Unicode classes `\p{L}\p{Nl}` and so on, plus `_` and `$` |
| LSP shows errors the compiler does not | Hand parser or tree-sitter stricter than the compiler | Run difftest; let compiler diagnostics win |
| `compact format --check` fails in CI but the file looks right | Formatter output changed between toolchains | Pin the toolchain (`compact compile +0.36.1` / `compact update 0.36.1`) and reformat |
| Grammar doc and compiler disagree | The doc page is from another version | Regenerate from `parser.ss` at the matching tag; trust the compiler |

---

## Related skills

- `compact/`: writing Compact contracts (semantics, types, disclosure). Read it for what the syntax means.
- `testing/`: compiler errors, `--skip-zk` dev loop, toolchain version management.
- `midnight-environment-setup/`: installing the `compact` CLI and toolchains used by the harness.
- `midnight-security/`: when you build linters, these are the patterns worth flagging.
