const fs = require('fs');
const path = require('path');

// Las variables de entorno las toma Vercel automáticamente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Verificar que las variables existan
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERROR: Faltan variables de entorno SUPABASE_URL o SUPABASE_ANON_KEY');
  process.exit(1);
}

// Generar el contenido del archivo config.js
const configContent = `
// Archivo generado automáticamente en el build
window.SUPABASE_CONFIG = {
  url: '${supabaseUrl}',
  anonKey: '${supabaseAnonKey}'
};
`;

// Escribir el archivo en la carpeta js/
const outputPath = path.join(__dirname, 'js', 'config.js');

// Asegurar que la carpeta existe
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, configContent.trim());
console.log('✅ config.js generado correctamente en js/config.js');
