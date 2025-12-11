/*
 * ReSlides front-end script
 *
 * This file handles parsing a user-provided script, generating a complete
 * presentation in HTML using a predefined template, creating separate
 * HTML files for each graph slide, packaging them into a zip archive
 * and offering download links. It also updates the conversation history
 * on the page so the user can see their submission and the response.
 */

// Utility to create DOM elements with classes and text
function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

// Parse the raw script text into an array of slide objects
function parseScript(raw) {
  const slides = [];
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  let current = null;
  for (const line of lines) {
    if (/^Diapositiva\s+\d+/i.test(line)) {
      if (current) slides.push(current);
      current = { title: '', content: [], graph: null, description: '', attachments: [] };
    } else if (/^(Título|Titulo):/i.test(line)) {
      current.title = line.replace(/^(Título|Titulo):/i, '').trim();
    } else if (/^(Contenido|Contexto):/i.test(line)) {
      const parts = line.replace(/^(Contenido|Contexto):/i, '').trim().split(';').map(p => p.trim()).filter(Boolean);
      current.content.push(...parts);
    } else if (/^Datos:/i.test(line) || /^Gráfica:/i.test(line) || /^Grafica:/i.test(line)) {
      const rest = line.replace(/^Gráfica:|^Grafica:|^Datos:/i, '').trim();
      const sections = rest.split(';').map(s => s.trim());
      const graph = { labels: [], values: [] };
      sections.forEach(sec => {
        if (/^labels?/i.test(sec)) {
          const arr = sec.replace(/^labels?:/i, '').split(',').map(s => s.trim()).filter(Boolean);
          graph.labels = arr;
        } else if (/^(valores?|values?)/i.test(sec)) {
          const arr = sec.replace(/^(valores?|values?):/i, '').split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
          graph.values = arr;
        }
      });
      current.graph = graph;
    } else if (/^Descripción:/i.test(line) || /^Descripcion:/i.test(line)) {
      current.description = line.replace(/^(Descripción|Descripcion):/i, '').trim();
    } else if (/^Adjunto:/i.test(line)) {
      const attachments = line.replace(/^Adjunto:/i, '').split(',').map(s => s.trim()).filter(Boolean);
      current.attachments.push(...attachments);
    } else if (current) {
      const arr = line.split(';').map(s => s.trim()).filter(Boolean);
      current.content.push(...arr);
    }
  }
  if (current) slides.push(current);
  return slides;
}

// Generate HTML for a single graph page
function generateGraphPage(graph, graphIndex) {
  const { labels, values } = graph;
  const id = `graph-${graphIndex}`;
  return `<!DOCTYPE html><html lang='es'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Gráfica ${graphIndex}</title><script src='https://cdn.tailwindcss.com'></script><script src='https://cdn.plot.ly/plotly-latest.min.js'></script><style type='text/tailwindcss'>@layer utilities { .ppt-slide { @apply relative w-[992px] h-[558px] mx-auto p-[30px] box-border overflow-hidden mb-[40px] bg-[#FAFBFC]; } }</style></head><body class='bg-gray-50 py-8'><div class='ppt-slide flex flex-col justify-center'><div id='${id}' class='w-full h-full'></div></div><script>document.addEventListener('DOMContentLoaded', function () { const data = [{ x: ${JSON.stringify(labels)}, y: ${JSON.stringify(values)}, type: 'bar', marker: { color: '#1B365D' } }]; const layout = { title: 'Gráfica ${graphIndex}', margin: { t: 40, r: 20, b: 60, l: 40 }, yaxis: { title: 'Valor' } }; Plotly.newPlot('${id}', data, layout, { responsive: true }); });<\/script></body></html>`;
}

// Generate the presentation HTML string. Accepts slides array, array of graph filenames, a theme object and a fonts object
function generatePresentation(slides, graphFiles, theme, fonts) {
  let slideHtml = '';
  let graphCount = 0;
  const primary = theme.primary;
  const secondary = theme.secondary;
  const accent = theme.accent;
  // Helper to escape single quotes in content
  const esc = (str) => String(str).replace(/'/g, '&#39;');
  slides.forEach((slide, index) => {
    if (index === 0) {
      // Portada
      slideHtml += `\n<div class='ppt-slide flex flex-col justify-center' style='background: linear-gradient(135deg, ${primary} 0%, ${secondary} 100%);'>\n  <div class='w-full text-white'>\n    <h1 class='text-5xl md:text-6xl font-bold mb-6' style='font-family: ${fonts.heading};'>${esc(slide.title || 'Título de la presentación')}</h1>\n    <div class='w-24 h-1' style='background-color: ${accent};' class='mb-8'></div>\n    <p class='text-2xl mb-2' style='font-family: ${fonts.body};'>${esc(slide.content[0] || '')}</p>\n    <p class='text-xl opacity-90' style='font-family: ${fonts.body};'>${esc(slide.content[1] || '')}</p>\n    <p class='text-lg opacity-80 mt-4' style='font-family: ${fonts.body};'>${esc(slide.content[2] || '')}</p>\n  </div>\n</div>`;
    } else {
      // Non-portada slides
      slideHtml += `\n<div class='ppt-slide flex flex-col'>\n  <h2 class='text-4xl md:text-5xl font-bold mb-6' style='color: ${primary}; font-family: ${fonts.heading};'>${esc(slide.title)}</h2>`;
      if (slide.graph) {
        graphCount++;
        const graphFile = graphFiles[graphCount - 1];
        // Graph slide layout: left column description & content, right column preview container
        slideHtml += `\n  <div class='flex flex-1 gap-6'>\n    <div class='w-2/5 flex flex-col justify-center'>\n      <h3 class='text-2xl font-bold mb-3' style='color: ${primary}; font-family: ${fonts.heading};'>${esc(slide.description || '')}</h3>\n      ${slide.content.map(p => `<p class='text-base leading-relaxed mb-2' style='color: ${theme.text}; font-family: ${fonts.body};'>${esc(p)}</p>`).join('')}\n    </div>\n    <div class='w-3/5 relative'>\n      <div class='preview-container space-y-2' id='preview-container-${graphCount}'></div>\n      <button type='button' class='add-preview absolute top-2 right-2 text-white px-2 py-1 text-xs rounded' style='background-color: ${accent};'>Añadir vista previa</button>\n    </div>\n  </div>`;
        slideHtml += `\n  <input type='hidden' class='graph-file' value='${esc(graphFile)}' />`;
      } else {
        slide.content.forEach(p => {
          slideHtml += `\n  <p class='text-xl leading-relaxed mb-3' style='color: ${theme.text}; font-family: ${fonts.body};'>${esc(p)}</p>`;
        });
      }
      slideHtml += `\n</div>`;
    }
  });
  // Build final HTML document with preview functionality and dynamic theme variables
  const html = `<!DOCTYPE html><html lang='es'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Presentación generada</title><script src='https://cdn.tailwindcss.com'></script><link href='https://fonts.googleapis.com/css2?family=Coda&family=Oranienbaum&family=Sorts+Mill+Goudy&family=Unna&display=swap' rel='stylesheet'><link href='https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.0.0/css/all.min.css' rel='stylesheet'><script src='https://cdn.plot.ly/plotly-latest.min.js'></script><style type='text/tailwindcss'>@layer utilities {.ppt-slide { @apply relative w-[992px] h-[558px] mx-auto p-[30px] box-border overflow-hidden mb-[40px] bg-[#FAFBFC]; }}</style></head><body class='bg-gray-50 py-8'>${slideHtml}<script>(function(){ const slides=document.querySelectorAll('.ppt-slide'); slides.forEach((slide)=>{ const addBtn=slide.querySelector('.add-preview'); if(!addBtn) return; const container=slide.querySelector('.preview-container'); const graphInput=slide.querySelector('.graph-file'); if(!graphInput) return; const graphFile=graphInput.value; function createPreview(){ const wrapper=document.createElement('div'); wrapper.className='relative border rounded overflow-hidden shadow'; wrapper.draggable=true; const iframe=document.createElement('iframe'); iframe.src=graphFile; iframe.className='w-full h-40'; iframe.style.pointerEvents='none'; const removeBtn=document.createElement('button'); removeBtn.textContent='×'; removeBtn.className='absolute top-1 right-1 text-sm bg-red-600 text-white rounded px-1'; removeBtn.onclick=(e)=>{ e.stopPropagation(); wrapper.remove(); }; wrapper.appendChild(iframe); wrapper.appendChild(removeBtn); return wrapper; } // initial preview container.appendChild(createPreview()); // handle drag and drop let dragging=null; container.addEventListener('dragstart',(e)=>{ if(e.target.classList.contains('relative')){ dragging=e.target; e.dataTransfer.effectAllowed='move'; } }); container.addEventListener('dragover',(e)=>{ e.preventDefault(); const after=getDragAfterElement(container,e.clientY); if(!after) container.appendChild(dragging); else container.insertBefore(dragging, after); }); function getDragAfterElement(container,y){ const draggables=[...container.querySelectorAll('.relative:not(.dragging)')]; let closest=null; let closestOffset=-Infinity; draggables.forEach(child=>{ const box=child.getBoundingClientRect(); const offset=y - box.top - box.height / 2; if(offset<0 && offset>closestOffset){ closestOffset=offset; closest=child; } }); return closest; } addBtn.addEventListener('click',()=>{ container.appendChild(createPreview()); }); });})();<\/script></body></html>`;
  return html;
}

// Generate README markdown content (simple)
function generateReadme() {
  return [
    '# ReSlides',
    '',
    'Bienvenido a **ReSlides**, una aplicación web para convertir un guion simple en una presentación HTML profesional.',
    '',
    '## Instrucciones de uso',
    '',
    '1. Escribe tu guion siguiendo el formato de ejemplo en la página principal.',
    '2. Haz clic en **Enviar**. Se generará un archivo ZIP con:',
    '   - **presentacion.html**: tu presentación completa.',
    '   - **grafica*.html**: una página HTML por cada gráfica incluida.',
    '   - **readme.md**: este archivo.',
    '3. Descarga el ZIP y abre `presentacion.html` en tu navegador.',
    '',
    '## Personalización de vistas previas',
    '',
    'En las diapositivas con gráficas puedes:',
    '- Eliminar una vista previa haciendo clic en la × roja.',
    '- Añadir más vistas previas con el botón “Añadir vista previa”.',
    '- Reordenar las miniaturas arrastrándolas.',
    '',
    '## Despliegue en Vercel',
    '',
    'Puedes desplegar este proyecto como sitio estático en Vercel:',
    '1. Crea una cuenta en Vercel.',
    '2. Sube la carpeta **reslides_app** a un repositorio y enlázala con Vercel.',
    '3. Vercel detectará automáticamente que es un proyecto estático y lo desplegará.',
    '',
    '---',
    '',
    'Hecho con ❤ para ayudarte a crear presentaciones increíbles.'
  ].join('\n');
}

// Handle form submission
document.getElementById('chat-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const rawScript = document.getElementById('script-input').value.trim();
  const history = document.getElementById('history');
  if (!rawScript) return;
  // Add user message to history
  const userMsg = createElement('div', 'bg-gray-100 rounded-lg p-3 border');
  userMsg.innerHTML = `<p class='font-semibold mb-1'>Tú:</p><pre class='whitespace-pre-wrap text-sm'>${rawScript}</pre>`;
  history.appendChild(userMsg);
  // Parse script
  const slides = parseScript(rawScript);
  // Determine selected theme and fonts
  const themeValue = document.getElementById('theme-select') ? document.getElementById('theme-select').value : 'default';
  const fontValue = document.getElementById('font-select') ? document.getElementById('font-select').value : 'default';
  // Define themes (colores principales, secundarios, acento y texto)
  const themes = {
    default: { primary: '#1B365D', secondary: '#2C5F7F', accent: '#D4AF37', text: '#2D3748' },
    purpura: { primary: '#4B0082', secondary: '#6A0DAD', accent: '#D69E2E', text: '#2D3748' },
    verde: { primary: '#2F855A', secondary: '#38A169', accent: '#D69E2E', text: '#2D3748' }
  };
  const fontsMap = {
    default: { heading: 'Sorts Mill Goudy, serif', body: 'Oranienbaum, serif' },
    moderna: { heading: 'Arial, Helvetica, sans-serif', body: 'Arial, Helvetica, sans-serif' }
  };
  const theme = themes[themeValue] || themes.default;
  const fonts = fontsMap[fontValue] || fontsMap.default;
  // Generate graph files and collect HTML strings
  const graphFiles = [];
  const graphsHtml = [];
  slides.forEach((slide) => {
    if (slide.graph) {
      const index = graphFiles.length + 1;
      const fileName = `grafica${index}.html`;
      graphFiles.push(fileName);
      graphsHtml.push({ name: fileName, content: generateGraphPage(slide.graph, index) });
    }
  });
  // Generate presentation
  const presentationHtml = generatePresentation(slides, graphFiles, theme, fonts);
  // Generate readme
  const readmeContent = generateReadme();
  // Create zip
  const zip = new JSZip();
  zip.file('presentacion.html', presentationHtml);
  graphsHtml.forEach(g => zip.file(g.name, g.content));
  zip.file('readme.md', readmeContent);
  // Generate a Blob URL for the presentation so it can be viewed directly
  const presentationUrl = URL.createObjectURL(new Blob([presentationHtml], { type: 'text/html' }));
  // Generate archive blob but do not initiate download automatically
  const blob = await zip.generateAsync({ type: 'blob' });
  const zipName = 'reslides_presentacion.zip';
  const zipUrl = URL.createObjectURL(blob);

  // Generate PPTX file asynchronously using PptxGenJS if available
  let pptUrl = null;
  try {
    if (typeof PptxGenJS !== 'undefined' || typeof pptxgen !== 'undefined') {
      // Create a new PPTX presentation
      const pptx = new (typeof PptxGenJS !== 'undefined' ? PptxGenJS : pptxgen)();
      // Set 16x9 layout
      pptx.defineLayout({ name: '16x9', width: 10, height: 5.625 });
      pptx.layout = '16x9';
      // Helper to remove leading '#'
      const strip = (col) => col.replace('#', '');
      // Iterate slides to build PPT
      slides.forEach((slide) => {
        const sld = pptx.addSlide();
        // Cover slide
        if (slide === slides[0]) {
          // Background with primary color
          sld.background = { color: strip(theme.primary) };
          // Title text
          sld.addText(slide.title || 'Título de la presentación', {
            x: 0.5, y: 1.5, w: 9, h: 1.3,
            align: pptx.AlignH.center,
            fontSize: 32,
            color: 'FFFFFF',
            bold: true,
            fontFace: fonts.heading
          });
          // Subtitle lines (first three content elements)
          const lines = [];
          if (slide.content[0]) lines.push(slide.content[0]);
          if (slide.content[1]) lines.push(slide.content[1]);
          if (slide.content[2]) lines.push(slide.content[2]);
          if (lines.length > 0) {
            sld.addText(lines.join('\n'), {
              x: 1, y: 3, w: 8, h: 2,
              align: pptx.AlignH.center,
              fontSize: 16,
              color: strip(theme.accent),
              fontFace: fonts.body
            });
          }
        } else {
          // Normal slides
          sld.background = { color: 'FAFBFC' };
          // Title
          sld.addText(slide.title || '', {
            x: 0.5, y: 0.5, w: 9, h: 0.8,
            fontSize: 24,
            bold: true,
            color: strip(theme.primary),
            fontFace: fonts.heading
          });
          // If slide has graph
          if (slide.graph) {
            // Description and content on left side
            const yStart = 1.5;
            let textRuns = [];
            if (slide.description) {
              textRuns.push({ text: slide.description + '\n', options: { fontSize: 16, bold: true, color: strip(theme.primary), fontFace: fonts.heading } });
            }
            slide.content.forEach((p) => {
              textRuns.push({ text: '\u2022 ' + p + '\n', options: { fontSize: 14, color: strip(theme.text), fontFace: fonts.body } });
            });
            sld.addText(textRuns, { x: 0.5, y: yStart, w: 5.0, h: 3.0, margin: 0.1, wrap: true });
            // Chart on right side
            const dataChart = [ { name: slide.title || '', labels: slide.graph.labels, values: slide.graph.values } ];
            sld.addChart(pptx.ChartType.bar, dataChart, {
              x: 5.5, y: 1.5, w: 4.0, h: 3.0,
              barDir: 'col',
              chartColors: [ strip(theme.primary) ],
              catAxisLabelFontFace: fonts.body,
              catAxisLabelColor: strip(theme.primary),
              valAxisLabelColor: strip(theme.primary),
              valAxisLineColor: strip(theme.primary),
              catAxisLineColor: strip(theme.primary),
              valAxisMajorGridLine: { style: 'solid', color: 'DDDDDD' },
              showLegend: false
            });
          } else {
            // Only content bullet points
            const textRuns = [];
            slide.content.forEach((p) => {
              textRuns.push({ text: '\u2022 ' + p + '\n', options: { fontSize: 16, color: strip(theme.text), fontFace: fonts.body } });
            });
            sld.addText(textRuns, { x: 0.5, y: 1.5, w: 9.0, h: 4.0, wrap: true });
          }
        }
      });
      const pptBlob = await pptx.write('blob');
      pptUrl = URL.createObjectURL(pptBlob);
    }
  } catch (err) {
    console.error('Error generating PPT:', err);
  }
  // Add system response to history with view and download options
  const botMsg = createElement('div', 'bg-white rounded-lg p-3 border');
  botMsg.innerHTML =
    `<p class='font-semibold mb-1' style='color: ${theme.primary};'>ReSlides:</p>` +
    `<p class='text-sm'>Presentación generada con éxito. Puedes verla directamente, previsualizarla o descargarla para guardarla en tu equipo.</p>` +
    `<p class='mt-2'><a href='${presentationUrl}' target='_blank' class='text-blue-600 underline text-sm'>Abrir en nueva pestaña</a></p>` +
    `<p class='mt-1'><a href='${zipUrl}' download='${zipName}' class='text-blue-600 underline text-sm'>Descargar paquete ZIP</a></p>` +
    (pptUrl ? `<p class='mt-1'><a href='${pptUrl}' download='reslides_presentacion.pptx' class='text-blue-600 underline text-sm'>Descargar PPTX</a></p>` : '') +
    `<div class='mt-3'>\n      <p class='text-xs mb-1'>Vista previa:</p>\n      <iframe src='${presentationUrl}' class='w-full h-64 border rounded-md'></iframe>\n    </div>`;
  history.appendChild(botMsg);
  // Show files section and list file names
  const filesSection = document.getElementById('files');
  const list = document.getElementById('files-list');
  list.innerHTML = '';
  list.appendChild(createElement('li', '', 'presentacion.html'));
  graphsHtml.forEach(g => list.appendChild(createElement('li', '', g.name)));
  list.appendChild(createElement('li', '', 'readme.md'));
  filesSection.classList.remove('hidden');
  // Clear form
  document.getElementById('script-input').value = '';
});