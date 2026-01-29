const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function extractFieldsFromPdf(pdfPath) {
  console.log(`📄 Procesando: ${path.basename(pdfPath)}`);
  
  try {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    console.log(`   Encontrados ${fields.length} campos en total`);
    
    const results = {};
    let processedCount = 0;
    
    fields.forEach((field, index) => {
      try {
        const fieldName = field.getName();
        
        if (!fieldName || fieldName.trim() === '') {
          console.log(`   ⚠️ Campo ${index + 1}: SIN NOMBRE, omitiendo`);
          return;
        }
        
        console.log(`   ✓ Campo ${index + 1}: "${fieldName}"`);
        
        if (!results[fieldName]) {
          results[fieldName] = [];
        }
        
        // Determinar tipo de campo
        const fieldType = field.constructor.name;
        let typeSymbol = '/Tx'; // Por defecto texto
        
        if (fieldType === 'PDFCheckBox') {
          typeSymbol = '/Btn';
        } else if (fieldType === 'PDFDropdown') {
          typeSymbol = '/Ch';
        } else if (fieldType === 'PDFOptionList') {
          typeSymbol = '/Ch';
        }
        
        // Obtener widget y coordenadas
        const widgets = field.acroField.getWidgets();
        if (widgets.length === 0) {
          console.log(`   ⚠️ "${fieldName}": Sin widgets, omitiendo`);
          return;
        }
        
        const widget = widgets[0];
        const rect = widget.getRectangle();
        
        // Intentar determinar la página (aproximado)
        let pageNum = 1;
        try {
          // Esta es una aproximación - pdf-lib no expone fácilmente el número de página
          // Podríamos intentar buscarlo en el contexto
          const ref = widget.dict.get(PDFName.of('P'));
          if (ref) {
            // Esto es complejo, por ahora usamos 1
            pageNum = 1;
          }
        } catch (e) {
          // Si falla, usamos 1
          pageNum = 1;
        }
        
        // Obtener valor actual
        let currentValue = null;
        try {
          if (fieldType === 'PDFTextField') {
            currentValue = field.getText();
          } else if (fieldType === 'PDFCheckBox') {
            currentValue = field.isChecked();
          }
        } catch (e) {
          currentValue = null;
        }
        
        const entry = {
          occurrence: results[fieldName].length + 1,
          page: pageNum,
          field_type: typeSymbol,
          value: currentValue,
          rect_pt: [
            Math.round(rect.x * 100) / 100,
            Math.round(rect.y * 100) / 100,
            Math.round((rect.x + rect.width) * 100) / 100,
            Math.round((rect.y + rect.height) * 100) / 100
          ],
          x_pt: Math.round(rect.x * 100) / 100,
          y_pt: Math.round(rect.y * 100) / 100,
          w_pt: Math.round(rect.width * 100) / 100,
          h_pt: Math.round(rect.height * 100) / 100,
          x_mm: Math.round(rect.x * 0.352777778 * 100) / 100,
          y_mm: Math.round(rect.y * 0.352777778 * 100) / 100,
          w_mm: Math.round(rect.width * 0.352777778 * 100) / 100,
          h_mm: Math.round(rect.height * 0.352777778 * 100) / 100
        };
        
        results[fieldName].push(entry);
        processedCount++;
        
      } catch (fieldError) {
        console.log(`   ❌ Error procesando campo ${index + 1}:`, fieldError.message);
      }
    });
    
    console.log(`   ✅ Procesados ${processedCount} campos exitosamente`);
    return results;
    
  } catch (error) {
    console.error(`   ❌ Error cargando PDF:`, error.message);
    return {};
  }
}

async function main() {
  console.log('🔍 ============================================');
  console.log('🔍 EXTRACCIÓN DE CAMPOS DE FORMULARIOS PDF');
  console.log('🔍 ============================================\n');
  
  // Rutas a los PDFs - MODIFICA ESTAS RUTAS SI ES NECESARIO
  const projectRoot = process.cwd();
  console.log(`📁 Directorio actual: ${projectRoot}`);
  
const templatesDir = path.join(__dirname, 'templates');
const mappingsDir = path.join(__dirname, 'mappings');

  console.log(`📁 Carpeta templates: ${templatesDir}`);
  console.log(`📁 Carpeta mappings: ${mappingsDir}`);
  
  // Verificar que existen las carpetas
  if (!fs.existsSync(templatesDir)) {
    console.error(`❌ NO EXISTE la carpeta: ${templatesDir}`);
    console.log('💡 Crea la carpeta y pon tus PDFs allí:');
    console.log('   FRENTE-CX.pdf');
    console.log('   DORSO-CX.pdf');
    return;
  }
  
  // Crear carpeta mappings si no existe
  if (!fs.existsSync(mappingsDir)) {
    fs.mkdirSync(mappingsDir, { recursive: true });
    console.log(`📁 Creada carpeta: ${mappingsDir}`);
  }
  
  // Buscar archivos PDF
  const pdfFiles = fs.readdirSync(templatesDir)
    .filter(file => file.toLowerCase().endsWith('.pdf'));
  
  if (pdfFiles.length === 0) {
    console.error(`❌ NO hay archivos PDF en: ${templatesDir}`);
    console.log('💡 Asegúrate de tener:');
    console.log('   - FRENTE-CX.pdf');
    console.log('   - DORSO-CX.pdf');
    console.log('   en la carpeta templates/');
    return;
  }
  
  console.log(`\n📄 Archivos PDF encontrados: ${pdfFiles.length}`);
  pdfFiles.forEach(file => console.log(`   - ${file}`));
  
  let allFields = {};
  
  // Procesar cada PDF
  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(templatesDir, pdfFile);
    console.log(`\n🔍 Procesando: ${pdfFile}`);
    
    const fields = await extractFieldsFromPdf(pdfPath);
    
    // Combinar resultados
    Object.keys(fields).forEach(fieldName => {
      if (!allFields[fieldName]) {
        allFields[fieldName] = [];
      }
      
      // Marcar de qué PDF viene cada campo
      const markedFields = fields[fieldName].map(field => ({
        ...field,
        source_pdf: pdfFile
      }));
      
      allFields[fieldName] = [...allFields[fieldName], ...markedFields];
    });
  }
  
  // Ordenar alfabéticamente
  const sortedFields = {};
  Object.keys(allFields).sort().forEach(key => {
    sortedFields[key] = allFields[key];
  });
  
  // Guardar el mapping
  const outputPath = path.join(mappingsDir, 'cd-campos_fields_rects.json');
  fs.writeFileSync(outputPath, JSON.stringify(sortedFields, null, 2));
  
  console.log('\n✅ ============================================');
  console.log('✅ MAPPING GENERADO EXITOSAMENTE!');
  console.log('✅ ============================================');
  console.log(`📁 Guardado en: ${outputPath}`);
  
  // Estadísticas
  const totalFields = Object.keys(sortedFields).length;
  const totalOccurrences = Object.values(sortedFields).reduce((sum, arr) => sum + arr.length, 0);
  
  console.log('\n📊 ESTADÍSTICAS:');
  console.log(`- Campos únicos: ${totalFields}`);
  console.log(`- Ocurrencias totales: ${totalOccurrences}`);
  
  // Mostrar los primeros 10 campos como ejemplo
  console.log('\n🔍 PRIMEROS 10 CAMPOS ENCONTRADOS:');
  const sampleKeys = Object.keys(sortedFields).slice(0, 10);
  sampleKeys.forEach((key, i) => {
    const occurrences = sortedFields[key].length;
    const types = [...new Set(sortedFields[key].map(f => f.field_type))].join(', ');
    console.log(`  ${i + 1}. ${key} (${occurrences}x, tipos: ${types})`);
  });
  
  // Verificar campos importantes
  console.log('\n🔍 BUSCANDO CAMPOS ESPECÍFICOS:');
  const importantFields = [
    'nacimiento-paciente',
    'nacmiento-paciente', 
    'domicilio-paciente',
    'hc-paciente',
    'nombre-paciente',
    'apellido-paciente',
    'dni-paciente',
    'cx',
    'art',
    'nombre-dr'
  ];
  
  importantFields.forEach(fieldName => {
    const variations = Object.keys(sortedFields).filter(key => 
      key.toLowerCase().includes(fieldName.toLowerCase().replace('-', ''))
    );
    
    if (variations.length > 0) {
      console.log(`  ✓ "${fieldName}": ENCONTRADO como: ${variations.join(', ')}`);
    } else {
      console.log(`  ✗ "${fieldName}": NO ENCONTRADO en el PDF`);
    }
  });
  
  console.log('\n💡 LISTO! Ahora puedes usar el mapping actualizado en tu formulario.');
}

// Ejecutar el script
main().catch(error => {
  console.error('❌ ERROR CRÍTICO:', error);
  process.exit(1);
});