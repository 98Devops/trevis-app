const fs = require('fs');
const path = require('path');

const partsDir = path.join(__dirname, 'src', 'parts');
const files = [
  'p1_imports_context.js',
  'p2_helpers.js',
  'p3_modals.js',
  'p4_dashboard.js',
  'p5_views.js',
  'p6_reports_shell.js',
];

let combined = '';
for (const f of files) {
  const content = fs.readFileSync(path.join(partsDir, f), 'utf8');
  combined += content + '\n';
}

fs.writeFileSync(path.join(__dirname, 'src', 'App.jsx'), combined, 'utf8');
console.log('Built App.jsx successfully! Size:', combined.length, 'bytes');
