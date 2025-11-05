const MS_PER_DAY = 86400000;
const HOURS_PER_MONTH = 240;
const currencyFormatter = new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0});
const EXTRA_TYPES = [
  {id:'extraDiurnaHoras',label:'Hora extra diurna',shortLabel:'Hora extra diurna',multiplier:1.25,mode:'overtime'},
  {id:'extraNocturnaHoras',label:'Hora extra nocturna',shortLabel:'Hora extra nocturna',multiplier:1.75,mode:'overtime'},
  {id:'extraDominicalDiurnaHoras',label:'Hora extra dominical diurna',shortLabel:'Extra dominical diurna',multiplier:2.0,mode:'overtime'},
  {id:'extraDominicalNocturnaHoras',label:'Hora extra dominical nocturna',shortLabel:'Extra dominical nocturna',multiplier:2.5,mode:'overtime'},
  {id:'recargoNocturnoHoras',label:'Recargo nocturno',shortLabel:'Recargo nocturno',multiplier:0.35,mode:'surcharge'},
  {id:'recargoDominicalDiurnoHoras',label:'Recargo dominical diurno',shortLabel:'Recargo dominical',multiplier:0.75,mode:'surcharge'},
  {id:'recargoDominicalNocturnoHoras',label:'Recargo dominical nocturno',shortLabel:'Recargo dominical noct.',multiplier:1.10,mode:'surcharge'}
];
const ADVANCED_STATE_KEY='nominaAdvancedVisible';
let advancedConfigOpen=false;
let advancedHasPreference=false;
const fields = ['periodoNomina','salario','bono1','bono2','novedades','seguro','diasSalario','diasBono1','diasBono2','vacacionesEnabled','vacacionesRango','vacacionesDias','vacacionesMontoManualEnabled','vacacionesMontoManual','incapacidadEnabled','incapacidadTipo','incapacidadRango','incapacidadDias','incapacidadMontoManualEnabled','incapacidadMontoManual','permisoEnabled','permisoTipo','permisoRango','permisoDias','permisoMontoManualEnabled','permisoMontoManual','extrasEnabled','comisionesMonto'];
let extrasEntries = [];
let vacacionesPicker = null;
let incapacidadPicker = null;
let permisoPicker = null;
let lastCalculation = null;
const rangeState = { vacaciones:null, incapacidad:null, permiso:null };

document.addEventListener('DOMContentLoaded',()=>{
  initTheme();
  initAdvancedConfig();
  initPeriodSelector();
  initConfigSections();
  initExtrasManager();
  loadState();
  recalcDaysFromRanges();
  autoUpdateWorkedDays();
  bindPersistence();
  updateWarnings();
  initServiceWorker();
  const form=document.getElementById('formNomina');
  if(form){ form.addEventListener('submit',handleSubmit); }
  const btnPDF=document.getElementById('btnPDF');
  if(btnPDF){ btnPDF.addEventListener('click',handlePdf); }
});

function formatea(valor){
  return currencyFormatter.format(Math.round(valor||0));
}

function formatDias(valor){
  const numero=Number(valor);
  if(!Number.isFinite(numero)) return '0';
  return Number.isInteger(numero)? `${numero}` : numero.toFixed(2);
}

function formatHoras(valor){
  const numero=Number(valor);
  if(!Number.isFinite(numero)) return '0';
  return Number.isInteger(numero)? `${numero}` : numero.toFixed(2);
}

function initPeriodSelector(){
  const input=document.getElementById('periodoNomina');
  if(!input) return;
  if(!input.value){
    const today=new Date();
    input.value=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  }
  input.addEventListener('change',()=>{
    recalcDaysFromRanges();
    autoUpdateWorkedDays();
    saveStateAndUpdate();
  });
}

function normalizeDate(date){
  return new Date(date.getFullYear(),date.getMonth(),date.getDate());
}

function getPeriodRange(){
  const input=document.getElementById('periodoNomina');
  let baseDate;
  if(input && input.value){
    const [year,month]=input.value.split('-').map(Number);
    if(Number.isInteger(year) && Number.isInteger(month)){ baseDate=new Date(year,month-1,1); }
  }
  if(!baseDate) baseDate=new Date(new Date().getFullYear(),new Date().getMonth(),1);
  const start=new Date(baseDate.getFullYear(),baseDate.getMonth(),1);
  const end=new Date(baseDate.getFullYear(),baseDate.getMonth()+1,0);
  return {start,end};
}

function calculateDaysWithinPeriod(range,period){
  if(!range) return 0;
  const start=range.start>period.start?range.start:period.start;
  const end=range.end<period.end?range.end:period.end;
  if(start>end) return 0;
  return Math.round((end-start)/MS_PER_DAY)+1;
}

function setDaysFromRange(context){
  const range=rangeState[context];
  if(!range) return;
  const input=document.getElementById(`${context}Dias`);
  if(!input) return;
  const days=calculateDaysWithinPeriod(range,getPeriodRange());
  setNumericInputValue(input,days>0?days:0);
}

function recalcDaysFromRanges(){
  ['vacaciones','incapacidad','permiso'].forEach(setDaysFromRange);
}

function setNumericInputValue(target,value,limit=30){
  const input=typeof target==='string'?document.getElementById(target):target;
  if(!input) return;
  const limited=Math.max(0,Math.min(limit,value));
  const rounded=Math.round(limited*100)/100;
  input.value=rounded;
}

function initTheme(){
  const themeToggle=document.getElementById('themeToggle');
  let theme='dark';
  try{
    const stored=localStorage.getItem('theme');
    if(stored){ theme=stored; }
  }catch(e){ theme='dark'; }
  applyTheme(theme);
  if(themeToggle){
    themeToggle.addEventListener('click',()=>{
      const next=document.body.classList.contains('theme-dark')?'light':'dark';
      applyTheme(next);
      try{ localStorage.setItem('theme',next);}catch(e){}
    });
  }
}

function applyTheme(theme){
  document.body.classList.toggle('theme-dark',theme==='dark');
  try{ localStorage.setItem('theme',theme);}catch(e){}
}

function initAdvancedConfig(){
  const toggle=document.getElementById('advancedConfigToggle');
  const container=document.getElementById('advancedConfig');
  if(!toggle || !container) return;
  const stored=readAdvancedState();
  advancedHasPreference=stored!==null;
  setAdvancedVisibility(stored===null?false:stored,false);
  toggle.addEventListener('click',()=>{
    setAdvancedVisibility(!advancedConfigOpen);
  });
}

function readAdvancedState(){
  try{
    const raw=localStorage.getItem(ADVANCED_STATE_KEY);
    if(raw==='1') return true;
    if(raw==='0') return false;
  }catch(e){}
  return null;
}

function setAdvancedVisibility(open,persist=true){
  const toggle=document.getElementById('advancedConfigToggle');
  const container=document.getElementById('advancedConfig');
  if(!toggle || !container) return;
  advancedConfigOpen=open;
  container.classList.toggle('hidden',!open);
  toggle.setAttribute('aria-expanded',open?'true':'false');
  toggle.classList.toggle('active',open);
  const label=toggle.querySelector('.label');
  if(label){ label.textContent=open?'Ocultar configuración adicional':'Mostrar configuración adicional'; }
  if(persist){
    advancedHasPreference=true;
    try{ localStorage.setItem(ADVANCED_STATE_KEY,open?'1':'0'); }catch(e){}
  }
}

function shouldAutoOpenAdvanced(){
  if(isChecked('vacacionesEnabled') || isChecked('incapacidadEnabled') || isChecked('permisoEnabled') || isChecked('extrasEnabled')){
    return true;
  }
  if(getNumber('comisionesMonto')>0){ return true; }
  return extrasEntries.some(entry=>Number(entry.horas)>0);
}

function initServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{
      /* swallow errors silently; PWA is optional */
    });
  });
}

function ensureAdvancedVisibleIfNeeded(){
  const toggle=document.getElementById('advancedConfigToggle');
  if(!toggle) return;
  if(!advancedConfigOpen && !advancedHasPreference && shouldAutoOpenAdvanced()){
    setAdvancedVisibility(true);
  }else{
    setAdvancedVisibility(advancedConfigOpen,false);
  }
}

function generateExtraUid(){ return `extra-${Math.random().toString(36).slice(2,10)}`; }

function createExtraEntry(typeId=EXTRA_TYPES[0]?.id||'', horas=''){
  return {uid:generateExtraUid(),typeId,horas:horas===undefined||horas===null?'':String(horas)};
}

function sanitizeExtrasEntries(raw){
  if(!Array.isArray(raw)) return [];
  const validIds=new Set(EXTRA_TYPES.map(t=>t.id));
  return raw.map(item=>{
    const typeId=validIds.has(item?.typeId)?item.typeId:EXTRA_TYPES[0]?.id||'';
    const horasRaw=item && Object.prototype.hasOwnProperty.call(item,'horas')?item.horas:'';
    const horas=horasRaw===null||horasRaw===undefined?'' : String(horasRaw);
    const uid=typeof item?.uid==='string'&&item.uid?item.uid:generateExtraUid();
    return {uid,typeId,horas};
  });
}

function initExtrasManager(){
  const addBtn=document.getElementById('extrasAddBtn');
  if(addBtn){
    addBtn.addEventListener('click',()=>{
      extrasEntries.push(createExtraEntry());
      renderExtrasList();
      saveStateAndUpdate();
    });
  }
  renderExtrasList();
}

function renderExtrasList(){
  const list=document.getElementById('extrasList');
  if(!list) return;
  list.innerHTML='';
  if(extrasEntries.length===0){
    const empty=document.createElement('div');
    empty.className='extras-empty';
    empty.textContent='Sin conceptos de horas extra por ahora.';
    list.appendChild(empty);
    return;
  }
  const frag=document.createDocumentFragment();
  extrasEntries.forEach(entry=>{
    const row=document.createElement('div');
    row.className='extra-row';
    row.dataset.uid=entry.uid;

    const select=document.createElement('select');
    select.className='extra-type';
    select.setAttribute('aria-label','Tipo de hora extra o recargo');
    EXTRA_TYPES.forEach(type=>{
      const option=document.createElement('option');
      option.value=type.id;
      option.textContent=type.label;
      if(type.id===entry.typeId){ option.selected=true; }
      select.appendChild(option);
    });
    select.addEventListener('change',e=>{
      entry.typeId=e.target.value;
      saveStateAndUpdate();
    });

    const input=document.createElement('input');
    input.type='number';
    input.className='extra-hours';
    input.min='0';
    input.step='0.5';
    input.placeholder='0';
    input.setAttribute('aria-label','Cantidad de horas');
    input.value=entry.horas===undefined||entry.horas===null?'' : entry.horas;
    input.addEventListener('input',e=>{
      entry.horas=e.target.value;
      saveStateAndUpdate();
    });

    const remove=document.createElement('button');
    remove.type='button';
    remove.className='extra-remove';
    remove.innerHTML='&times;';
    remove.setAttribute('aria-label','Eliminar concepto de hora extra');
    remove.addEventListener('click',()=>{
      extrasEntries=extrasEntries.filter(item=>item.uid!==entry.uid);
      renderExtrasList();
      saveStateAndUpdate();
    });

    row.appendChild(select);
    row.appendChild(input);
    row.appendChild(remove);
    frag.appendChild(row);
  });
  list.appendChild(frag);
}

function initConfigSections(){
  const vacacionesToggle=document.getElementById('vacacionesEnabled');
  const vacacionesBody=document.getElementById('vacacionesBody');
  if(vacacionesToggle && vacacionesBody){
    vacacionesToggle.addEventListener('change',()=>{
      vacacionesBody.classList.toggle('hidden',!vacacionesToggle.checked);
      if(!vacacionesToggle.checked){ rangeState.vacaciones=null; }
      autoUpdateWorkedDays();
      saveStateAndUpdate();
    });
  }
  const vacManualToggle=document.getElementById('vacacionesMontoManualEnabled');
  const vacManualInput=document.getElementById('vacacionesMontoManual');
  if(vacManualToggle && vacManualInput){
    vacManualToggle.addEventListener('change',()=>{
      vacManualInput.disabled=!vacManualToggle.checked;
      saveStateAndUpdate();
    });
  }

  const incapacidadToggle=document.getElementById('incapacidadEnabled');
  const incapacidadBody=document.getElementById('incapacidadBody');
  if(incapacidadToggle && incapacidadBody){
    incapacidadToggle.addEventListener('change',()=>{
      incapacidadBody.classList.toggle('hidden',!incapacidadToggle.checked);
      if(!incapacidadToggle.checked){ rangeState.incapacidad=null; }
      autoUpdateWorkedDays();
      saveStateAndUpdate();
    });
  }
  const incapManualToggle=document.getElementById('incapacidadMontoManualEnabled');
  const incapManualInput=document.getElementById('incapacidadMontoManual');
  if(incapManualToggle && incapManualInput){
    incapManualToggle.addEventListener('change',()=>{
      incapManualInput.disabled=!incapManualToggle.checked;
      saveStateAndUpdate();
    });
  }

  const permisoToggle=document.getElementById('permisoEnabled');
  const permisoBody=document.getElementById('permisoBody');
  if(permisoToggle && permisoBody){
    permisoToggle.addEventListener('change',()=>{
      permisoBody.classList.toggle('hidden',!permisoToggle.checked);
      if(!permisoToggle.checked){ rangeState.permiso=null; }
      autoUpdateWorkedDays();
      saveStateAndUpdate();
    });
  }
  const permisoManualToggle=document.getElementById('permisoMontoManualEnabled');
  const permisoManualInput=document.getElementById('permisoMontoManual');
  if(permisoManualToggle && permisoManualInput){
    permisoManualToggle.addEventListener('change',()=>{
      permisoManualInput.disabled=!permisoManualToggle.checked;
      saveStateAndUpdate();
    });
  }
  const permisoTipo=document.getElementById('permisoTipo');
  if(permisoTipo){
    permisoTipo.addEventListener('change',()=>{
      syncPermisoManualControls();
      autoUpdateWorkedDays();
      saveStateAndUpdate();
    });
  }

  const extrasToggle=document.getElementById('extrasEnabled');
  const extrasBody=document.getElementById('extrasBody');
  if(extrasToggle && extrasBody){
    extrasToggle.addEventListener('change',()=>{
      extrasBody.classList.toggle('hidden',!extrasToggle.checked);
      if(extrasToggle.checked && extrasEntries.length===0){
        extrasEntries.push(createExtraEntry());
        renderExtrasList();
      }
      saveStateAndUpdate();
    });
  }

  if(window.flatpickr){
    try{ window.flatpickr.localize(window.flatpickr.l10ns.es); }catch(e){}
    vacacionesPicker = window.flatpickr('#vacacionesRango',{
      mode:'range',
      dateFormat:'d/m/Y',
      locale:'es',
      onClose:(selectedDates)=>syncRangeToDays(selectedDates,'vacaciones')
    });
    incapacidadPicker = window.flatpickr('#incapacidadRango',{
      mode:'range',
      dateFormat:'d/m/Y',
      locale:'es',
      onClose:(selectedDates)=>syncRangeToDays(selectedDates,'incapacidad')
    });
    permisoPicker = window.flatpickr('#permisoRango',{
      mode:'range',
      dateFormat:'d/m/Y',
      locale:'es',
      onClose:(selectedDates)=>syncRangeToDays(selectedDates,'permiso')
    });
  }

  const vacInput=document.getElementById('vacacionesRango');
  if(vacInput){
    vacInput.addEventListener('input',()=>{
      if(!vacInput.value){
        rangeState.vacaciones=null;
        autoUpdateWorkedDays();
        saveStateAndUpdate();
      }
    });
  }
  const incInput=document.getElementById('incapacidadRango');
  if(incInput){
    incInput.addEventListener('input',()=>{
      if(!incInput.value){
        rangeState.incapacidad=null;
        autoUpdateWorkedDays();
        saveStateAndUpdate();
      }
    });
  }
  const permisoInput=document.getElementById('permisoRango');
  if(permisoInput){
    permisoInput.addEventListener('input',()=>{
      if(!permisoInput.value){
        rangeState.permiso=null;
        const permisoDias=document.getElementById('permisoDias');
        if(permisoDias){ permisoDias.value=0; }
        autoUpdateWorkedDays();
        saveStateAndUpdate();
      }
    });
  }

  ['vacacionesDias','incapacidadDias','permisoDias'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){
      el.addEventListener('input',()=>{
        autoUpdateWorkedDays();
        saveStateAndUpdate();
      });
    }
  });

  syncPermisoManualControls();
}

function syncRangeToDays(selectedDates,context){
  if(!Array.isArray(selectedDates) || selectedDates.length<2){
    rangeState[context]=null;
    const target=document.getElementById(`${context}Dias`);
    if(target){ target.value=0; }
    autoUpdateWorkedDays();
    saveStateAndUpdate();
    return;
  }
  const start=normalizeDate(selectedDates[0]);
  const end=normalizeDate(selectedDates[selectedDates.length-1]);
  rangeState[context]={start,end};
  setDaysFromRange(context);
  autoUpdateWorkedDays();
  saveStateAndUpdate();
}

function bindPersistence(){
  fields.forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    const eventType = el.type==='checkbox' || el.tagName==='SELECT' ? 'change' : 'input';
    el.addEventListener(eventType,saveStateAndUpdate);
  });
}

function saveState(){
  const data={};
  fields.forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    if(el.type==='checkbox'){ data[id]=el.checked?'1':'0'; }
    else { data[id]=el.value; }
  });
  data.extrasEntries=extrasEntries;
  try{ localStorage.setItem('nominaState',JSON.stringify(data)); }catch(e){}
}

function saveStateAndUpdate(){
  saveState();
  updateWarnings();
}

function loadState(){
  let data=null;
  try{
    const raw=localStorage.getItem('nominaState');
    if(raw){ data=JSON.parse(raw); }
  }catch(e){ data=null; }
  if(data){
    fields.forEach(id=>{
      const el=document.getElementById(id);
      if(!el || data[id]===undefined) return;
      if(el.type==='checkbox'){ el.checked=data[id]==='1'; }
      else { el.value=data[id]; }
    });
  }
  extrasEntries=sanitizeExtrasEntries(data?.extrasEntries);
  if(extrasEntries.length===0 && data){
    EXTRA_TYPES.forEach(type=>{
      const legacy=data[type.id];
      const legacyNumber=Number(legacy);
      if(Number.isFinite(legacyNumber) && legacyNumber>0){
        extrasEntries.push(createExtraEntry(type.id,String(legacyNumber)));
      }
    });
  }
  renderExtrasList();
  syncSectionVisibility('vacaciones');
  syncSectionVisibility('incapacidad');
  syncSectionVisibility('permiso');
  syncSectionVisibility('extras');
  syncManualInput('vacaciones');
  syncManualInput('incapacidad');
  syncManualInput('permiso');
  syncPermisoManualControls();
  if(vacacionesPicker){
    const vacInput=document.getElementById('vacacionesRango');
    if(vacInput && vacInput.value){ vacacionesPicker.setDate(vacInput.value,false,'d/m/Y'); }
    updateRangeStateFromPicker('vacaciones');
  }
  else { rangeState.vacaciones=null; }
  if(incapacidadPicker){
    const incInput=document.getElementById('incapacidadRango');
    if(incInput && incInput.value){ incapacidadPicker.setDate(incInput.value,false,'d/m/Y'); }
    updateRangeStateFromPicker('incapacidad');
  }
  else { rangeState.incapacidad=null; }
  if(permisoPicker){
    const permisoInput=document.getElementById('permisoRango');
    if(permisoInput && permisoInput.value){ permisoPicker.setDate(permisoInput.value,false,'d/m/Y'); }
    updateRangeStateFromPicker('permiso');
  }
  else { rangeState.permiso=null; }
  recalcDaysFromRanges();
  autoUpdateWorkedDays();
  saveState();
  updateWarnings();
  ensureAdvancedVisibleIfNeeded();
}

function syncSectionVisibility(prefix){
  const toggle=document.getElementById(prefix+'Enabled');
  const body=document.getElementById(prefix+'Body');
  if(toggle && body){ body.classList.toggle('hidden',!toggle.checked); }
}

function syncManualInput(prefix){
  const toggle=document.getElementById(prefix+'MontoManualEnabled');
  const input=document.getElementById(prefix+'MontoManual');
  if(toggle && input){ input.disabled=!toggle.checked; }
}

function updateRangeStateFromPicker(prefix){
  const picker = prefix==='vacaciones'?vacacionesPicker:prefix==='incapacidad'?incapacidadPicker:permisoPicker;
  if(picker && picker.selectedDates && picker.selectedDates.length>=2){
    const selected=picker.selectedDates.map(normalizeDate);
    rangeState[prefix]={start:selected[0],end:selected[selected.length-1]};
  }else{
    rangeState[prefix]=null;
  }
}

function syncPermisoManualControls(){
  const tipo=document.getElementById('permisoTipo')?.value||'remunerado';
  const toggle=document.getElementById('permisoMontoManualEnabled');
  const input=document.getElementById('permisoMontoManual');
  if(!toggle || !input) return;
  if(tipo==='no_remunerado'){
    toggle.checked=false;
    toggle.disabled=true;
    input.disabled=true;
    input.value=0;
  }else{
    toggle.disabled=false;
    input.disabled=!toggle.checked;
  }
}

function autoUpdateWorkedDays(){
  const diasVac=isChecked('vacacionesEnabled')?getNumber('vacacionesDias'):0;
  const diasIncap=isChecked('incapacidadEnabled')?getNumber('incapacidadDias'):0;
  const diasPerm=isChecked('permisoEnabled')?getNumber('permisoDias'):0;
  const baseRaw=30 - diasVac - diasIncap - diasPerm;
  const base=Math.max(0,Math.min(30,baseRaw));
  ['diasSalario','diasBono1','diasBono2'].forEach(id=>setNumericInputValue(id,base,30));
}

function rangesOverlap(a,b){
  if(!a || !b) return false;
  return a.start <= b.end && b.start <= a.end;
}

function updateWarnings(){
  const warning=document.getElementById('daysWarning');
  if(!warning) return;
  const messages=[];
  const vacEnabled=isChecked('vacacionesEnabled');
  const incapEnabled=isChecked('incapacidadEnabled');
  const permisoEnabled=isChecked('permisoEnabled');
  const diasSalario=getNumber('diasSalario');
  const diasVac=vacEnabled?getNumber('vacacionesDias'):0;
  const diasIncap=incapEnabled?getNumber('incapacidadDias'):0;
  const diasPerm=permisoEnabled?getNumber('permisoDias'):0;
  const total=Number((diasSalario+diasVac+diasIncap+diasPerm).toFixed(2));
  if(Math.abs(total-30)>0.01){
    messages.push(`Los días configurados suman ${total}. Verifica que coincidan con el periodo de 30 días.`);
  }
  if(vacEnabled && incapEnabled && rangesOverlap(rangeState.vacaciones,rangeState.incapacidad)){
    messages.push('Las fechas de vacaciones e incapacidad se cruzan. Ajusta los rangos para evitar duplicidades.');
  }
  if(vacEnabled && permisoEnabled && rangesOverlap(rangeState.vacaciones,rangeState.permiso)){
    messages.push('Vacaciones y permisos comparten días. Revisa los rangos para evitar superposiciones.');
  }
  if(incapEnabled && permisoEnabled && rangesOverlap(rangeState.incapacidad,rangeState.permiso)){
    messages.push('Incapacidad y permisos se superponen en fechas. Ajusta los calendarios.');
  }
  if(vacEnabled && rangeState.vacaciones && diasVac===0){
    messages.push('El rango de vacaciones no cruza el mes seleccionado. Se contabilizan 0 días en este periodo.');
  }
  if(incapEnabled && rangeState.incapacidad && diasIncap===0){
    messages.push('El rango de incapacidad está fuera del mes de nómina. Se contabilizan 0 días.');
  }
  if(permisoEnabled && rangeState.permiso && diasPerm===0){
    messages.push('El permiso seleccionado no cae dentro del mes en cálculo. No suma días.');
  }
  if(messages.length){
    warning.innerHTML=messages.join('<br>');
    warning.classList.remove('hidden');
  }else{
    warning.classList.add('hidden');
  }
}

function isChecked(id){
  const el=document.getElementById(id);
  return !!(el && el.checked);
}

function getNumber(id){
  const el=document.getElementById(id);
  if(!el) return 0;
  const value=Number(el.value);
  return Number.isFinite(value)?value:0;
}

function handleSubmit(evt){
  evt.preventDefault();
  const calc=calculatePayroll();
  renderResults(calc);
  lastCalculation=calc;
  const btnPDF=document.getElementById('btnPDF');
  if(btnPDF){ btnPDF.classList.remove('hidden'); }
}

function calculatePayroll(){
  const salario=getNumber('salario');
  const bono1=getNumber('bono1');
  const bono2=getNumber('bono2');
  const novedades=Math.round(getNumber('novedades'));
  const diasSalario=getNumber('diasSalario');
  const diasBono1=getNumber('diasBono1');
  const diasBono2=getNumber('diasBono2');
  const salarioDia=salario/30;
  const salarioProp=Math.round(salarioDia * diasSalario);
  const bono1Prop=Math.round((bono1/30||0) * diasBono1);
  const bono2Prop=Math.round((bono2/30||0) * diasBono2);

  const vacacionesEnabled=isChecked('vacacionesEnabled');
  const vacacionesDias=vacacionesEnabled?getNumber('vacacionesDias'):0;
  const vacacionesCalculado=Math.round(salarioDia * vacacionesDias);
  const vacacionesManualEnabled=isChecked('vacacionesMontoManualEnabled');
  const vacacionesManual=getNumber('vacacionesMontoManual');
  const vacacionesValor=vacacionesEnabled ? (vacacionesManualEnabled && vacacionesManual>0 ? Math.round(vacacionesManual) : vacacionesCalculado) : 0;

  const incapacidadEnabled=isChecked('incapacidadEnabled');
  const incapacidadDias=incapacidadEnabled?getNumber('incapacidadDias'):0;
  const incapacidadTipo=document.getElementById('incapacidadTipo')?.value||'comun';
  const incapacidadCalculado=incapacidadEnabled?Math.round(calcularIncapacidad(salarioDia,incapacidadDias,incapacidadTipo)):0;
  const incapacidadManualEnabled=isChecked('incapacidadMontoManualEnabled');
  const incapacidadManual=getNumber('incapacidadMontoManual');
  const incapacidadValor=incapacidadEnabled ? (incapacidadManualEnabled && incapacidadManual>0 ? Math.round(incapacidadManual) : incapacidadCalculado) : 0;

  const permisoEnabled=isChecked('permisoEnabled');
  const permisoTipo=document.getElementById('permisoTipo')?.value||'remunerado';
  const permisoDias=permisoEnabled?getNumber('permisoDias'):0;
  const permisoCalculado = permisoEnabled && permisoTipo==='remunerado' ? Math.round(salarioDia * permisoDias) : 0;
  const permisoManualToggle = permisoTipo==='remunerado' && isChecked('permisoMontoManualEnabled');
  const permisoManual=getNumber('permisoMontoManual');
  const permisoValor = permisoEnabled
    ? (permisoTipo==='remunerado'
        ? (permisoManualToggle && permisoManual>0 ? Math.round(permisoManual) : permisoCalculado)
        : 0)
    : 0;

  const hourValue = salario>0 ? salario/HOURS_PER_MONTH : 0;
  const extrasEnabled=isChecked('extrasEnabled');
  const extrasDetalle=[];
  let extrasTotal=0;
  if(extrasEnabled){
    const aggregated={};
    extrasEntries.forEach(entry=>{
      const type=EXTRA_TYPES.find(t=>t.id===entry.typeId);
      if(!type) return;
      const horas=Number(entry.horas);
      if(!Number.isFinite(horas) || horas<=0) return;
      aggregated[type.id]=(aggregated[type.id]||0)+horas;
    });
    EXTRA_TYPES.forEach(type=>{
      const horas=aggregated[type.id];
      if(horas>0){
        const valor=Math.round(hourValue * type.multiplier * horas);
        extrasDetalle.push({id:type.id,label:type.label,shortLabel:type.shortLabel,horas,valor,mode:type.mode});
        extrasTotal+=valor;
      }
    });
  }

  const comisionesMonto=Math.round(getNumber('comisionesMonto'));

  const seguro=Math.max(0,Math.round(getNumber('seguro')));

  const basePrestacional=Math.max(0,
    salarioProp +
    vacacionesValor +
    incapacidadValor +
    (permisoTipo==='remunerado'?permisoValor:0) +
    extrasTotal +
    comisionesMonto
  );
  const salud=Math.round(basePrestacional*0.04);
  const pension=Math.round(basePrestacional*0.04);

  const totalIngresos=salarioProp + bono1Prop + bono2Prop + vacacionesValor + incapacidadValor + permisoValor + extrasTotal + comisionesMonto + novedades;
  const totalDeducciones=salud + pension + seguro;
  const neto=Math.round(totalIngresos - totalDeducciones);
  const diasSum=diasSalario + (vacacionesEnabled?vacacionesDias:0) + (incapacidadEnabled?incapacidadDias:0) + (permisoEnabled?permisoDias:0);

  return {
    salario,
    salarioDia,
    diasSalario,
    bono1Prop,
    bono2Prop,
    diasBono1,
    diasBono2,
    novedades,
    vacacionesValor,
    vacacionesDias,
    vacacionesCalculado,
    vacacionesManualEnabled,
    incapacidadValor,
    incapacidadDias,
    incapacidadTipo,
    incapacidadCalculado,
    incapacidadManualEnabled,
    permisoValor,
    permisoDias,
    permisoTipo,
    permisoCalculado,
    permisoManualEnabled:permisoManualToggle,
    extrasEnabled,
    extrasDetalle,
    extrasTotal,
    hourValue,
    comisionesMonto,
    salarioProp,
    salud,
    pension,
    seguro,
    totalIngresos,
    totalDeducciones,
    neto,
    diasSum,
    basePrestacional
  };
}

function renderResults(calc){
  const results=document.getElementById('results');
  if(!results) return;
  const incomes=[];
  if(calc.salarioProp>0){ incomes.push(renderIncomeCard('💼 Salario',calc.salarioProp,`${formatDias(calc.diasSalario)} días`)); }
  if(calc.vacacionesValor>0){
    const detail=`${formatDias(calc.vacacionesDias)} días${calc.vacacionesManualEnabled?' • Ajustado':''}`;
    incomes.push(renderIncomeCard('🌴 Vacaciones',calc.vacacionesValor,detail));
  }
  if(calc.incapacidadValor>0){
    const tipoLabel=calc.incapacidadTipo==='laboral'?'Origen laboral':'Origen común';
    const detail=`${formatDias(calc.incapacidadDias)} días • ${tipoLabel}${calc.incapacidadManualEnabled?' • Ajustado':''}`;
    incomes.push(renderIncomeCard('🩺 Incapacidad',calc.incapacidadValor,detail));
  }
  if(calc.permisoDias>0 || calc.permisoValor>0){
    const tipoLabel=calc.permisoTipo==='remunerado'?'Remunerado':'No remunerado';
    const ajustado=(calc.permisoTipo==='remunerado' && calc.permisoManualEnabled)?' • Ajustado':'';
    const detail=`${formatDias(calc.permisoDias)} días • ${tipoLabel}${ajustado}`;
    incomes.push(renderIncomeCard('📝 Permiso',calc.permisoValor,detail));
  }
  if(calc.bono1Prop>0){ incomes.push(renderIncomeCard('🎁 Extralegal',calc.bono1Prop,`${formatDias(calc.diasBono1)} días`)); }
  if(calc.bono2Prop>0){ incomes.push(renderIncomeCard('🍽️ Alimentación',calc.bono2Prop,`${formatDias(calc.diasBono2)} días`)); }
  if(calc.extrasEnabled && Array.isArray(calc.extrasDetalle)){
    calc.extrasDetalle.forEach(item=>{
      const tipo=item.mode==='overtime'?'Hora extra':'Recargo';
      const detail=`${formatHoras(item.horas)} h • ${tipo}`;
      incomes.push(renderIncomeCard(`⏱️ ${item.shortLabel}`,item.valor,detail));
    });
  }
  if(calc.comisionesMonto>0){ incomes.push(renderIncomeCard('💼 Comisiones',calc.comisionesMonto,'Prestacional')); }
  if(calc.novedades>0){ incomes.push(renderIncomeCard('🧾 Reembolsos',calc.novedades)); }
  incomes.push(`<div class="result-card metric"><span class="result-label">TOTAL INGRESOS:</span><span class="value">${formatea(calc.totalIngresos)}</span></div>`);

  const deductions=[];
  if(calc.salud>0){ deductions.push(renderDeductionCard('🏥 Salud (4%)',calc.salud,'salud')); }
  if(calc.pension>0){ deductions.push(renderDeductionCard('🏦 Pensión (4%)',calc.pension,'pension')); }
  if(calc.seguro>0){ deductions.push(renderDeductionCard('🛡️ Seguro olivos',calc.seguro)); }

  const diasDiff=Math.abs(calc.diasSum-30);
  const warningHtml = diasDiff>0.01 ? `<div class="result-card deduction-total" style="background:linear-gradient(90deg,#ffe3e3,#ffd4ce);color:#5a1d1d;border-left-color:rgba(244,67,54,0.6);"><span class="label">Ajuste necesario</span><span class="amount">${formatDias(calc.diasSum)} días</span></div>` : '';

  results.innerHTML = `${warningHtml}
    <div class="section-heading">INGRESOS</div>
    <div class="incomes-wrap">${incomes.join('')}</div>
    <div class="section-heading">DEDUCCIONES</div>
    <div class="deductions-wrap">${deductions.join('')}</div>
    <div class="result-card deduction-total"><span class="label">TOTAL DEDUCCIONES</span><span class="amount">${formatea(calc.totalDeducciones)}</span></div>
    <div class="result-card neto"><span class="result-label">NETO a recibir:</span><span class="value">${formatea(calc.neto)}</span></div>`;

  updateManualPlaceholders(calc);
}

function renderIncomeCard(label,amount,detail){
  const detailHtml = detail ? `<span class="result-detail">${detail}</span>` : '';
  return `<div class="result-card"><div class="label-stack"><span class="result-label">${label}:</span>${detailHtml}</div><span class="value">${formatea(amount)}</span></div>`;
}

function renderDeductionCard(label,amount,extraClass=''){ return `<div class="result-card ${extraClass}"><span class="result-label">${label}</span><span class="value">${formatea(amount)}</span></div>`; }

function updateManualPlaceholders(calc){
  const vacInput=document.getElementById('vacacionesMontoManual');
  if(vacInput && !isChecked('vacacionesMontoManualEnabled')){
    vacInput.placeholder=`Sugerido ${formatea(calc.vacacionesCalculado)}`;
  }
  const incInput=document.getElementById('incapacidadMontoManual');
  if(incInput && !isChecked('incapacidadMontoManualEnabled')){
    incInput.placeholder=`Sugerido ${formatea(calc.incapacidadCalculado)}`;
  }
  const permisoInput=document.getElementById('permisoMontoManual');
  if(permisoInput){
    if(calc.permisoTipo!=='remunerado'){
      permisoInput.placeholder='No remunerado';
    }else if(!isChecked('permisoMontoManualEnabled')){
      permisoInput.placeholder=`Sugerido ${formatea(calc.permisoCalculado)}`;
    }
  }
}

function calcularIncapacidad(salarioDia,dias,tipo){
  if(!dias || dias<=0) return 0;
  if(tipo==='laboral') return salarioDia * dias;
  let restante=dias;
  let monto=0;
  const bloque1=Math.min(restante,2);
  monto+=salarioDia * bloque1 * 0.6667;
  restante-=bloque1;
  if(restante>0){
    const bloque2=Math.min(restante,88);
    monto+=salarioDia * bloque2 * 0.6667;
    restante-=bloque2;
  }
  if(restante>0){
    const bloque3=Math.min(restante,450);
    monto+=salarioDia * bloque3 * 0.5;
    restante-=bloque3;
  }
  if(restante>0){
    monto+=salarioDia * restante * 0.5;
  }
  return monto;
}

function handlePdf(){
  if(!lastCalculation) return;
  const {jsPDF}=window.jspdf;
  if(!jsPDF) return;
  const doc=new jsPDF();
  drawPdf(doc,lastCalculation);
  doc.save('bauche_nomina.pdf');
}

function drawPdf(doc,calc){
  doc.setTextColor(80,80,80);
  doc.setFontSize(11);
  doc.text(`Fecha de cálculo: ${fechaActual()}`,18,33);
  doc.setFont('helvetica','bold');
  doc.setTextColor(60,151,151);
  doc.setFontSize(14);
  doc.text('Bauche Nómina Detallado',18,40);
  doc.setFont('helvetica','normal');
  doc.setFontSize(10);
  doc.setTextColor(35,35,35);
  let y=52;
  const rows=[];
  rows.push({label:`Salario (${formatDias(calc.diasSalario)} días)`,value:calc.salarioProp});
  if(calc.vacacionesValor>0){
    const vacLabel=`Vacaciones (${formatDias(calc.vacacionesDias)} días${calc.vacacionesManualEnabled?' ajustado':''})`;
    rows.push({label:vacLabel,value:calc.vacacionesValor});
  }
  if(calc.incapacidadValor>0){
    const tipo=calc.incapacidadTipo==='laboral'?'laboral':'común';
    const incLabel=`Incapacidad ${tipo} (${formatDias(calc.incapacidadDias)} días${calc.incapacidadManualEnabled?' ajustado':''})`;
    rows.push({label:incLabel,value:calc.incapacidadValor});
  }
  if(calc.permisoDias>0 || calc.permisoValor>0){
    const tipo=calc.permisoTipo==='remunerado'?'remunerado':'no remunerado';
    const ajustado=(calc.permisoTipo==='remunerado' && calc.permisoManualEnabled)?' ajustado':'';
    const permLabel=`Permiso ${tipo} (${formatDias(calc.permisoDias)} días${ajustado})`;
    rows.push({label:permLabel,value:calc.permisoValor});
  }
  if(calc.bono1Prop>0){ rows.push({label:`Extralegal (${formatDias(calc.diasBono1)} días)`,value:calc.bono1Prop}); }
  if(calc.bono2Prop>0){ rows.push({label:`Alimentación (${formatDias(calc.diasBono2)} días)`,value:calc.bono2Prop}); }
  if(calc.extrasEnabled && Array.isArray(calc.extrasDetalle)){
    calc.extrasDetalle.forEach(item=>{
      const label=`${item.label} (${formatHoras(item.horas)} h)`;
      rows.push({label,value:item.valor});
    });
  }
  if(calc.comisionesMonto>0){ rows.push({label:'Comisiones',value:calc.comisionesMonto}); }
  if(calc.novedades>0){ rows.push({label:'Reembolsos',value:calc.novedades}); }

  rows.push({label:'TOTAL INGRESOS',value:calc.totalIngresos,font:'bold',color:[43,223,126]});
  rows.push({label:'Salud (4%)',value:calc.salud,color:[113,98,194]});
  rows.push({label:'Pensión (4%)',value:calc.pension,color:[113,98,194]});
  if(calc.seguro>0){ rows.push({label:'Seguro olivos',value:calc.seguro,color:[113,98,194]}); }
  rows.push({label:'TOTAL DEDUCCIONES',value:calc.totalDeducciones,font:'bold',color:[113,98,194]});
  rows.push({label:'NETO A PAGAR',value:calc.neto,font:'bold',color:[35,150,58],size:12});

  rows.forEach(row=>{
    if(row.font){ doc.setFont('helvetica',row.font); }
    else { doc.setFont('helvetica','normal'); }
    doc.setFontSize(row.size||10);
    if(row.color){ doc.setTextColor(...row.color); }
    else { doc.setTextColor(35,35,35); }
    doc.text(row.label,18,y);
    doc.text(formatea(row.value),188,y,{align:'right'});
    y+=7;
  });
}

function fechaActual(){
  const f=new Date();
  return `${f.getDate().toString().padStart(2,'0')}/${(f.getMonth()+1).toString().padStart(2,'0')}/${f.getFullYear()}`;
}