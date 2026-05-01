const ts = require('typescript');
const fs = require('fs');
const path = 'components/scheduling/calendar-client.tsx';
const text = fs.readFileSync(path, 'utf8');
const result = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const diagnostics = result.parseDiagnostics;
console.log('diagnostics count', diagnostics.length);
for (const d of diagnostics) {
  const pos = result.getLineAndCharacterOfPosition(d.start || 0);
  console.log(d.messageText, 'at', pos.line + 1, pos.character + 1);
}
