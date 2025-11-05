function formatea(valor){return valor.toLocaleString("es-CO",{style:'currency',currency:'COP',maximumFractionDigits:0});}
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
// Toggle mostrar/ocultar Bauche Detallado (solo visible si hay contenido)
const baucheSwitch = document.getElementById('switchBauche');
function syncBaucheVisibility(){
  const boleta = document.getElementById('boletaResumen');
  const detalle = document.getElementById('detalleBoleta');
  const hasContent = detalle && detalle.innerHTML.trim().length > 0;
  const show = baucheSwitch ? baucheSwitch.checked : true;
  boleta.classList.toggle('hidden', !(show && hasContent));
}
if (baucheSwitch){
  baucheSwitch.addEventListener('change', syncBaucheVisibility);
}

document.getElementById('formNomina').addEventListener('submit',function(e){
  e.preventDefault();
  let salario=Number(document.getElementById('salario').value);
  let bono1=Number(document.getElementById('bono1').value);
  let bono2=Number(document.getElementById('bono2').value);
  let seguro=Number(document.getElementById('seguro').value);
  let diasSalario=Number(!document.getElementById('diasSalario').classList.contains('hidden')?document.getElementById('diasSalario').value:30);
  let diasBono1=Number(!document.getElementById('diasBono1').classList.contains('hidden')?document.getElementById('diasBono1').value:30);
  let diasBono2=Number(!document.getElementById('diasBono2').classList.contains('hidden')?document.getElementById('diasBono2').value:30);
  let salarioProp=salario/30*diasSalario;
  let bono1Prop=bono1/30*diasBono1;
  let bono2Prop=bono2/30*diasBono2;
  let totalIngresos=salarioProp+bono1Prop+bono2Prop;
  let salud=salarioProp*0.04;
  let pension=salarioProp*0.04;
  salarioProp=Math.round(salarioProp);
  bono1Prop=Math.round(bono1Prop);
  bono2Prop=Math.round(bono2Prop);
  salud=Math.round(salud);
  pension=Math.round(pension);
  let totalDeducciones=salud+pension+seguro;
  let neto=Math.round(totalIngresos-totalDeducciones);

  document.getElementById('results').innerHTML=
    `<div class="result-card"><span class="result-label">Salario:</span><span class="value">${formatea(salarioProp)}</span><span class="float-right fr-blue">${diasSalario} días</span></div>
     <div class="result-card"><span class="result-label">Extralegal:</span><span class="value">${formatea(bono1Prop)}</span><span class="float-right fr-blue">${diasBono1} días</span></div>
     <div class="result-card"><span class="result-label">Alimentación:</span><span class="value">${formatea(bono2Prop)}</span><span class="float-right fr-blue">${diasBono2} días</span></div>
     <div class="result-card metric"><span class="result-label">TOTAL INGRESOS:</span><span class="value">${formatea(totalIngresos)}</span></div>
     <div class="deductions">
       <div class="result-card"><span class="result-label">Salud (4%):</span><span class="value">${formatea(salud)}</span></div>
       <div class="result-card"><span class="result-label">Pensión (4%):</span><span class="value">${formatea(pension)}</span></div>
       <div class="result-card"><span class="result-label">Seguro olivos:</span><span class="value">${formatea(seguro)}</span></div>
     </div>
     <div class="result-card deduction-total"><span class="label">TOTAL DEDUCCIONES</span><span class="amount">${formatea(totalDeducciones)}</span></div>
     <div class="result-card neto"><span class="result-label">NETO a recibir:</span><span class="value">${formatea(neto)}</span></div>`;

  document.getElementById('boletaFecha').innerText="Fecha de cálculo: "+fechaActual();

  let detalleHTML=`
    <div class="boleta-table">
    <table>
      <tr><th class="text-left">INGRESOS</th><th class="text-right">Valor</th></tr>
      <tr><td class="text-left">Salario (${diasSalario} días)</td><td class="text-right">${formatea(salarioProp)}</td></tr>
      <tr><td class="text-left">Extralegal (${diasBono1} días)</td><td class="text-right">${formatea(bono1Prop)}</td></tr>
      <tr><td class="text-left">Alimentación (${diasBono2} días)</td><td class="text-right">${formatea(bono2Prop)}</td></tr>
      <tr><th class="text-left">TOTAL INGRESOS</th><th class="text-right">${formatea(totalIngresos)}</th></tr>
  <tr><th class="text-left" style="padding-top:10px;">DEDUCCIONES</th><th></th></tr>
  <tr class="deduction"><td class="text-left">Salud (4%)</td><td class="text-right">${formatea(salud)}</td></tr>
  <tr class="deduction"><td class="text-left">Pensión (4%)</td><td class="text-right">${formatea(pension)}</td></tr>
  <tr class="deduction"><td class="text-left">Seguro olivos</td><td class="text-right">${formatea(seguro)}</td></tr>
  <tr class="deduction-total"><th class="text-left small-label">TOTAL DEDUCCIONES</th><th class="text-right total-amount">${formatea(totalDeducciones)}</th></tr>
      <tr><th class="text-left">NETO A PAGAR</th><th class="text-right"><span class="neto-badge">${formatea(neto)}</span></th></tr>
    </table>
    </div>`;

  // Mobile-friendly list mirroring the top cards (shown only on small screens via CSS)
  let detalleMobileHTML = `
    <div class="mobile-list">
      <div class="section-title">INGRESOS</div>
      <div class="result-card"><span class="result-label">Salario:</span><span class="value">${formatea(salarioProp)}</span><span class="float-right fr-blue">${diasSalario} días</span></div>
      <div class="result-card"><span class="result-label">Extralegal:</span><span class="value">${formatea(bono1Prop)}</span><span class="float-right fr-blue">${diasBono1} días</span></div>
      <div class="result-card"><span class="result-label">Alimentación:</span><span class="value">${formatea(bono2Prop)}</span><span class="float-right fr-blue">${diasBono2} días</span></div>
      <div class="result-card metric"><span class="result-label">TOTAL INGRESOS:</span><span class="value">${formatea(totalIngresos)}</span></div>
      <div class="section-title" style="margin-top:8px">DEDUCCIONES</div>
      <div class="result-card"><span class="result-label">Salud (4%):</span><span class="value">${formatea(salud)}</span></div>
      <div class="result-card"><span class="result-label">Pensión (4%):</span><span class="value">${formatea(pension)}</span></div>
      <div class="result-card"><span class="result-label">Seguro olivos:</span><span class="value">${formatea(seguro)}</span></div>
      <div class="result-card deduction-total"><span class="label">TOTAL DEDUCCIONES</span><span class="amount">${formatea(totalDeducciones)}</span></div>
      <div class="result-card neto"><span class="result-label">NETO A PAGAR:</span><span class="value">${formatea(neto)}</span></div>
    </div>`;
  document.getElementById('detalleBoleta').innerHTML=detalleHTML + detalleMobileHTML;
  // Mostrar la boleta sólo si el usuario lo desea y ya hay contenido
  syncBaucheVisibility();
  document.getElementById('btnPDF').classList.remove('hidden');
  // No pedir ni mostrar firma (se removió por requerimiento)
  document.getElementById('firmaBoleta').innerHTML='';

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
      doc.setFont("helvetica","bold"); doc.setTextColor(43,223,126);
      row("TOTAL INGRESOS",formatea(totalIngresos));
      doc.setFont("helvetica","normal"); doc.setTextColor(113,98,194);
      row("Salud (4%)",formatea(salud));
      row("Pensión (4%)",formatea(pension));
      row("Seguro olivos",formatea(seguro));
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