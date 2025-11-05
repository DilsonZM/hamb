function formatea(valor){return valor.toLocaleString("es-CO",{style:'currency',currency:'COP',maximumFractionDigits:0});}
// Theme segmented control (Claro/Oscuro)
const themeBtns = document.querySelectorAll('.theme-switch .segmented-btn');
function setTheme(theme){
  document.body.classList.toggle('theme-dark', theme==='dark');
  themeBtns.forEach(b=>{
    const active = b.dataset.theme===theme;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active? 'true':'false');
  });
  try{ localStorage.setItem('theme', theme); }catch(e){}
}
themeBtns.forEach(btn=>btn.addEventListener('click',()=>setTheme(btn.dataset.theme)));
try{ const saved=localStorage.getItem('theme'); if(saved){ setTheme(saved);} }catch(e){}

// Switch menos de 30 días
document.getElementById('switchMenos30').addEventListener('change',function(){
  let visible=this.checked;
  document.querySelectorAll('.diasmini').forEach(el=>{ el.classList.toggle('hidden', !visible); });
  document.getElementById('colDias').classList.toggle('hidden', !visible);
  if(!visible){
    document.getElementById('diasSalario').value=30;
    document.getElementById('diasBono1').value=30;
    document.getElementById('diasBono2').value=30;
  }
});
function fechaActual(){
  const f = new Date();
  return `${f.getDate().toString().padStart(2,'0')}/${(f.getMonth()+1).toString().padStart(2,'0')}/${f.getFullYear()}`;
}
// Se removió el Bauche Detallado del DOM; mantenemos solo los resultados y PDF

// Persist inputs in localStorage
const fields = ['salario','bono1','bono2','novedades','seguro','seguroEnabled','diasSalario','diasBono1','diasBono2'];
function saveState(){
  const data = {};
  fields.forEach(id=>{ 
    const el=document.getElementById(id);
    if(!el) return;
    if(el.type==='checkbox'){ data[id]=el.checked? '1':'0'; }
    else { data[id]=el.value; }
  });
  data.menos30 = document.getElementById('switchMenos30').checked ? '1':'0';
  try{ localStorage.setItem('nominaState', JSON.stringify(data)); }catch(e){}
}
function loadState(){
  try{
    const raw = localStorage.getItem('nominaState');
    if(!raw) return;
    const data = JSON.parse(raw);
    fields.forEach(id=>{ 
      const el=document.getElementById(id);
      if(!el || data[id]===undefined) return;
      if(el.type==='checkbox'){ el.checked = data[id]==='1'; }
      else { el.value = data[id]; }
    });
    if(data.menos30!==undefined){
      const sw=document.getElementById('switchMenos30');
      sw.checked = data.menos30==='1';
      sw.dispatchEvent(new Event('change'));
    }
    // Ensure seguro input reflects toggle
    const en = document.getElementById('seguroEnabled');
    const seg = document.getElementById('seguro');
    if(en && seg){ seg.disabled = !en.checked; if(!en.checked) seg.value = seg.value||0; }
  }catch(e){}
}
window.addEventListener('DOMContentLoaded',loadState);
document.querySelectorAll('input').forEach(i=>i.addEventListener('input',saveState));

// Seguro optional toggle
const seguroEnabled = document.getElementById('seguroEnabled');
if(seguroEnabled){
  const segInput = document.getElementById('seguro');
  const syncSeguro = ()=>{
    segInput.disabled = !seguroEnabled.checked;
    if(!seguroEnabled.checked){ segInput.value = 0; }
    saveState();
  };
  seguroEnabled.addEventListener('change', syncSeguro);
}

// Theme toggle button
const themeToggle = document.getElementById('themeToggle');
function setTheme(theme){
  document.body.classList.toggle('theme-dark', theme==='dark');
  try{ localStorage.setItem('theme', theme);}catch(e){}
}
function initTheme(){
  let theme='light';
  try{ theme = localStorage.getItem('theme')||'light'; }catch(e){}
  setTheme(theme);
}
initTheme();
if(themeToggle){
  themeToggle.addEventListener('click',()=>{
    const next = document.body.classList.contains('theme-dark')? 'light':'dark';
    setTheme(next);
  });
}

document.getElementById('formNomina').addEventListener('submit',function(e){
  e.preventDefault();
  let salario=Number(document.getElementById('salario').value||0);
  let bono1=Number(document.getElementById('bono1').value||0);
  let bono2=Number(document.getElementById('bono2').value||0);
  let novedades=Number(document.getElementById('novedades').value||0);
  const seguroToggle = document.getElementById('seguroEnabled');
  let seguro=Number(document.getElementById('seguro').value||0);
  if(!(seguroToggle && seguroToggle.checked)){
    seguro = 0; // ignore when not enabled
  }
  let diasSalario=Number(!document.getElementById('diasSalario').classList.contains('hidden')?document.getElementById('diasSalario').value:30);
  let diasBono1=Number(!document.getElementById('diasBono1').classList.contains('hidden')?document.getElementById('diasBono1').value:30);
  let diasBono2=Number(!document.getElementById('diasBono2').classList.contains('hidden')?document.getElementById('diasBono2').value:30);
  let salarioProp=salario/30*diasSalario;
  let bono1Prop=bono1/30*diasBono1;
  let bono2Prop=bono2/30*diasBono2;
  let totalIngresos=salarioProp+bono1Prop+bono2Prop+novedades;
  let salud=salarioProp*0.04;
  let pension=salarioProp*0.04;
  salarioProp=Math.round(salarioProp);
  bono1Prop=Math.round(bono1Prop);
  bono2Prop=Math.round(bono2Prop);
  salud=Math.round(salud);
  pension=Math.round(pension);
  let totalDeducciones=salud+pension+seguro;
  let neto=Math.round(totalIngresos-totalDeducciones);

  // Build incomes list with optional novedades
  let ingresosHtml = `
     <div class="section-heading">INGRESOS</div>
     <div class="incomes-wrap">
       <div class="result-card"><span class="result-label">💼 Salario:</span><span class="value">${formatea(salarioProp)}</span><span class="float-right fr-blue">${diasSalario} días</span></div>
       <div class="result-card"><span class="result-label">🎁 Extralegal:</span><span class="value">${formatea(bono1Prop)}</span><span class="float-right fr-blue">${diasBono1} días</span></div>
       <div class="result-card"><span class="result-label">🍽️ Alimentación:</span><span class="value">${formatea(bono2Prop)}</span><span class="float-right fr-blue">${diasBono2} días</span></div>`;
  if(novedades>0){ ingresosHtml += `<div class="result-card"><span class="result-label">🧾 Novedades:</span><span class="value">${formatea(novedades)}</span></div>`; }
  ingresosHtml += `<div class="result-card metric"><span class="result-label">TOTAL INGRESOS:</span><span class="value">${formatea(totalIngresos)}</span></div></div>`;

  // Build deductions list with optional seguro
  let dedHtml = `
     <div class="section-heading">DEDUCCIONES</div>
     <div class="deductions-wrap">
       <div class="result-card"><span class="result-label">🏥 Salud (4%):</span><span class="value">${formatea(salud)}</span></div>
       <div class="result-card"><span class="result-label">🏦 Pensión (4%):</span><span class="value">${formatea(pension)}</span></div>`;
  if(seguro>0){ dedHtml += `<div class="result-card"><span class="result-label">🛡️ Seguro olivos:</span><span class="value">${formatea(seguro)}</span></div>`; }
  dedHtml += `</div>`;

  document.getElementById('results').innerHTML= ingresosHtml + dedHtml + `
     <div class="result-card deduction-total"><span class="label">TOTAL DEDUCCIONES</span><span class="amount">${formatea(totalDeducciones)}</span></div>
     <div class="result-card neto"><span class="result-label">NETO a recibir:</span><span class="value">${formatea(neto)}</span></div>`;

  // Mostrar botón de PDF (la boleta detallada fue removida de la UI)
  document.getElementById('btnPDF').classList.remove('hidden');

  document.getElementById('btnPDF').onclick=function(){
    const {jsPDF}=window.jspdf;
    let doc=new jsPDF();

    // Helper to draw the rest of the PDF starting from y
    function drawRest(yStart){
      let y=yStart;
      doc.setTextColor(80,80,80);
      doc.setFontSize(11);
      doc.text("Fecha de cálculo: "+fechaActual(),18,y-11);
      doc.setFont("helvetica","normal");
      doc.setTextColor(60,151,151);
      doc.text("Bauche Nómina Detallado",18,y-4);
      doc.setTextColor(35,35,35);
      y+=6;
      function row(label,value){ doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.text(label,18,y); doc.text(value,138,y,{align:'right'}); y+=7; }
      row("Salario ("+diasSalario+" días)",formatea(salarioProp));
  row("Extralegal ("+diasBono1+" días)",formatea(bono1Prop));
  row("Alimentación ("+diasBono2+" días)",formatea(bono2Prop));
  if(novedades>0){ row("Novedades", formatea(novedades)); }
      doc.setFont("helvetica","bold"); doc.setTextColor(43,223,126);
      row("TOTAL INGRESOS",formatea(totalIngresos));
      doc.setFont("helvetica","normal"); doc.setTextColor(113,98,194);
      row("Salud (4%)",formatea(salud));
      row("Pensión (4%)",formatea(pension));
  if(seguro>0){ row("Seguro olivos",formatea(seguro)); }
      doc.setFont("helvetica","bold"); doc.setTextColor(113,98,194);
      row("TOTAL DEDUCCIONES",formatea(totalDeducciones));
      doc.setFontSize(12); doc.setTextColor(35,150,58);
      row("NETO A PAGAR",formatea(neto));
      doc.save('bauche_nomina.pdf');
    }

    // El logo fue removido del PDF por requerimiento; dibujamos solo el contenido.
    drawRest(44);
  };
});