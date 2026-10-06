// Static single-page site (no dependencies, no CDN): site/index.html (en), site/ja/index.html (ja) + data.json.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildRows, I18N } from './render.js';
import { normalizeRelease } from './release.js';

export const DEFAULT_REPO_URL = 'https://github.com/miyako/4d-classic-to-oop';
export const DEFAULT_DOCS_REPO = 'doc4d/docs';

const UI = {
  en: {
    search: 'Search commands, classes, notes…',
    allThemes: 'All themes',
    allClassifications: 'All classifications',
    allSections: 'General + ORDA',
    general: 'General',
    orda: 'ORDA',
    section: 'Section',
    unreviewedOnly: 'Unreviewed only',
    shown: '{n} of {total} commands',
    none: 'No matching command.',
    meta: 'Docs version',
    floor: 'Floor',
    generated: 'Generated',
    docsCommit: 'Docs commit',
    source: 'Source & mapping on GitHub',
    unreviewed: '† not reviewed yet.',
    since: 'since',
    other: '日本語',
  },
  ja: {
    search: 'コマンド・クラス・備考を検索…',
    allThemes: 'すべてのテーマ',
    allClassifications: 'すべての分類',
    allSections: '一般 + ORDA',
    general: '一般',
    orda: 'ORDA',
    section: '区分',
    unreviewedOnly: '未レビューのみ',
    shown: '{total} 件中 {n} 件',
    none: '該当するコマンドはありません。',
    meta: 'ドキュメントバージョン',
    floor: '下限',
    generated: '生成日時',
    docsCommit: 'ドキュメントのコミット',
    source: 'GitHub のソースとマッピング',
    unreviewed: '† 未レビュー。',
    since: '',
    other: 'English',
  },
};

/** Commit of the docs clone (read-only git call), or null. */
export function docsCommit(docsRoot) {
  try {
    return execFileSync('git', ['-C', docsRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

/** Data for one language (also written as data.json). */
export function buildSiteData(mapping, opts) {
  const lang = opts.lang || 'en';
  const { rows, warnings } = buildRows(mapping, { ...opts, lang });
  return {
    data: {
      meta: {
        lang,
        docsVersion: opts.version || 'latest',
        floor: opts.floor ? normalizeRelease(opts.floor) : null,
        generatedAt: opts.generatedAt || new Date().toISOString(),
        docsCommit: opts.docsCommit ?? null,
        docsRepo: opts.docsRepo || DEFAULT_DOCS_REPO,
        repoUrl: opts.repoUrl || DEFAULT_REPO_URL,
        count: rows.length,
      },
      rows: rows.map((r) => ({
        command: r.command,
        url: r.url,
        theme: r.theme,
        themeLabel: r.themeLabel,
        section: r.orda ? 'orda' : 'general',
        classification: r.classification,
        classificationLabel: r.classificationLabel,
        note: r.note,
        reviewed: r.reviewed,
        deprecated: r.deprecated,
        targets: r.targets.map((t) => ({ label: t.label, url: t.url, addedIn: t.addedIn || null })),
      })),
    },
    warnings,
  };
}

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const jsonForScript = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const CSS = `
:root{--bg:#fff;--fg:#1f2328;--muted:#656d76;--border:#d0d7de;--head:#f6f8fa;--link:#0969da;--hover:#f3f6fa;
--drop:#1a7f37;--drop-bg:#dafbe1;--ref:#9a6700;--ref-bg:#fff8c5;--part:#bc4c00;--part-bg:#fff1e5;--orda:#8250df;--orda-bg:#fbefff}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8d96a0;--border:#30363d;--head:#161b22;--link:#4493f8;--hover:#161b22;
--drop:#3fb950;--drop-bg:#12261e;--ref:#d29922;--ref-bg:#272115;--part:#f0883e;--part-bg:#2d1d12;--orda:#ab7df8;--orda-bg:#231a35}}
*{box-sizing:border-box}
body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Sans","Noto Sans JP",Meiryo,sans-serif;background:var(--bg);color:var(--fg)}
a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}
header,main,footer{max-width:1400px;margin:0 auto;padding:0 16px}
header{padding-top:20px}
h1{font-size:1.6em;margin:0 0 4px}
.top{display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap}
.intro,.meta,.legend,footer{color:var(--muted)}
.meta{font-size:.9em}.meta code{font-size:.95em}
.legend{margin:8px 0}
.controls{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;align-items:center;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2}
input[type=search],select{font:inherit;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--fg)}
input[type=search]{flex:1 1 260px;min-width:200px}
label.chk{display:flex;gap:4px;align-items:center;color:var(--muted)}
#count{color:var(--muted);margin-left:auto}
.wrap{overflow-x:auto;border:1px solid var(--border);border-radius:6px}
table{border-collapse:collapse;width:100%}
th,td{padding:6px 10px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}
th{background:var(--head);position:sticky;top:0;cursor:pointer;user-select:none;white-space:nowrap}
th[aria-sort=ascending]::after{content:" ▲";font-size:.8em}th[aria-sort=descending]::after{content:" ▼";font-size:.8em}
tbody tr:hover{background:var(--hover)}
td.cmd{white-space:nowrap;font-weight:600}
td.targets{white-space:nowrap}td.targets a{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em}
sub{color:var(--muted);font-size:.75em}
.badge{display:inline-block;padding:1px 8px;border-radius:999px;font-size:.85em;font-weight:600;white-space:nowrap}
.b-Drop-in{color:var(--drop);background:var(--drop-bg)}.b-Refactor{color:var(--ref);background:var(--ref-bg)}.b-Partial{color:var(--part);background:var(--part-bg)}
.b-orda{color:var(--orda);background:var(--orda-bg)}.b-general{color:var(--muted);background:var(--head)}
.dag{color:var(--part);font-weight:400}.dep{color:var(--muted);font-weight:400;font-style:italic}
#empty{padding:20px;text-align:center;color:var(--muted)}
footer{padding:16px;font-size:.9em}
@media (max-width:700px){td.note{min-width:240px}h1{font-size:1.3em}}
`;

const JS = `
(function(){
var D=JSON.parse(document.getElementById('data').textContent),T=JSON.parse(document.getElementById('ui').textContent);
var rows=D.rows,tbody=document.querySelector('tbody'),q=document.getElementById('q'),fTheme=document.getElementById('theme'),
fCls=document.getElementById('cls'),fSec=document.getElementById('sec'),fRev=document.getElementById('rev'),count=document.getElementById('count'),empty=document.getElementById('empty');
var sortKey='theme',sortDir=1;
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function opt(sel,vals){vals.forEach(function(v){var o=document.createElement('option');o.value=v[0];o.textContent=v[1];sel.appendChild(o)})}
var themes={};rows.forEach(function(r){themes[r.theme]=r.themeLabel});
opt(fTheme,Object.keys(themes).sort(function(a,b){return themes[a].localeCompare(themes[b],D.meta.lang)}).map(function(k){return[k,themes[k]]}));
var cls={};rows.forEach(function(r){cls[r.classification]=r.classificationLabel});
opt(fCls,['Drop-in','Refactor','Partial'].filter(function(k){return cls[k]}).map(function(k){return[k,cls[k]]}));
rows.forEach(function(r){r._text=[r.command,r.theme,r.themeLabel,r.classification,r.classificationLabel,r.note].concat(r.targets.map(function(t){return t.label})).join(' ').toLowerCase()});
var keyOf={command:function(r){return r.command.toLowerCase()},theme:function(r){return r.themeLabel+'\\u0000'+r.command.toLowerCase()},
section:function(r){return r.section+'\\u0000'+r.themeLabel+'\\u0000'+r.command.toLowerCase()},targets:function(r){return r.targets.map(function(t){return t.label}).join(' ').toLowerCase()},
classification:function(r){return ['Drop-in','Refactor','Partial'].indexOf(r.classification)+'\\u0000'+r.command.toLowerCase()},note:function(r){return r.note.toLowerCase()}};
function rowHtml(r){
 var tg=r.targets.map(function(t){return '<div><a href="'+esc(t.url)+'">'+esc(t.label)+'</a>'+(t.addedIn?' <sub>'+esc((T.since?T.since+' ':'')+t.addedIn)+'</sub>':'')+'</div>'}).join('');
 return '<tr><td class="cmd"><a href="'+esc(r.url)+'">'+esc(r.command)+'</a>'+(r.deprecated?' <span class="dep">('+esc(T.deprecated)+')</span>':'')+(r.reviewed?'':' <span class="dag" title="'+esc(T.unreviewed)+'">†</span>')+'</td>'+
 '<td>'+esc(r.themeLabel)+'</td><td><span class="badge b-'+r.section+'">'+esc(r.section==='orda'?T.orda:T.general)+'</span></td>'+
 '<td class="targets">'+tg+'</td><td><span class="badge b-'+esc(r.classification)+'">'+esc(r.classificationLabel)+'</span></td><td class="note">'+esc(r.note)+'</td></tr>'}
function update(){
 var words=q.value.toLowerCase().split(/\\s+/).filter(Boolean),th=fTheme.value,c=fCls.value,s=fSec.value,rv=fRev.checked;
 var list=rows.filter(function(r){return(!th||r.theme===th)&&(!c||r.classification===c)&&(!s||r.section===s)&&(!rv||!r.reviewed)&&words.every(function(w){return r._text.indexOf(w)>=0})});
 var k=keyOf[sortKey];list.sort(function(a,b){var x=k(a),y=k(b);return(x<y?-1:x>y?1:0)*sortDir});
 tbody.innerHTML=list.map(rowHtml).join('');empty.hidden=list.length>0;count.textContent=T.shown.replace('{n}',list.length).replace('{total}',rows.length);
 var p=new URLSearchParams();if(q.value)p.set('q',q.value);if(th)p.set('theme',th);if(c)p.set('class',c);if(s)p.set('section',s);if(rv)p.set('unreviewed','1');
 if(sortKey!=='theme'||sortDir!==1)p.set('sort',(sortDir<0?'-':'')+sortKey);
 history.replaceState(null,'',p.toString()?'?'+p:location.pathname);
 document.querySelectorAll('th[data-k]').forEach(function(h){h.setAttribute('aria-sort',h.dataset.k===sortKey?(sortDir>0?'ascending':'descending'):'none')})}
var P=new URLSearchParams(location.search);q.value=P.get('q')||'';fTheme.value=P.get('theme')||'';fCls.value=P.get('class')||'';fSec.value=P.get('section')||'';fRev.checked=P.get('unreviewed')==='1';
var so=P.get('sort');if(so&&keyOf[so.replace(/^-/,'')]){sortKey=so.replace(/^-/,'');sortDir=so[0]==='-'?-1:1}
document.querySelectorAll('th[data-k]').forEach(function(h){h.addEventListener('click',function(){if(sortKey===h.dataset.k)sortDir=-sortDir;else{sortKey=h.dataset.k;sortDir=1}update()})});
[q,fTheme,fCls,fSec,fRev].forEach(function(e){e.addEventListener('input',update);e.addEventListener('change',update)});
var other=document.getElementById('other');other.addEventListener('click',function(){other.href=other.getAttribute('href').split('?')[0]+location.search});
update();
})();
`;

/** Render one language page. */
export function siteHtml(data, { otherHref }) {
  const lang = data.meta.lang;
  const t = I18N[lang] || I18N.en;
  const u = UI[lang] || UI.en;
  const m = data.meta;
  const commit = m.docsCommit
    ? `<a href="https://github.com/${escHtml(m.docsRepo)}/commit/${escHtml(m.docsCommit)}"><code>${escHtml(m.docsCommit.slice(0, 10))}</code></a>`
    : '<code>n/a</code>';
  const legend = escHtml(t.legend).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
  const ui = { ...u, deprecated: t.deprecated };
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:,">
<title>${escHtml(t.title)}</title>
<meta name="description" content="${escHtml(t.intro)}">
<link rel="alternate" hreflang="${lang === 'ja' ? 'en' : 'ja'}" href="${escHtml(otherHref)}">
<style>${CSS}</style>
</head>
<body>
<header>
<div class="top"><h1>${escHtml(t.title)}</h1><a id="other" href="${escHtml(otherHref)}" hreflang="${lang === 'ja' ? 'en' : 'ja'}">${escHtml(u.other)}</a></div>
<p class="intro">${escHtml(t.intro)}</p>
<p class="meta">${escHtml(u.meta)}: <code>${escHtml(m.docsVersion)}</code>${m.floor ? ` · ${escHtml(u.floor)}: <code>${escHtml(m.floor)}</code>` : ''} · ${escHtml(u.generated)}: <code>${escHtml(m.generatedAt.slice(0, 16).replace('T', ' '))} UTC</code> · ${escHtml(u.docsCommit)}: ${commit} · <a href="${escHtml(m.repoUrl)}">${escHtml(u.source)}</a></p>
<p class="legend">${legend} ${escHtml(u.unreviewed)}</p>
</header>
<main>
<div class="controls">
<input type="search" id="q" placeholder="${escHtml(u.search)}" aria-label="${escHtml(u.search)}" autofocus>
<select id="theme" aria-label="${escHtml(t.cols[1])}"><option value="">${escHtml(u.allThemes)}</option></select>
<select id="cls" aria-label="${escHtml(t.cols[3])}"><option value="">${escHtml(u.allClassifications)}</option></select>
<select id="sec" aria-label="${escHtml(u.section)}"><option value="">${escHtml(u.allSections)}</option><option value="general">${escHtml(u.general)}</option><option value="orda">${escHtml(u.orda)}</option></select>
<label class="chk"><input type="checkbox" id="rev"> ${escHtml(u.unreviewedOnly)}</label>
<span id="count" aria-live="polite"></span>
</div>
<div class="wrap"><table>
<thead><tr><th data-k="command">${escHtml(t.cols[0])}</th><th data-k="theme">${escHtml(t.cols[1])}</th><th data-k="section">${escHtml(u.section)}</th><th data-k="targets">${escHtml(t.cols[2])}</th><th data-k="classification">${escHtml(t.cols[3])}</th><th data-k="note">${escHtml(t.cols[4])}</th></tr></thead>
<tbody></tbody>
</table><div id="empty" hidden>${escHtml(u.none)}</div></div>
<noscript><p>JavaScript is required for the interactive table; see <a href="data.json">data.json</a>.</p></noscript>
</main>
<footer><a href="${escHtml(m.repoUrl)}">${escHtml(m.repoUrl.replace(/^https?:\/\//, ''))}</a> · <a href="data.json">data.json</a></footer>
<script type="application/json" id="data">${jsonForScript(data)}</script>
<script type="application/json" id="ui">${jsonForScript(ui)}</script>
<script>${JS}</script>
</body>
</html>
`;
}

/** Build site/index.html, site/data.json, site/ja/index.html, site/ja/data.json (+ .nojekyll). */
export function buildSite(mapping, opts) {
  const outDir = path.resolve(opts.outDir || 'site');
  const common = {
    ...opts,
    generatedAt: opts.generatedAt || new Date().toISOString(),
    docsCommit: opts.docsCommit !== undefined ? opts.docsCommit : docsCommit(opts.docsRoot),
  };
  const warnings = [];
  const files = [];
  for (const [lang, dir, otherHref] of [
    ['en', outDir, 'ja/'],
    ['ja', path.join(outDir, 'ja'), '../'],
  ]) {
    const { data, warnings: w } = buildSiteData(mapping, { ...common, lang });
    warnings.push(...w.filter((x) => !warnings.includes(x)));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), siteHtml(data, { otherHref }));
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(data, null, 2) + '\n');
    files.push(path.join(dir, 'index.html'), path.join(dir, 'data.json'));
  }
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
  return { files, warnings };
}
