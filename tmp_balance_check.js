const fs = require('fs');
const text = fs.readFileSync('components/scheduling/calendar-client.tsx', 'utf8');
const lines = text.split(/\r?\n/);
let inSingle = false;
let inDouble = false;
let inTemplate = false;
let inComment = false;
let paren = 0;
let brace = 0;
for (const [i, line] of lines.entries()) {
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    const prev = j > 0 ? line[j - 1] : '';
    if (inComment) {
      if (c === '/' && prev === '*') {
        inComment = false;
      }
      continue;
    }
    if (inSingle) {
      if (c === '\'' && prev !== '\\') {
        inSingle = false;
      }
      continue;
    }
    if (inDouble) {
      if (c === '"' && prev !== '\\') {
        inDouble = false;
      }
      continue;
    }
    if (inTemplate) {
      if (c === '`' && prev !== '\\') {
        inTemplate = false;
      }
      continue;
    }
    if (c === '/' && line[j + 1] === '*') {
      inComment = true;
      j++;
      continue;
    }
    if (c === '\'') {
      inSingle = true;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      continue;
    }
    if (c === '`') {
      inTemplate = true;
      continue;
    }
    if (c === '(') paren++;
    if (c === ')') paren--;
    if (c === '{') brace++;
    if (c === '}') brace--;
    if (paren < 0 || brace < 0) {
      console.log('negative at', i + 1, j + 1, c, 'paren', paren, 'brace', brace);
      process.exit(0);
    }
  }
  if (paren !== 0 || brace !== 0) {
    console.log('line', i + 1, 'counts', paren, brace);
  }
}
console.log('final', paren, brace);
