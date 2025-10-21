// travel expense app - enhanced with share/export/import and mobile-friendly UI

const STORAGE_KEY = 'travel_expense_app_v2';

// DOM
const tripListEl = document.getElementById('trip-list');
const btnNewTrip = document.getElementById('btn-new-trip');
const modalNewTrip = document.getElementById('modal-new-trip');
const tripTitleInput = document.getElementById('trip-title-input');
const tripDateInput = document.getElementById('trip-date-input');
const createTripConfirm = document.getElementById('create-trip-confirm');
const createTripCancel = document.getElementById('create-trip-cancel');

const btnAddExpense = document.getElementById('btn-add-expense');
const modalNewExpense = document.getElementById('modal-new-expense');
const expenseCategory = document.getElementById('expense-category');
const expenseDesc = document.getElementById('expense-desc');
const expenseAmount = document.getElementById('expense-amount');
const createExpenseConfirm = document.getElementById('create-expense-confirm');
const createExpenseCancel = document.getElementById('create-expense-cancel');

const currentTripTitle = document.getElementById('current-trip-title');
const currentTripDate = document.getElementById('current-trip-date');
const expensesListEl = document.getElementById('expenses-list');
const totalAmountEl = document.getElementById('total-amount');
const categoryBreakdownEl = document.getElementById('category-breakdown');
const btnExport = document.getElementById('btn-export');

const btnShare = document.getElementById('btn-share');
const btnShareSide = document.getElementById('btn-share-side');
const btnCopy = document.getElementById('btn-copy');
const peopleCountTop = document.getElementById('people-count');
const peopleCountSide = document.getElementById('people-count-side');

const btnExportJson = document.getElementById('btn-export-json');
const btnImportJson = document.getElementById('btn-import-json');
const fileImport = document.getElementById('file-import');

const toastEl = document.getElementById('toast');

let state = { trips: [], currentTripId: null };

// Chart
let chart = null;
const chartCtx = document.getElementById('expense-chart').getContext('2d');

// helpers
function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }
function fmtYen(n){ return '¥' + Number(n).toLocaleString('ja-JP'); }
function showToast(msg, ms = 2000){
  toastEl.textContent = msg;
  toastEl.style.display = 'block';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> { toastEl.style.display = 'none'; }, ms);
}
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  }catch(e){ console.error('load error', e); }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// render
function renderTrips(){
  tripListEl.innerHTML = '';
  // new trip button already in strip; add trip cards
  if (!state.trips || state.trips.length === 0){
    const p = document.createElement('div'); p.className='trip-card'; p.textContent='旅行がありません。＋で作成';
    tripListEl.appendChild(p);
    return;
  }
  state.trips.forEach(trip=>{
    const el = document.createElement('div');
    el.className = 'trip-card' + (trip.id===state.currentTripId ? ' active' : '');
    el.dataset.id = trip.id;
    const t = document.createElement('div'); t.className='title'; t.textContent = trip.title || '無題の旅行';
    const d = document.createElement('div'); d.className='date muted'; d.textContent = trip.date || '';
    const total = trip.expenses.reduce((s,e)=> s + Number(e.amount||0), 0);
    const amt = document.createElement('div'); amt.className = 'small-muted'; amt.textContent = fmtYen(total);
    const top = document.createElement('div');
    top.appendChild(t); top.appendChild(d);
    el.appendChild(top);
    el.appendChild(amt);

    // delete small
    const del = document.createElement('button'); del.className='btn ghost small'; del.textContent='削除';
    del.onclick = (ev) => {
      ev.stopPropagation();
      if (!confirm('本当にこの旅行を削除しますか？')) return;
      state.trips = state.trips.filter(x=> x.id !== trip.id);
      if (state.currentTripId === trip.id) state.currentTripId = state.trips.length ? state.trips[0].id : null;
      saveState(); refreshUI();
      showToast('旅行を削除しました');
    };
    el.appendChild(del);

    el.onclick = () => {
      state.currentTripId = trip.id; saveState(); refreshUI();
    };

    tripListEl.appendChild(el);
  });
}

function renderCurrentTrip(){
  const trip = state.trips.find(t=> t.id === state.currentTripId);
  if (!trip){
    currentTripTitle.textContent = '旅行を選択してください';
    currentTripDate.textContent = '—';
    btnAddExpense.disabled = true;
    btnExport.disabled = true;
    expensesListEl.innerHTML = '<p class="small-muted">旅行を選択してください。</p>';
    totalAmountEl.textContent = fmtYen(0);
    categoryBreakdownEl.innerHTML = '';
    updateChart({});
    return;
  }

  currentTripTitle.textContent = trip.title;
  currentTripDate.textContent = trip.date || '';
  btnAddExpense.disabled = false;
  btnExport.disabled = false;

  // expenses list
  if (!trip.expenses || trip.expenses.length === 0){
    expensesListEl.innerHTML = '<p class="small-muted">まだ費用がありません。</p>';
  } else {
    expensesListEl.innerHTML = '';
    trip.expenses.forEach(exp => {
      const row = document.createElement('div'); row.className='expense-item';

      const left = document.createElement('div'); left.className='expense-left';
      const cat = document.createElement('div'); cat.className='expense-cat'; cat.textContent = exp.category;
      const desc = document.createElement('div'); desc.className='expense-desc'; desc.textContent = exp.desc;
      left.appendChild(cat); left.appendChild(desc);

      const right = document.createElement('div'); right.style.display='flex'; right.style.alignItems='center'; right.style.gap='6px';
      const amount = document.createElement('div'); amount.className='expense-amount'; amount.textContent = fmtYen(exp.amount);
      const edit = document.createElement('button'); edit.className='btn ghost small'; edit.textContent='編集';
      const del = document.createElement('button'); del.className='btn ghost small'; del.textContent='削除';

      edit.onclick = (ev) => { ev.stopPropagation(); openExpenseModalForEdit(trip.id, exp.id); };
      del.onclick = (ev) => { ev.stopPropagation(); if(!confirm('削除しますか？')) return; trip.expenses = trip.expenses.filter(e=> e.id !== exp.id); saveState(); refreshUI(); };

      right.appendChild(amount); right.appendChild(edit); right.appendChild(del);

      row.appendChild(left); row.appendChild(right);
      expensesListEl.appendChild(row);
    });
  }

  // totals per category
  const categories = ['交通費','食費','観光','宿泊','その他'];
  const totals = {}; categories.forEach(c=> totals[c]=0);
  (trip.expenses || []).forEach(e => totals[e.category] = (totals[e.category]||0) + Number(e.amount||0));
  const grand = Object.values(totals).reduce((s,v)=> s+v,0);
  totalAmountEl.textContent = fmtYen(grand);

  categoryBreakdownEl.innerHTML = '';
  categories.forEach(c=>{
    const pill = document.createElement('div'); pill.className='cat-pill'; pill.textContent = `${c} ${fmtYen(totals[c]||0)}`;
    categoryBreakdownEl.appendChild(pill);
  });

  updateChart(totals);
}

// chart
function updateChart(totals){
  const labels = Object.keys(totals);
  const data = labels.map(k => totals[k]||0);
  const nonZero = data.some(v=> v>0);
  const displayLabels = nonZero ? labels : ['No data'];
  const displayData = nonZero ? data : [1];

  if (chart) chart.destroy();
  chart = new Chart(chartCtx, {
    type: 'doughnut',
    data: { labels: displayLabels, datasets: [{ data: displayData, hoverOffset:6, borderWidth:0 }]},
    options: {
      plugins:{ legend:{ position:'bottom', labels:{color:'#e6eef8'}}, tooltip:{ callbacks:{ label: ctx => nonZero ? `${ctx.label}: ${fmtYen(ctx.raw)}` : '' }}},
      maintainAspectRatio:false, cutout:'60%'
    }
  });
}

/* Modal controls */
function openModal(el){ el.setAttribute('aria-hidden','false'); }
function closeModal(el){ el.setAttribute('aria-hidden','true'); }

/* Trip create */
btnNewTrip.addEventListener('click', ()=>{
  tripTitleInput.value = '';
  tripDateInput.value = '';
  openModal(modalNewTrip);
});
createTripCancel.addEventListener('click', ()=> closeModal(modalNewTrip));
createTripConfirm.addEventListener('click', ()=>{
  const title = tripTitleInput.value.trim() || '名前なしの旅行';
  const date = tripDateInput.value || '';
  const newTrip = { id: uid('trip'), title, date, expenses: [] };
  state.trips.push(newTrip);
  state.currentTripId = newTrip.id;
  saveState(); closeModal(modalNewTrip); refreshUI();
});

/* Expense create/edit */
btnAddExpense.addEventListener('click', ()=>{
  if (!state.currentTripId) return;
  expenseCategory.value = '交通費'; expenseDesc.value=''; expenseAmount.value='';
  createExpenseConfirm.dataset.editId = '';
  openModal(modalNewExpense);
});
createExpenseCancel.addEventListener('click', ()=> closeModal(modalNewExpense));
createExpenseConfirm.addEventListener('click', ()=>{
  const cat = expenseCategory.value;
  const desc = (expenseDesc.value || '-').trim();
  const amount = Number(expenseAmount.value || 0);
  if (isNaN(amount) || amount < 0){ alert('正しい金額を入力してください'); return; }
  const trip = state.trips.find(t=> t.id === state.currentTripId);
  if (!trip) return;
  const editId = createExpenseConfirm.dataset.editId;
  if (editId){
    const ex = trip.expenses.find(e=> e.id === editId);
    if (ex){ ex.category = cat; ex.desc = desc; ex.amount = amount; }
  } else {
    trip.expenses.push({ id: uid('exp'), category:cat, desc, amount });
  }
  saveState(); closeModal(modalNewExpense); refreshUI();
});
function openExpenseModalForEdit(tripId, expenseId){
  const trip = state.trips.find(t=> t.id === tripId);
  if (!trip) return;
  const ex = trip.expenses.find(e=> e.id === expenseId);
  if (!ex) return;
  expenseCategory.value = ex.category; expenseDesc.value = ex.desc; expenseAmount.value = ex.amount;
  createExpenseConfirm.dataset.editId = expenseId; openModal(modalNewExpense);
}

/* CSV export (existing) */
btnExport.addEventListener('click', ()=>{
  const trip = state.trips.find(t=> t.id === state.currentTripId);
  if (!trip) return;
  const lines = [['カテゴリ','内容','金額']];
  trip.expenses.forEach(e => lines.push([e.category, e.desc, e.amount]));
  const csv = lines.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${trip.title || 'travel'}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast('CSV をダウンロードしました');
});

/* Share text generation */
function makeShareText(trip, people=1){
  const categories = ['交通費','食費','観光','宿泊','その他'];
  const totals = {}; categories.forEach(c=> totals[c]=0);
  (trip.expenses||[]).forEach(e => totals[e.category] = (totals[e.category]||0) + Number(e.amount||0));
  const grand = Object.values(totals).reduce((s,v)=> s+v,0);
  const per = Math.ceil(grand / Math.max(1, people));
  const dateText = trip.date ? `${trip.date}の` : '';
  const intro = `${trip.title}（${dateText}旅行）の費用まとめ：\n`;
  const detail = categories.map(c => `${c}: ${fmtYen(totals[c]||0)}`).join('\n');
  const footer = `\n合計：${fmtYen(grand)}\n${people}人で割ると1人 ${fmtYen(per)} です！`;
  return intro + detail + footer;
}

/* Share button behavior */
async function shareCurrentTrip(people){
  const trip = state.trips.find(t=> t.id === state.currentTripId);
  if (!trip){ alert('旅行を選択してください'); return; }
  const text = makeShareText(trip, people);
  // also prepare JSON file (export data)
  const json = JSON.stringify(trip, null, 2);
  const file = new File([json], `${trip.title || 'travel'}.json`, {type:'application/json'});

  // Try Web Share API with files (if supported)
  if (navigator.canShare && navigator.canShare({ files: [file] })){
    try {
      await navigator.share({ title: trip.title, text, files: [file] });
      showToast('共有しました');
      return;
    } catch (e) { console.warn('share failed', e); }
  }

  // fallback: share text only via navigator.share
  if (navigator.share){
    try {
      await navigator.share({ title: trip.title, text });
      showToast('共有しました');
      return;
    } catch (e){ console.warn('share text failed', e); }
  }

  // final fallback: download JSON and copy text to clipboard (or show modal)
  // trigger download of JSON
  const blob = new Blob([json], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${trip.title || 'travel'}.json`; a.click();
  URL.revokeObjectURL(url);
  // copy text
  try {
    await navigator.clipboard.writeText(text);
    showToast('データをダウンロードし、共有テキストをコピーしました');
  } catch {
    alert('共有できる環境ではありません。\nテキストを手動でコピーしてください：\n\n' + text);
  }
}

/* Copy button */
async function copyShareText(people){
  const trip = state.trips.find(t=> t.id === state.currentTripId);
  if (!trip){ alert('旅行を選択してください'); return; }
  const text = makeShareText(trip, people);
  try {
    await navigator.clipboard.writeText(text);
    showToast('共有テキストをコピーしました');
  } catch (e){
    alert('クリップボードへコピーできませんでした。テキストを手動でコピーしてください：\n\n' + text);
  }
}

/* event wiring */
btnShare.addEventListener('click', ()=> {
  const p = Number(peopleCountTop.value) || 1;
  shareCurrentTrip(Math.max(1, Math.floor(p)));
});
btnShareSide.addEventListener('click', ()=> {
  const p = Number(peopleCountSide.value) || 1;
  shareCurrentTrip(Math.max(1, Math.floor(p)));
});
btnCopy.addEventListener('click', ()=> {
  const p = Number(peopleCountTop.value) || 1;
  copyShareText(Math.max(1, Math.floor(p)));
});

/* JSON export/import */
btnExportJson.addEventListener('click', ()=>{
  const trip = state.trips.find(t=> t.id === state.currentTripId);
  if (!trip){ alert('旅行を選択してください'); return; }
  const json = JSON.stringify(trip, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${trip.title || 'travel'}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('JSON をダウンロードしました');
});

btnImportJson.addEventListener('click', ()=> fileImport.click());
fileImport.addEventListener('change', async (ev)=>{
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  try {
    const txt = await f.text();
    const imported = JSON.parse(txt);
    // validate basic shape (id,title,expenses)
    if (!imported || !imported.title) throw new Error('不正なデータです');
    // assign new ids to avoid collision, and push to state
    const newTrip = { id: uid('trip'), title: imported.title || 'imported', date: imported.date || '', expenses: [] };
    (imported.expenses || []).forEach(e => {
      newTrip.expenses.push({ id: uid('exp'), category: e.category || 'その他', desc: e.desc || '-', amount: Number(e.amount || 0) });
    });
    state.trips.push(newTrip);
    state.currentTripId = newTrip.id;
    saveState();
    refreshUI();
    showToast('インポート完了（新しい旅行として追加）');
  } catch (e){
    alert('インポートに失敗しました: ' + e.message);
  } finally {
    fileImport.value = '';
  }
});

/* init demo if empty */
function ensureDemoData(){
  if (state.trips && state.trips.length) return;
  const demo = { id: uid('trip'), title: '京都週末旅', date: '', expenses: [
    { id: uid('exp'), category:'交通費', desc:'新幹線往復', amount:14000 },
    { id: uid('exp'), category:'宿泊', desc:'ゲストハウス1泊', amount:8000 },
    { id: uid('exp'), category:'食費', desc:'夕食・昼食', amount:7000 },
    { id: uid('exp'), category:'観光', desc:'拝観料', amount:1200 }
  ]};
  state.trips = [demo]; state.currentTripId = demo.id; saveState();
}

/* refresh UI */
function refreshUI(){ renderTrips(); renderCurrentTrip(); }

// load & start
loadState();
if (!state.trips) state.trips = [];
if (!state.currentTripId && state.trips.length) state.currentTripId = state.trips[0].id;
ensureDemoData();
refreshUI();
