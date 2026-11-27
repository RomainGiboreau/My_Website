/* rgm: shared "Method & sources" panel for the tool pages. Data object D = {what, method:[html], sources:[[item,source,status]], validation:[html], limits:[html]} */
(function(D){
  const css=`
.rgm-btn{font:inherit;font-size:.8rem;border:1px solid rgba(245,243,237,.55);background:transparent;color:#f5f3ed;border-radius:4px;padding:.2rem .6rem;cursor:pointer;margin-left:8px}
.rgm-btn:hover,.rgm-btn.on{background:#f5f3ed;color:#4a5a4e;border-color:#f5f3ed}
#rgm{position:fixed;left:0;right:0;bottom:0;top:56px;overflow:auto;background:var(--bg,#eeece6);color:var(--fg,#232220);z-index:40;display:none;font:14px/1.5 Inter,system-ui,sans-serif}
#rgm.on{display:block}
#rgm .rgdoc{max-width:1000px;margin:0 auto;padding:18px 18px 70px}
#rgm h2{font:600 1.15rem "Space Grotesk",Inter,sans-serif;margin:26px 0 8px}
#rgm h2:first-child{margin-top:4px}
#rgm p{max-width:82ch;margin:6px 0}
#rgm ul{max-width:82ch;margin:6px 0 6px 20px;padding:0}
#rgm li{margin:4px 0}
#rgm table{width:100%;border-collapse:collapse;background:var(--card,#f5f3ed);border:1px solid var(--line,#c9c4b6);font-size:.84rem;margin:8px 0 14px}
#rgm th,#rgm td{text-align:left;vertical-align:top;padding:6px 9px;white-space:normal;border-bottom:1px solid var(--line,#c9c4b6)}
#rgm th{background:var(--alt,#e2ded3);position:static}
#rgm td.rgst{white-space:normal;width:12em;min-width:9em}
#rgm .rgchip{display:inline-block;padding:0 7px;border-radius:9px;font-size:.72rem;font-weight:600;background:#e3dfd2;color:#5c5a52}
#rgm .rgchip.ok{background:rgba(74,90,78,.2);color:#3a4a3e}
#rgm .rgchip.warn{background:rgba(168,98,58,.2);color:#8a4e2c}
#rgm .rgleg{color:var(--mut,#5c5a52);font-size:.78rem;max-width:90ch}
@media(max-width:700px){#rgm table{display:block;overflow-x:auto}}`;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  const chip=s=>{const l=String(s).toLowerCase(),c=l.startsWith('published')?'ok':(/^(supplied|memory)|not retrieved|to add|to complete|to verify/.test(l)?'warn':'');return `<span class="rgchip ${c}">${s}</span>`};
  let h='<div class="rgdoc">';
  h+=`<h2>What it does</h2><p>${D.what}</p>`;
  if(D.method&&D.method.length)h+='<h2>Method</h2><ul>'+D.method.map(x=>`<li>${x}</li>`).join('')+'</ul>';
  if(D.sources&&D.sources.length){h+='<h2>Sources and status</h2><table><thead><tr><th>Item</th><th>Source</th><th>Status</th></tr></thead><tbody>'+D.sources.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td class="rgst">${chip(r[2])}</td></tr>`).join('')+'</tbody></table>';
    h+='<p class="rgleg">Status tags: <b>published (read)</b> the content for the number or method concerned was read in the publication or standard; <b>published (metadata verified)</b> the reference exists and its citation (authors, year, title, journal, volume, pages) was checked in Crossref or another scholarly metadata service, but its content was not re-read; <b>to verify</b> a citation that could not be verified, with what is missing; <b>published (second hand)</b> as reported by a secondary page; <b>figure</b> values read off a published figure, not from a table; <b>supplied</b> numbers supplied by the site author, not checked against the paper; <b>derived</b> own derivation from a mass balance or first principles; <b>memory</b> written from memory, not checked; <b>existence confirmed</b> the reference exists (title, year), its content was not read; <b>classical</b> standard method, reference still to add; <b>on the page</b> the rule or default is shown and editable in the tool itself. A reference is listed only when its existence was confirmed; when only the record is known, the details are left out rather than guessed.</p>'}
  if(D.validation&&D.validation.length)h+='<h2>Validation</h2><ul>'+D.validation.map(x=>`<li>${x}</li>`).join('')+'</ul>';
  if(D.limits&&D.limits.length)h+='<h2>Limits and not implemented</h2><ul>'+D.limits.map(x=>`<li>${x}</li>`).join('')+'</ul>';
  h+=`<p class="rgleg">Last updated ${D.date||'12 October 2026'}.</p></div>`;
  const box=document.createElement('div');box.id='rgm';box.innerHTML=h;document.body.appendChild(box);
  const top=document.querySelector('.top'),btn=document.createElement('button');btn.type='button';btn.className='rgm-btn';btn.textContent='Method & sources';
  const bar=top&&top.querySelector('.bar'),back=top&&Array.from(top.children).find(e=>e.tagName==='A');
  if(bar)bar.appendChild(btn);else if(top)top.insertBefore(btn,back||null);else{btn.style.cssText='position:fixed;right:10px;top:10px;z-index:50;background:#4a5a4e';document.body.appendChild(btn)}
  function set(on){box.classList.toggle('on',on);btn.classList.toggle('on',on);btn.textContent=on?'← Back to the tool':'Method & sources';
    if(on){const r=top?top.getBoundingClientRect():{bottom:0};box.style.top=Math.max(0,Math.round(r.bottom))+'px';box.scrollTop=0}}
  btn.onclick=()=>set(!box.classList.contains('on'));
  // ---- Tools menu: switch between the tool pages without going back to the site
  (function(){
    const CAT=[['Data preparation',[['LAS checker','las-checker'],['ZMAP checker','zmap-checker'],['Colour-blind check','cvd']]],['Digitization',[['Plot digitizer','digitizer'],['Continuous map digitizer','mapdigitizer'],['Discrete map digitizer','discretemap'],['Well-log digitizer','logdigitizer']]],
      ['Mapping and spatial statistics',[['Map interpolation','gridding'],['Variogram','variogram'],['Convex & concave hulls','hull'],['Clustering','clustering'],['GDE map generator','gdemap'],['GDE map generator (new)','gdemap3'],['Grid attributes','gridattr']]],
      ['Organic geochemistry',[['Rock-Eval QC','rockeval'],['Source rock potential','source'],['Thermal maturity','maturity'],['Biomarkers','biomarkers'],['Chromatogram','chromatogram'],['Ternary diagram','ternary']]],
      ['Basin modelling and petrophysics',[['Compaction fit','compaction'],['BHT correction','bht'],['TR Cycles','tr-cycles'],['Petroleum system events','psec'],['Burial history (1D)','burial'],['Log correlation (DTW)','logcorr']]],
      ['Decision support',[['MCDA AHP','mcda-ahp'],['MCDA PROMETHEE','mcda-promethee'],['Prospect risking (gCOS, eCOS)','risking'],['Portfolio consolidation','portfolio'],['Field development screening','fdp'],['Contact and well POS','wellpos'],['Distribution fitting','distfit']]]];
    const top=document.querySelector('.top');if(!top)return;
    const cur=(location.pathname.replace(/\/index\.html$/,'/').split('/').filter(Boolean).pop()||'');
    const st=document.createElement('style');st.textContent=`
.rgnav{position:relative;display:inline-block}
.rgnav>button{font:inherit;font-size:.8rem;border:1px solid rgba(245,243,237,.55);background:transparent;color:#f5f3ed;border-radius:4px;padding:.2rem .6rem;cursor:pointer}
.rgnav>button:hover,.rgnav>button[aria-expanded=true]{background:#f5f3ed;color:#4a5a4e;border-color:#f5f3ed}
.rgnav .rgmenu{display:none;position:absolute;left:0;top:calc(100% + 6px);z-index:80;background:#f5f3ed;color:#232220;border:1px solid #c9c4b6;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.22);padding:12px 14px;width:max-content;max-width:min(92vw,760px);font:13px/1.4 Inter,system-ui,sans-serif;columns:2 230px;column-gap:22px}
.rgnav.on .rgmenu{display:block}
.rgnav .rgmenu h3{font:600 .72rem Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:#5c5a52;margin:0 0 4px;break-after:avoid}
.rgnav .rgmenu div{break-inside:avoid;margin-bottom:12px}
.rgnav .rgmenu a{display:block;color:#232220;text-decoration:none;border:0;opacity:1;font-size:.84rem;padding:3px 6px;border-radius:4px}
.rgnav .rgmenu a:hover{background:#e2ded3}
.rgnav .rgmenu a.cur{background:rgba(74,90,78,.18);font-weight:600}
.rgnav .rgmenu a.home{margin-bottom:10px;border-bottom:1px solid #c9c4b6;border-radius:0;column-span:all}
@media(max-width:700px){.rgnav{position:static}.rgnav .rgmenu{position:fixed;left:8px;right:8px;top:56px;width:auto;max-width:none;columns:1;max-height:calc(100vh - 70px);overflow:auto}}`;
    document.head.appendChild(st);
    const w=document.createElement('span');w.className='rgnav';
    const b=document.createElement('button');b.type='button';b.textContent='Tools ▾';b.setAttribute('aria-haspopup','true');b.setAttribute('aria-expanded','false');
    const m=document.createElement('nav');m.className='rgmenu';m.setAttribute('aria-label','Tools');
    m.innerHTML='<a class="home" href="../">← Back to the site</a>'+CAT.map(([c,l])=>'<div><h3>'+c+'</h3>'+l.map(([n,s])=>'<a href="../'+s+'/"'+(s===cur?' class="cur" aria-current="page"':'')+'>'+n+'</a>').join('')+'</div>').join('');
    w.appendChild(b);w.appendChild(m);
    const h1=top.querySelector('h1');if(h1&&h1.nextSibling)top.insertBefore(w,h1.nextSibling);else top.appendChild(w);
    const set=on=>{w.classList.toggle('on',on);b.setAttribute('aria-expanded',on?'true':'false')};
    b.onclick=e=>{e.stopPropagation();set(!w.classList.contains('on'))};
    document.addEventListener('click',e=>{if(!w.contains(e.target))set(false)});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&w.classList.contains('on')){set(false);b.focus()}});
  })();

  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&box.classList.contains('on'))set(false)});
  window.addEventListener('resize',()=>{if(box.classList.contains('on'))set(true)});
})
