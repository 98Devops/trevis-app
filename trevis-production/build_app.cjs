const fs = require('fs');
const path = require('path');

const partsDir = path.join(__dirname, 'src', 'parts');
const files = [
  'p1_imports_context.jsx',
  'p2_helpers.jsx',
  'p3_modals.jsx',
  'p4_dashboard.jsx',
  'p5_views.jsx',
  'p6_reports.jsx',
  'p7_arrears.jsx',
  'p8_calendar.jsx',
  'p9_settings.jsx',
];

// Function to fix all relative paths in a line
function fixPaths(line) {
  let fixed = line
    .replace(/"\.\.\/lib\//g, '"./lib/')
    .replace(/"\.\.\/services\//g, '"./services/')
    .replace(/"\.\.\/components\//g, '"./components/')
    .replace(/"\.\.\/utils\//g, '"./utils/')
    .replace(/'\.\.\/lib\//g, "'./lib/")
    .replace(/'\.\.\/services\//g, "'./services/")
    .replace(/'\.\.\/components\//g, "'./components/")
    .replace(/'\.\.\/utils\//g, "'./utils/");
  
  // Handle dynamic imports to part files - replace with direct access since functions are now in same scope
  if (fixed.includes("await import('./p1_imports_context.jsx')")) {
    // Replace the dynamic import with direct object access
    // This works because all functions from parts are now in the same file scope
    fixed = fixed.replace(/await import\(['"]\.\/p1_imports_context\.jsx['"]\)/g, '({})');
  }
  
  return fixed;
}

// Store imports grouped by module path
// Structure: Map<modulePath, { named: Set<string>, default: string|null }>
const importsByModule = new Map();
const allCode = [];

for (const f of files) {
  const content = fs.readFileSync(path.join(partsDir, f), 'utf8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Match import statements: import { ... } from "module" or import X from "module"
    const importMatch = trimmed.match(/^import\s+(.+)\s+from\s+["'](.+)["'];?$/);
    
    if (importMatch) {
      const importSpec = importMatch[1].trim();
      let modulePath = importMatch[2];
      
      // Skip imports from part files (they're being combined)
      if (modulePath.startsWith('./p') && modulePath.includes('.jsx')) {
        continue; // Skip this import
      }
      
      // Fix relative paths for App.jsx
      modulePath = fixPaths(`"${modulePath}"`).slice(1, -1); // Remove quotes added by fixPaths
      
      if (!importsByModule.has(modulePath)) {
        importsByModule.set(modulePath, { named: new Set(), default: null });
      }
      
      const moduleImports = importsByModule.get(modulePath);
      
      // Extract named imports from { ... }
      if (importSpec.startsWith('{') && importSpec.endsWith('}')) {
        const namedImports = importSpec
          .slice(1, -1)
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        
        namedImports.forEach(imp => moduleImports.named.add(imp));
      } else {
        // Default import (e.g., "import InlineEditField from ...")
        // Store the default import name
        moduleImports.default = importSpec;
      }
    } else {
      // Not an import - fix paths and keep
      // But skip export statements that reference part files
      if (trimmed.includes('from "./p') && trimmed.includes('.jsx"')) {
        continue; // Skip exports from part files
      }
      
      allCode.push(fixPaths(line));
    }
  }
}

// Build merged imports
const mergedImports = [];
for (const [modulePath, imports] of importsByModule.entries()) {
  const { named, default: defaultImport } = imports;
  
  // Build import statement parts
  const parts = [];
  
  // Add default import if present
  if (defaultImport) {
    parts.push(defaultImport);
  }
  
  // Add named imports if present
  if (named.size > 0) {
    const namedList = Array.from(named).sort();
    parts.push(`{ ${namedList.join(', ')} }`);
  }
  
  // Create import statement
  if (parts.length > 0) {
    mergedImports.push(`import ${parts.join(', ')} from "${modulePath}";`);
  }
}

// Build final file
const combined = mergedImports.join('\n') + '\n\n' + allCode.join('\n');

fs.writeFileSync(path.join(__dirname, 'src', 'App.jsx'), combined, 'utf8');
console.log('Built App.jsx successfully!');
console.log('Size:', combined.length, 'bytes');
console.log('Modules imported:', importsByModule.size);
const totalImports = Array.from(importsByModule.values()).reduce((sum, imp) => {
  return sum + imp.named.size + (imp.default ? 1 : 0);
}, 0);
console.log('Total unique imports:', totalImports);