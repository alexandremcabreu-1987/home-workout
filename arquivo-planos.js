/* Home Workout 4.2 — histórico de fichas versionadas, somente leitura.
 * Nenhuma escrita de dados; não modifica training_profiles nem tabelas hw41_. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const br=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')?d.split('-').reverse().join('/'):'Não informada';
const prevDay=s=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()-1);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const show=id=>$(id)?.classList.remove('hidden'),hide=id=>$(id)?.classList.add('hidden');
let db=null,who=null,items=[],openId=null,mode=false,loading=false,err='';
const curCfg=()=>window.HOME_WORKOUT_CONFIG||{};
function allDone(entries){return Object.values(entries||{}).filter(r=>r&&/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')&&['done','skipped','draft'].includes(r.status))}
function fSession(s){return (s.blocks||[]).flatMap(b=>b.type==='strength'||b.type==='core'?(b.exercises||[]).map(e=>({...e,block:b.type})):[])}
function niceExercise(e){let load=e.loadMode==='each'?' por halter':e.loadMode==='single'?' no total':'';
 return `<li><strong>${safe(e.name)}</strong> — ${safe(e.sets)} séries × ${safe(e.reps)} · ${safe(e.restSeconds??0)}s descanso${e.loadKg==null||e.loadMode==='none'?'':' · '+safe(e.loadKg)+' kg'+load}</li>`}
function legacyExercise(e){let unit=e[4]==='each'?'kg por halter':e[4]==='single'?'kg total':'sem carga';return `<li><strong>${safe(e[0])}</strong> — ${safe(e[1])} séries × ${safe(e[2])} · ${safe(e[3])}s · ${unit}</li>`}
function planDiv(snap){return (snap.sessions||[]).map(s=>safe(s.code)).join(' / ')||'Sem divisão'}
function details(x){const snap=x.snapshot||{};let rows=x.legacy?snap.sessions.map(s=>`<details style="margin:10px 0;border:1px solid #304550;border-radius:10px;padding:12px"><summary style="cursor:pointer"><strong>${safe(s.code)} — ${safe(s.name)}</strong></summary><p class="hint">${safe(s.desc||'')}</p><ul>${(s.ex||[]).map(legacyExercise).join('')||'<li>Sem exercícios de força</li>'}</ul><p class="hint">Bicicleta prevista: ${safe(s.bike||0)} min</p></details>`).join(''):(snap.sessions||[]).map(s=>`<details style="margin:10px 0;border:1px solid #304550;border-radius:10px;padding:12px"><summary style="cursor:pointer"><strong>${safe(s.code)} — ${safe(s.name)}</strong></summary><ul>${fSession(s).map(niceExercise).join('')||'<li>Sem exercícios cadastrados</li>'}</ul>${(s.blocks||[]).filter(b=>b.type==='cardio').map(b=>`<p class="hint">Bicicleta: ${safe(b.minutes||0)} min · ${safe(b.intensity||'não informada')}</p>`).join('')}</details>`).join('');
 let extra=x.legacy?`<p class="hint">Registros desta rotina: ${x.records.filter(r=>r.status==='done').length} concluído(s), ${x.records.filter(r=>r.status==='skipped').length} pulado(s). Os detalhes de cada sessão permanecem na aba Histórico.</p>`:`<p class="hint">Registros nesta versão: ${x.records.filter(r=>r.status==='done').length} concluído(s), ${x.records.filter(r=>r.status==='skipped').length} pulado(s). As execuções ficam preservadas no banco.</p>`;
 return `<div style="margin-top:12px"><div class="notice">Ficha original — somente leitura. Para reutilizar uma ficha nova, abre o editor e duplica a versão do plano.</div>${rows}${extra}</div>`;
}
function render(){const el=$('archive-body');if(!el||!mode)return;if(loading){el.innerHTML='<p class="hint">Carregando fichas da tua conta...</p>';return}if(err){el.innerHTML='<div class="notice">'+safe(err)+'</div><button id="archive-retry" class="secondary">Tentar novamente</button>';el.querySelector('#archive-retry').onclick=fetchAll;return}
 if(!who){el.innerHTML='<div class="notice">Entra com a tua conta para consultar os programas anteriores.</div>';return}
 if(!items.length){el.innerHTML='<div class="notice">Ainda não há fichas anteriores para esta conta. Quando substituíres um plano, ele aparecerá aqui, com nome, datas e exercícios.</div>';return}
 el.innerHTML=items.map((x,i)=>`<div class="exercise" style="margin-top:12px"><div class="split"><div><div class="smallcaps">${x.legacy?'PROGRAMA ORIGINAL':'PLANO '+safe(x.versionNumber||1)}</div><h3 style="margin:5px 0">${safe(x.name)}</h3><div class="hint">Divisão: ${safe(x.division)} · ${br(x.start)} até ${x.end?br(x.end):x.ongoing?'Em uso':'Fim não identificado'}</div><div class="hint">${x.records.filter(r=>r.status==='done').length} treino(s) concluído(s)</div></div><button class="outline" data-view="${i}" type="button">${openId===x.key?'Fechar':'Ver ficha completa'}</button></div>${openId===x.key?details(x):''}</div>`).join('');
 el.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{const x=items[Number(b.dataset.view)];openId=openId===x.key?null:x.key;render()})}
async function fetchAll(){if(loading)return;const cfg=curCfg();if(!cfg.url||!cfg.key||!window.supabase){err='Configuração Supabase indisponível.';render();return}loading=true;err='';render();try{
 db=db||window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true}});
 const auth=await db.auth.getUser();if(auth.error)throw auth.error;who=auth.data?.user||null;if(!who){items=[];applyLegacyVisibility(false);return}
 const uid=who.id;
 const [pRes,vRes,sRes,legacyRes]=await Promise.all([
 db.from('hw41_plans').select('id,name,current_version_id,created_at').eq('owner_id',uid),
 db.from('hw41_plan_versions').select('id,plan_id,version_number,status,snapshot,effective_date,published_at').order('effective_date',{ascending:true}),
 db.from('hw41_sessions').select('id,plan_version_id,performed_on,status').eq('owner_id',uid).limit(5000),
 db.from('training_profiles').select('payload').eq('user_id',uid).maybeSingle()
 ]);
 for(const r of [pRes,vRes,sRes,legacyRes])if(r.error)throw r.error;
 const plans=pRes.data||[], versions=(vRes.data||[]).filter(v=>plans.some(p=>p.id===v.plan_id)&&v.status==='published'&&/^\d{4}-\d{2}-\d{2}$/.test(v.effective_date||''));
 const recorded=sRes.data||[],todayDate=today(),byPlan=new Map(),output=[];
 for(const v of versions){if(!byPlan.has(v.plan_id))byPlan.set(v.plan_id,[]);byPlan.get(v.plan_id).push(v)}
 const allPublished=versions.filter(v=>v.effective_date<=todayDate).sort((a,b)=>a.effective_date.localeCompare(b.effective_date)||a.version_number-b.version_number);
 const activePublished=allPublished.at(-1)||null;
 for(const v of versions){if(v.effective_date>todayDate)continue;const next=allPublished.filter(w=>w.id!==v.id&&(w.effective_date>v.effective_date||(w.effective_date===v.effective_date&&w.version_number>v.version_number)))[0];const isActive=activePublished?.id===v.id;
 if(isActive)continue;
 const plan=plans.find(p=>p.id===v.plan_id);const end=next?prevDay(next.effective_date):null;
 output.push({key:v.id,name:plan?.name||'Plano sem nome',division:planDiv(v.snapshot||{}),versionNumber:v.version_number,start:v.effective_date,end,ongoing:false,legacy:false,snapshot:v.snapshot||{},records:recorded.filter(r=>r.plan_version_id===v.id)})}
 const legacy=allDone(legacyRes.data?.payload?.entries);const legacyDates=legacy.map(r=>r.date).sort();
 applyLegacyVisibility(legacy.length>0&&!activePublished);
 if(legacy.length){const cut=allPublished[0]?.effective_date||null;const before=legacy.filter(r=>!cut||r.date<cut);let earliest=legacyDates[0];let last=before.map(r=>r.date).sort().at(-1)||legacyDates.at(-1);const end=cut?prevDay(cut):null;
 // When A-G remains current, do not show it under previous programs.
 if(cut){const legacyDefs=[['A','Superior A'],['B','Inferior A'],['C','Cardio + abdômen'],['D','Superior B'],['E','Inferior B'],['F','Bicicleta'],['G','Recuperação ativa']];
 const defsForHistory=window.HW42_LEGACY_DEFS||null;
 const sessions=legacyDefs.map(([code,name])=>{const s=defsForHistory?.[code];return {code,name:s?.title||name,desc:s?.desc||'',ex:s?.ex||[],bike:s?.bike||0}});
 output.push({key:'legacy',name:'Treino de Adaptação',division:'A / B / C / D / E / F / G',start:earliest,end,ongoing:false,legacy:true,snapshot:{sessions},records:before})}
 }
 items=output.sort((a,b)=>(b.end||b.start).localeCompare(a.end||a.start));
 }catch(e){err=e.message||'Erro ao consultar programas.'}finally{loading=false;render()}}
function applyLegacyVisibility(yes){const b=$('legacy-train-tab');if(b)b.style.display=yes?'':'none';if(!yes&&b?.classList.contains('active')&&!document.body.classList.contains('locked'))$('v42-tab')?.click();}
function switchArchive(){mode=true;['train','history','progress','data','v42-panel'].forEach(hide);show('archive-panel');$('archive-tab')?.classList.add('active');$('v42-tab')?.classList.remove('active');document.querySelectorAll('[data-tab]').forEach(b=>b.classList.remove('active'));fetchAll()}
function off(){mode=false;hide('archive-panel');$('archive-tab')?.classList.remove('active')}
window.addEventListener('DOMContentLoaded',()=>{
 $('archive-tab')?.addEventListener('click',switchArchive);
 $('v42-tab')?.addEventListener('click',off);
 document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',off));
 const logout=$('cloud-logout');logout?.addEventListener('click',()=>{who=null;items=[];off();applyLegacyVisibility(false)});
 applyLegacyVisibility(false);
 db=null;
 // After sign-in, a click on archives queries fresh data under the active account.
 // Legacy button visibility is read without cross-account access.
 const cfg=curCfg();if(cfg.url&&cfg.key&&window.supabase){db=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true}});db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session?.user){setTimeout(fetchAll,0)}else if(event==='SIGNED_OUT'){who=null;items=[];applyLegacyVisibility(false);render()}})}
 const ready=setInterval(()=>{if(!document.body.classList.contains('locked')){clearInterval(ready);fetchAll()}},500);setTimeout(()=>clearInterval(ready),15000);
});
})();