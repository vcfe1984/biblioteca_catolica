const $ = id => document.getElementById(id);
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const number = value => new Intl.NumberFormat('es').format(value);
let books = [], filtered = [], currentPage = 1, deferredInstall;
const pageSize = 24;
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function action(book) {
  if (!book.enlace) return element('span', 'unavailable', 'no disponible');
  const link = element('a', 'open-book', 'Abrir libro ↗');
  link.href = book.enlace; link.target = '_blank'; link.rel = 'noopener noreferrer';
  return link;
}
function details(book) {
  $('detail-title').textContent = book.titulo || 'Sin título';
  $('detail-author').textContent = book.autor || 'Autor no indicado';
  $('detail-fields').replaceChildren();
  for (const [label, key] of [['Ubicación en la biblioteca','ubicacion'],['Editorial','editorial'],['Lugar de publicación','lugarPublicacion'],['Fecha de publicación','fecha'],['Páginas','paginas']]) {
    $('detail-fields').append(element('dt','',label),element('dd','',book[key] || 'No indicado'));
  }
  $('detail-action').replaceChildren(action(book)); $('detail').showModal();
}
function card(book) {
  const node = element('article','book');
  const top = element('div','book-top'); top.append(element('span','book-icon','✦'),element('span','shelf', book.ubicacion));
  const title = element('h3'); title.style.margin = '0';
  const titleButton = element('button','title-button',book.titulo || 'Sin título'); titleButton.onclick = () => details(book); title.append(titleButton);
  const bottom = element('div','book-bottom'); const more = element('button','view-detail','Ver ficha →'); more.onclick=()=>details(book); bottom.append(action(book),more);
  node.append(top,title,element('p','author',book.autor || 'Autor no indicado'),element('div','book-meta',[book.editorial,book.fecha].filter(Boolean).join(' · ')),bottom);
  return node;
}
function render() {
  const count=filtered.length, pages=Math.max(1,Math.ceil(count/pageSize)); currentPage=Math.min(currentPage,pages);
  $('results').textContent = `${number(count)} ${count===1?'libro encontrado':'libros encontrados'}`;
  $('books').replaceChildren(...filtered.slice((currentPage-1)*pageSize,currentPage*pageSize).map(card));
  $('empty').hidden=!!count; $('pagination').hidden=!count;
  $('page').textContent=`${currentPage} de ${number(pages)}`;
  $('previous').disabled=currentPage===1; $('next').disabled=currentPage===pages;
}
function filter() {
  const terms = normalize($('search').value).trim().split(/\s+/).filter(Boolean), availability=$('availability').value, publisher=$('publisher').value;
  filtered=books.filter(b=>terms.every(t=>b.search.includes(t)) && (!publisher || b.editorial===publisher) && (availability==='all' || (availability==='yes' ? !!b.enlace : !b.enlace)));
  const sort=$('sort').value;
  const year=b=>Number((b.fecha.match(/\b\d{4}\b/)||[])[0])||0;
  filtered.sort((a,b)=>sort==='date' ? year(b)-year(a) || collator.compare(a.titulo,b.titulo) : Number(!(sort==='author'?a.autor:a.titulo))-Number(!(sort==='author'?b.autor:b.titulo)) || collator.compare(sort==='author'?a.autor:a.titulo,sort==='author'?b.autor:b.titulo));
  currentPage=1; render();
}
async function load() {
  $('error').hidden=true;
  try {
    const response=await fetch('./data/catalogo.json',{cache:'no-cache'}); if (!response.ok) throw new Error('Catálogo no accesible');
    const data=await response.json(); if (!Array.isArray(data.libros)||!data.libros.length) throw new Error('Catálogo vacío');
    books=data.libros.map(b=>({...b,enlace:/^https?:\/\/[^\s]+$/i.test(b.enlace)?b.enlace:'',search:normalize(`${b.titulo} ${b.autor}`)}));
    $('total').textContent=`${number(books.length)} libros en la colección`;
    const publishers=[...new Set(books.map(b=>b.editorial).filter(Boolean))].sort(collator.compare);
    $('publisher').replaceChildren(new Option('Todas las editoriales',''),...publishers.map(p=>new Option(p,p)));
    $('updated').textContent=`Catálogo actualizado el ${new Intl.DateTimeFormat('es',{dateStyle:'long',timeZone:'UTC'}).format(new Date(data.actualizado))}`;
    filter();
  } catch(error) { $('error').hidden=false; $('results').textContent='Catálogo no disponible'; $('total').textContent=''; $('pagination').hidden=true; }
}
$('filters').onsubmit=e=>e.preventDefault();
let searchTimer; $('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(filter,120);};
['availability','publisher','sort'].forEach(id=>$(id).onchange=filter);
$('clear').onclick=()=>{$('filters').reset();filter();};
for (const [id,delta] of [['previous',-1],['next',1]]) $(id).onclick=()=>{currentPage+=delta;render();$('results').scrollIntoView({behavior:'smooth',block:'start'});};
$('close').onclick=()=>$('detail').close();
$('detail').onclick=e=>{if(e.target===$('detail')){const r=$('detail').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('detail').close();}};
$('retry').onclick=load;
document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)&&!$('detail').open){e.preventDefault();$('search').focus();}});
function connection(){ $('connection').textContent=navigator.onLine?'Catálogo público':'Sin conexión · catálogo guardado'; }
addEventListener('online',connection);addEventListener('offline',connection);connection();
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('install').hidden=false;});
$('install').onclick=async()=>{if(deferredInstall){await deferredInstall.prompt();deferredInstall=null;$('install').hidden=true;}};
addEventListener('appinstalled',()=>{$('install').hidden=true;});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').then(reg=>{
  if(reg.waiting)$('update-banner').hidden=false;
  reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)$('update-banner').hidden=false;});});
  $('reload').onclick=()=>{if(reg.waiting)reg.waiting.postMessage('ACTIVATE');else location.reload();};
  let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!refreshing){refreshing=true;location.reload();}});
}).catch(()=>{});
load();
