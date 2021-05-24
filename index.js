// im just leaving this here to trick vscode into thinking this is a node env and not a browser env lul
const { } = require('fs');

/**
 * lex + parse + eval a string
 * @param {string[]} tokens 
 * @returns {(out: string[]) => (opStack: string[]) => string}
 */
const compile = (
  // opTokens are memoized in an IIFE
  opTokens => (tokenString = '') =>
    /**
     * @param {string[]} tokens 
     * @returns {(out: string[]) => (opStack: string[]) => string}
     */
    (parse = tokens => out => opStack =>
      tokens.length > 0
        ? /* parser - shunting yard */ (
          /**
           * compileWithTokens is the same for both branches as well as thisToken,
           * so an IIFE is used to reduce it out, eg.
           *   addToOutput = f(tokens)(out + tokens[0])(ops)
           *   addToOps = f(tokens)(out)(ops + tokens[0])
           * f(tokens) is common so we can extract it such that:
           *   ft = f(tokens)
           *   t = tokens[0]
           *   addToOutput = ft(out + t)(ops)
           *   addToOps = ft(out)(ops + t)
           */
          (compileWithTokens => thisToken =>
            (thisTokenOp =>
              thisTokenOp
                ? /* operators */ (
                  opStack.length > 0
                    ? (
                      thisTokenOp === '('
                        ? compileWithTokens(out)([...opStack, thisToken])
                        : thisTokenOp === ')'
                          ? (
                            // When a ')' is found, pop every operator into the out stack until the first '(', but excluding '('
                            compileWithTokens([
                              ...out,
                              ...opStack
                                .slice(opStack.lastIndexOf('(') + 1) // +1 to exclude '('
                                .reverse()
                            ])(
                              // the op stack is now everything up until the last '(' and excluding '('
                              opStack.slice(0, opStack.lastIndexOf('('))
                            )
                          )
                          : (topToken => ( // thisTokenOp is neither '(' nor ')'
                            (
                              // operator at the top of the stack has higher precedence
                              topToken.precedence > thisTokenOp.precedence
                              // or the operator at the top of the operator stack has equal precedence and the token is left-associative
                              || (topToken.precedence === thisTokenOp.precedence && thisTokenOp.associativity === 'l')
                            )
                            && topToken.operator !== '('
                          )
                            ? (
                              // token is lower precedence or eq precedence and left associative,
                              // so push all of the opStack into out, and put the token on the opStack
                              compileWithTokens([...out, topToken.operator])(opStack.slice(0, -1))
                            )
                            : compileWithTokens(out)([...opStack, thisToken])
                          )(opTokens.find(op => op.operator === opStack[opStack.length - 1]))
                    ) : compileWithTokens(out)([thisTokenOp.operator]) // we have an operator token but there aren't any operators in the opStack
                )
                : /* numbers */ (
                  compileWithTokens([...out, thisToken])(opStack)
                )
            )(opTokens.find(op => op.operator === thisToken))
          )(parse(tokens.slice(1)))(tokens[0])
        )
        : opStack.length > 0
          ? parse([])([...out, ...[].concat(opStack).reverse()])([])
          : /* compile */ (
            // TODO: just leaving this like this for now to test the parser
            [...out, ...opStack]
          )
    )(
      /* lexer */
      tokenString
        .split('')
        .reduce((tokens, char) =>
          tokens.length === 0
            ? [char]
            : opTokens.find(opToken => opToken.operator === char)
              ? [...tokens, char] // operators get appended as their own token
              : char === ' '
                ? tokens // ignore whitespace
                // at this point, char is a number (or letters but we don't account for that yet)
                : opTokens.some(opToken => opToken.operator === tokens[tokens.length - 1]) // check if the last token was an operator
                  ? [...tokens, char] // if it is an operator, then add the char as it's own token
                  : [
                    ...tokens.slice(0, tokens.length - 1),
                    tokens[tokens.length - 1] + char // last token is a number so concat the strings, eg. ['1', '0'] becomes '10'
                  ]
          , [])
    )
)([
  { operator: '+', precedence: 2, associativity: 'l' },
  { operator: '-', precedence: 2, associativity: 'l' },
  { operator: 'x', precedence: 3, associativity: 'l' },
  { operator: '^', precedence: 4, associativity: 'r' },
  { operator: '/', precedence: 3, associativity: 'l' },
  { operator: '(', precedence: 0, associativity: 'l' },
  { operator: ')', precedence: 0, associativity: 'l' },
]);


if (require.main.filename === __filename) {
  const testString = '3 + 4 x 2 / ( 1 - 5 ) ^ 2 ^ 3';
  const expectedParseOutput = '3 4 2 x 1 5 - 2 3 ^ ^ / +'.split(' ');
  console.log('actual:');
  console.log(compile(testString)([])([]));
  console.log('expected:');
  console.log(expectedParseOutput);
}