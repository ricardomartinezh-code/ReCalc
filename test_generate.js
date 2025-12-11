const fs = require('fs');

function parseScript(raw) {
  const slides = [];
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  let current = null;
  for (const line of lines) {
    if (/^Diapositiva\s+\d+/i.test(line)) {
      if (current) slides.push(current);
      current = { title: '', content: [], graph: null, description: '', attachments: [] };
    } else if (/^Título:/i.test(line)) {
      current.title = line.replace(/^Título:/i, '').trim();
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

function generateGraphPage(graph, graphIndex) {
  const { labels, values } = graph;
  const id = `graph-${graphIndex}`;
  return `<!DOCTYPE html><html lang='es'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Gráfica ${graphIndex}</title><script src='https://cdn.tailwindcss.com'></script><script src='https://cdn.plot.ly/plotly-latest.min.js'></script><style type='text/tailwindcss'>@layer utilities { .ppt-slide { @apply relative w-[992px] h-[558px] mx-auto p-[30px] box-border overflow-hidden mb-[40px] bg-[#FAFBFC]; } }</style></head><body class='bg-gray-50 py-8'><div class='ppt-slide flex flex-col justify-center'><div id='${id}' class='w-full h-full'></div></div><script>document.addEventListener('DOMContentLoaded', function () { const data = [{ x: ${JSON.stringify(labels)}, y: ${JSON.stringify(values)}, type: 'bar', marker: { color: '#1B365D' } }]; const layout = { title: 'Gráfica ${graphIndex}', margin: { t: 40, r: 20, b: 60, l: 40 }, yaxis: { title: 'Valor' } }; Plotly.newPlot('${id}', data, layout, { responsive: true }); });<\/script></body></html>`;
}

function generatePresentation(slides, graphFiles) {
  let slideHtml = '';
  let graphCount = 0;
  slides.forEach((slide, index) => {
    if (index === 0) {
      slideHtml += `\n<div class='ppt-slide flex flex-col justify-center' style='background: linear-gradient(135deg, #1B365D 0%, #2C5F7F 100%);'>\n  <div class='w-full text-white'>\n    <h1 class='text-5xl md:text-6xl font-bold mb-6' style='font-family: Sorts Mill Goudy, serif;'>${slide.title || 'Título de la presentación'}</h1>\n    <div class='w-24 h-1 bg-[#D4AF37] mb-8'></div>\n    <p class='text-2xl mb-2' style='font-family: Oranienbaum, serif;'>${slide.content[0] || ''}</p>\n    <p class='text-xl opacity-90' style='font-family: Oranienbaum, serif;'>${slide.content[1] || ''}</p>\n    <p class='text-lg opacity-80 mt-4' style='font-family: Oranienbaum, serif;'>${slide.content[2] || ''}</p>\n  </div>\n</div>`;
    } else {
      slideHtml += `\n<div class='ppt-slide flex flex-col'>\n  <h2 class='text-4xl md:text-5xl font-bold text-[#1B365D] mb-6' style='font-family: Sorts Mill Goudy, serif;'>${slide.title}</h2>`;
      if (slide.graph) {
        graphCount++;
        const graphFile = graphFiles[graphCount - 1];
        slideHtml += `\n  <div class='flex flex-1 gap-6'>\n    <div class='w-2/5 flex flex-col justify-center'>\n      <h3 class='text-2xl font-bold text-[#1B365D] mb-3'>${slide.description || ''}</h3>\n      ${slide.content.map(p => `<p class='text-base text-[#2D3748] leading-relaxed mb-2'>${p}</p>`).join('')}\n    </div>\n    <div class='w-3/5 relative'>\n      <div class='preview-container space-y-2' id='preview-container-${graphCount}'></div>\n      <button type='button' class='add-preview absolute top-2 right-2 bg-[#D4AF37] text-white px-2 py-1 text-xs rounded'>Añadir vista previa</button>\n    </div>\n  </div>`;
        slideHtml += `\n  <input type='hidden' class='graph-file' value='${graphFile}' />`;
      } else {
        slide.content.forEach(p => {
          slideHtml += `\n  <p class='text-xl text-[#2D3748] leading-relaxed mb-3'>${p}</p>`;
        });
      }
      slideHtml += `\n</div>`;
    }
  });
  const html = `<!DOCTYPE html><html lang='es'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Presentación generada</title><script src='https://cdn.tailwindcss.com'></script><link href='https://fonts.googleapis.com/css2?family=Coda&family=Oranienbaum&family=Sorts+Mill+Goudy&family=Unna&display=swap' rel='stylesheet'><link href='https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.0.0/css/all.min.css' rel='stylesheet'><script src='https://cdn.plot.ly/plotly-latest.min.js'></script><style type='text/tailwindcss'>@layer utilities {.ppt-slide { @apply relative w-[992px] h-[558px] mx-auto p-[30px] box-border overflow-hidden mb-[40px] bg-[#FAFBFC]; }}</style></head><body class='bg-gray-50 py-8'>${slideHtml}<script>(function(){ const slides=document.querySelectorAll('.ppt-slide'); slides.forEach((slide)=>{ const addBtn=slide.querySelector('.add-preview'); if(!addBtn) return; const container=slide.querySelector('.preview-container'); const graphInput=slide.querySelector('.graph-file'); if(!graphInput) return; const graphFile=graphInput.value; function createPreview(){ const wrapper=document.createElement('div'); wrapper.className='relative border rounded overflow-hidden shadow'; wrapper.draggable=true; const iframe=document.createElement('iframe'); iframe.src=graphFile; iframe.className='w-full h-40'; iframe.style.pointerEvents='none'; const removeBtn=document.createElement('button'); removeBtn.textContent='×'; removeBtn.className='absolute top-1 right-1 text-sm bg-red-600 text-white rounded px-1'; removeBtn.onclick=(e)=>{ e.stopPropagation(); wrapper.remove(); }; wrapper.appendChild(iframe); wrapper.appendChild(removeBtn); return wrapper; } container.appendChild(createPreview()); let dragging=null; container.addEventListener('dragstart',(e)=>{ if(e.target.classList.contains('relative')){ dragging=e.target; e.dataTransfer.effectAllowed='move'; } }); container.addEventListener('dragover',(e)=>{ e.preventDefault(); const after=getDragAfterElement(container,e.clientY); if(!after) container.appendChild(dragging); else container.insertBefore(dragging, after); }); function getDragAfterElement(container,y){ const draggables=[...container.querySelectorAll('.relative:not(.dragging)')]; let closest=null; let closestOffset=-Infinity; draggables.forEach(child=>{ const box=child.getBoundingClientRect(); const offset=y - box.top - box.height / 2; if(offset<0 && offset>closestOffset){ closestOffset=offset; closest=child; } }); return closest; } addBtn.addEventListener('click',()=>{ container.appendChild(createPreview()); }); });})();<\/script></body></html>`;
  return html;
}

// Example script string
const script = `Diapositiva 1\nTitulo: Presentacion de prueba\nContenido: Esto es la primera diapositiva; Tiene varios puntos de texto; Puede listar items\n\nDiapositiva 2\nTitulo: Frecuencia de uso\nDatos: Labels: Resumenes, Ideas, Redaccion; Valores: 4.2, 3.8, 2.5\nDescripcion: Frecuencia de uso por actividad\nContenido: La mayoria usa IA para resumir, generar ideas y redactar trabajos.`;

const slides = parseScript(script);
const graphFiles = [];
const graphsHtml = [];
slides.forEach(slide => {
  if (slide.graph) {
    const index = graphFiles.length + 1;
    const fileName = `grafica${index}.html`;
    graphFiles.push(fileName);
    graphsHtml.push({ name: fileName, content: generateGraphPage(slide.graph, index) });
  }
});
const presentation = generatePresentation(slides, graphFiles);
fs.writeFileSync('presentacion_test.html', presentation);
graphsHtml.forEach(g => fs.writeFileSync(g.name, g.content));
console.log('generated files');