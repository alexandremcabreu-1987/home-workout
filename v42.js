/* Home Workout 4.2 — plano versionado e histórico novo, independente de A-G */
(()=>{'use strict';
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateNow=()=>{let d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const cfg=window.HOME_WORKOUT_CONFIG||{};
const historyArea=()=>document.getElementById('v42-history');
const historyVisible=()=>!document.getElementById('history')?.classList.contains('hidden');
let sb=null,user=null,plan=null,version=null,sessions=[],cardio=[],planSessions=[],draft=null,ready=false,active=false,loadError='';
const pad=n=>String(n).padStart(2,'0');
function announce(msg,bad=false){const n=$('v42-message');if(n){n.textContent=msg;n.style.color=bad?'#ffb5a6':'#95efc1'}}
function block(s,t){return (s.blocks||[]).find(b=>b.type===t)||{exercises:[]}}
function allExercises(s){return [...(block(s,'strength').exercises||[]),...(block(s,'core').exercises||[])].map(x=>({...x}))}
function loadName(x){return x==='each'?'kg por halter':x==='single'?'kg total':'sem carga'}
function visiblePanel(show){active=show;$('v42-panel').classList.toggle('hidden',!show);if(show)['train','history','progress','data'].forEach(id=>$(id).classList.add('hidden'));if(show){$('v42-tab').classList.add('active');document.querySelectorAll('[data-tab]').forEach(b=>b.classList.remove('active'));render()}else{$('v42-tab').classList.remove('active')}}
function switchToNew(){['train','history','progress','data'].forEach(id=>$(id).classList.add('hidden'));visiblePanel(true)}
$('v42-tab').addEventListener('click',switchToNew);
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{$('v42-panel').classList.add('hidden');$('v42-tab').classList.remove('active');active=false}));
document.querySelector('[data-tab="history"]')?.addEventListener('click',()=>{renderNewHistory();if(user)refresh()});
historyArea()?.addEventListener('click',historyClicks);
$('v42-export')?.addEventListener('click',exportEvolution);
$('v42-history-reload')?.addEventListener('click',()=>{if(user)refresh()});
function nextCode(){const order=(version?.snapshot?.sessions||[]).map(x=>x.code);if(!order.length)return '';let recent=sessions.filter(x=>x.plan_version_id===version.id&&['done','skipped'].includes(x.status)).sort((a,b)=>a.performed_on.localeCompare(b.performed_on)||a.created_at.localeCompare(b.created_at));let last=recent.at(-1);return last&&order.includes(last.session_code)?order[(order.indexOf(last.session_code)+1)%order.length]:order[0]}
function planAvailable(){return !!version&&version.status==='published'&&version.effective_date<=dateNow()}
async function readData(){if(!sb||!user)return;loadError='';let [p,s,c]=await Promise.all([
 sb.from('hw41_plans').select('id,owner_id,name,objective,current_version_id').eq('owner_id',user.id).order('created_at',{ascending:false}),
 sb.from('hw41_sessions').select('*').eq('owner_id',user.id).order('performed_on',{ascending:false}).limit(1000),
 sb.from('hw41_cardio').select('*').eq('owner_id',user.id).order('performed_on',{ascending:false}).limit(300)]);
 for(let r of [p,s,c])if(r.error)throw r.error;
 sessions=s.data||[];cardio=c.data||[];let list=p.data||[];let chosen=list.find(x=>x.current_version_id)||null;
 // Never activate a draft: current_version_id is controlled by guard trigger.
 plan=chosen;version=null;
 if(chosen){let v=await sb.from('hw41_plan_versions').select('id,plan_id,version_number,status,snapshot,effective_date').eq('id',chosen.current_version_id).maybeSingle();if(v.error)throw v.error;version=v.data||null;if(!version||version.status!=='published')version=null}
 ready=true;render();renderNewHistory();}
function render(){if(!active)return;const body=$('v42-body');if(!user){$('v42-title').textContent='Faz login para carregar a ficha';$('v42-subtitle').textContent='';body.innerHTML='<div class="notice">Entra com tua conta para acessar a ficha publicada. No modo demonstração, utiliza os treinos A–G.</div>';return}
 if(loadError){$('v42-title').textContent='Não foi possível carregar';body.innerHTML='<div class="notice">'+esc(loadError)+'</div><button class="secondary" id="v42-retry">Tentar novamente</button>';body.querySelector('#v42-retry').onclick=refresh;return}
 if(!ready){$('v42-title').textContent='Carregando planos...';body.innerHTML='<p class="hint">Consultando tuas fichas no Supabase.</p>';return}
 if(!planAvailable()){$('v42-title').textContent=plan&&version?'Plano publicado para uma data futura':'Nenhum plano ativo ainda';$('v42-subtitle').textContent=plan&&version?'Início previsto: '+version.effective_date:'Se já utilizaste a ficha A–G, seus registros continuam preservados.';body.innerHTML='<div class="notice">A nova ficha só começa quando for <strong>publicada</strong> no editor e sua data de início chegar. Enquanto isso, podes continuar usando o treino A–G, se ele já fazia parte da tua rotina. Novos usuários podem criar sua primeira ficha no editor.</div><div class="actions"><a class="outline" href="planos.html">Abrir editor e importar ficha do ChatGPT</a></div>';return}
 $('v42-title').textContent=plan.name+' · versão '+version.version_number;$('v42-subtitle').textContent='Ativo desde '+version.effective_date+' · ABC contínuo e outras divisões personalizadas';
 const code=nextCode();let current=version.snapshot.sessions.find(x=>x.code===code)||version.snapshot.sessions[0];
 if(!current){body.innerHTML='<p class="notice">A versão publicada não contém sessões válidas.</p>';return}
 const actual=draft?.code===code&&draft?.date===dateNow()?draft:null;
 let html='<div class="notice"><strong>Próximo da sequência: '+esc(current.code)+' — '+esc(current.name)+'</strong><div class="hint">A fila avança somente quando concluis ou pulas uma sessão. Descansar não avança.</div></div>';
 html+='<div class="grid" style="margin-top:14px"><div class="input"><label>Data</label><input type="date" id="v42-day" value="'+esc(actual?.date||dateNow())+'"></div><div class="input"><label>Treino</label><select id="v42-code">'+version.snapshot.sessions.map(x=>'<option value="'+esc(x.code)+'" '+(x.code===code?'selected':'')+'>'+esc(x.code+' — '+x.name)+'</option>').join('')+'</select></div></div>';
 html+='<div id="v42-exlist"></div><div class="panel" style="padding:12px;margin-top:14px"><label class="hint">Observações da sessão</label><textarea id="v42-notes" maxlength="2000" placeholder="Como foi o esforço e a recuperação?"></textarea><div class="actions"><button class="primary" id="v42-finish">Concluir sessão</button><button class="secondary" id="v42-save">Salvar rascunho</button><button class="outline" id="v42-skip">Pular próxima sessão</button></div></div>';
 html+='<div class="sep"></div><h3 class="heading">🚴 Bicicleta independente</h3><p class="hint">Podes registrar a bike de manhã e a musculação à noite, sem duplicar o treino.</p><div class="grid"><div class="input"><label>Data da bike</label><input type="date" id="v42-bike-day" value="'+dateNow()+'"></div><div class="input"><label>Minutos</label><input type="number" min="1" max="360" value="20" id="v42-bike-min"></div><div class="input"><label>Intensidade</label><select id="v42-bike-int"><option value="light">Leve</option><option value="moderate">Moderada</option><option value="intense">Intensa</option></select></div><div class="input"><label>Observações</label><input id="v42-bike-notes" maxlength="250" placeholder="Opcional"></div></div><div class="actions"><button class="secondary" id="v42-bike-save">Registrar bicicleta</button></div>';
 html+='<div id="v42-message" class="confirm" aria-live="polite"></div><p class="hint" style="margin-top:12px">As sessões realizadas e a bicicleta ficam na aba <strong>Histórico</strong>.</p>';
 body.innerHTML=html;const day=$('v42-day');day.addEventListener('change',loadSelected);$('v42-code').addEventListener('change',loadSelected);
 $('v42-finish').onclick=()=>saveSession('done');$('v42-save').onclick=()=>saveSession('draft');$('v42-skip').onclick=skipSession;$('v42-bike-save').onclick=saveBike;
 loadSelected();}
function fmtDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return String(v||'');const [y,m,d]=v.split('-');return d+'/'+m+'/'+y}
function renderNewHistory(){const target=historyArea();if(!target)return;if(!user){target.innerHTML='<p class="hint">Entra com tua conta para visualizar os registros dos planos personalizados.</p>';return}
 if(loadError){target.innerHTML='<p class="notice">Não foi possível carregar o histórico: '+esc(loadError)+'</p>';return}
 if(!ready){target.innerHTML='<p class="hint">Carregando histórico da nuvem...</p>';return}
 const items=[...sessions.map(x=>({...x,_type:'strength'})),...cardio.map(x=>({...x,_type:'bike'}))].sort((a,b)=>String(b.performed_on||'').localeCompare(String(a.performed_on||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
 if(!items.length){target.innerHTML='<p class="notice">Nenhum treino dos planos personalizados registrado ainda.</p>';return}
 const status={done:'Concluído',draft:'Rascunho',skipped:'Pulado'};
 target.innerHTML=items.map(x=>{
 if(x._type==='bike')return '<div class="historyItem"><div class="split" style="flex-wrap:wrap"><div><strong>'+esc(fmtDate(x.performed_on))+' · Bicicleta</strong><div class="hint">'+Number(x.minutes||0)+' min · '+esc(({light:'leve',moderate:'moderada',intense:'intensa'})[x.intensity]||x.intensity||'')+'</div></div><button type="button" class="outline" data-cardiodel="'+esc(x.id)+'">Excluir</button></div>'+(x.notes?'<p class="hint">'+esc(x.notes)+'</p>':'')+'</div>';
 const e=x.execution||{};const exercises=Array.isArray(e.exercises)?e.exercises:[];const completed=exercises.reduce((n,ex)=>n+(Array.isArray(ex.sets)?ex.sets.filter(z=>z.done).length:0),0);
 const details=exercises.map(ex=>'<div style="padding:8px 0;border-bottom:1px solid #ffffff13"><strong>'+esc(ex.name)+'</strong><div class="hint">'+(ex.sets||[]).map((z,j)=>(j+1)+'ª: '+esc(z.reps||'—')+' reps'+(z.kg!==''&&z.kg!=null?' · '+esc(z.kg)+' kg':'')+(z.done?' ✓':'')).join(' · ')+'</div></div>').join('');
 return '<div class="historyItem"><div class="split" style="flex-wrap:wrap"><div><strong>'+esc(fmtDate(x.performed_on))+' · '+esc(e.planName||'Plano personalizado')+' · '+esc(x.session_code||'')+'</strong><div class="hint">'+esc(status[x.status]||x.status||'')+' · '+completed+' séries concluídas'+(e.planVersion?' · Versão '+esc(e.planVersion):'')+'</div></div><div class="actions" style="margin-top:0"><button type="button" class="secondary" data-hwedit="'+esc(x.id)+'">Editar</button><button type="button" class="outline" data-hwdel="'+esc(x.id)+'">Excluir</button></div></div><details style="margin-top:10px"><summary class="hint" style="cursor:pointer">Ver exercícios, séries e cargas</summary>'+details+(e.notes?'<p class="hint">Observações: '+esc(e.notes)+'</p>':'')+'</details></div>';
 }).join('');}
function findPrior(name,loadMode){const key=String(name||'').trim().toLocaleLowerCase('pt-BR');for(const sess of sessions.filter(x=>x.status==='done').sort((a,b)=>b.performed_on.localeCompare(a.performed_on))){const ex=(sess.execution?.exercises||[]).find(e=>String(e.name||'').trim().toLocaleLowerCase('pt-BR')===key&&e.loadMode===loadMode);if(ex){const good=(ex.sets||[]).filter(s=>s.done);if(good.length)return good}}return null}
function exRows(s,old){let all=allExercises(s);return all.map((ex,i)=>{let sets=old?.exercises?.[i]?.name===ex.name?old.exercises[i].sets:null;let prev=findPrior(ex.name,ex.loadMode)||[];let out='<div class="exercise"><strong>'+esc(ex.name)+'</strong> <span class="pill">'+esc(loadName(ex.loadMode))+'</span><p class="hint">'+Number(ex.sets)+' séries × '+esc(ex.reps)+' · '+Number(ex.restSeconds||0)+'s descanso · carga sugerida '+(ex.loadKg==null?'a definir':esc(ex.loadKg)+' kg')+'</p>';
 out+='<div class="sethead"><span>#</span><span>Reps / seg</span><span>Kg</span><span>✓</span></div>';
 for(let j=0;j<Number(ex.sets||0);j++){const prior=sets?.[j]||prev[j]||prev.at(-1);const defaultReps=String(ex.reps||'').match(/\d+/)?.[0]||'';const reps=sets?.[j]?.reps??(prior?.reps??defaultReps);const kg=ex.loadMode==='none'?'':(sets?.[j]?.kg??prior?.kg??ex.loadKg??'');const done=sets?.[j]?.done||false;
 out+='<div class="setrow"><span>'+String(j+1)+'</span><input inputmode="numeric" type="number" min="0" max="999" data-ii="'+i+'" data-jj="'+j+'" data-field="reps" value="'+esc(reps)+'"><input type="number" inputmode="decimal" min="0" max="500" step="0.25" data-ii="'+i+'" data-jj="'+j+'" data-field="kg" value="'+esc(kg)+'" '+(ex.loadMode==='none'?'disabled':'')+'><input type="checkbox" aria-label="Série concluída" data-ii="'+i+'" data-jj="'+j+'" data-field="done" '+(done?'checked':'')+'></div>';
 }return out+'</div>'}).join('')}
function loadSelected(){const code=$('v42-code')?.value,day=$('v42-day')?.value;const ss=version?.snapshot?.sessions?.find(x=>x.code===code);if(!ss||!/^\d{4}-\d{2}-\d{2}$/.test(day))return;
 let previous=sessions.find(x=>x.performed_on===day&&x.session_code===code&&x.plan_version_id===version.id);draft={code,date:day,id:previous?.id||null,previous};$('v42-exlist').innerHTML=exRows(ss,previous?.execution);$('v42-notes').value=previous?.execution?.notes||'';
}
function getExecution(){const s=version.snapshot.sessions.find(x=>x.code===$('v42-code').value),exercises=allExercises(s).map((ex,i)=>({name:ex.name,loadMode:ex.loadMode,restSeconds:ex.restSeconds,repsTarget:ex.reps,sets:Array.from({length:ex.sets},(_,j)=>{const find=field=>$('v42-exlist').querySelector(`[data-ii="${i}"][data-jj="${j}"][data-field="${field}"]`);return {reps:find('reps').value,kg:ex.loadMode==='none'?'':find('kg').value,done:find('done').checked}})}));return {title:s.name,exercises,notes:$('v42-notes').value.slice(0,2000),planName:plan.name,planVersion:version.version_number}}
async function saveSession(status){if(!planAvailable())return;const code=$('v42-code').value,day=$('v42-day').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<version.effective_date)return announce('A data deve ser válida e estar dentro da vigência do plano.',true);
 const exec=getExecution();if(status==='done'&&exec.exercises.some(ex=>ex.sets.some(s=>!s.done))&&!confirm('Há séries não marcadas. Desejas concluir mesmo assim?'))return;
 if(status==='done'&&sessions.some(x=>x.performed_on===day&&x.status==='done'&&x.id!==draft.id)&&!confirm('Já existe treino concluído nessa data. Desejas registrar outro?'))return;
 try{const payload={owner_id:user.id,plan_version_id:version.id,session_code:code,performed_on:day,status,execution:exec,updated_at:new Date().toISOString()};const r=draft?.id?await sb.from('hw41_sessions').update(payload).eq('id',draft.id).eq('owner_id',user.id).select().single():await sb.from('hw41_sessions').insert(payload).select().single();if(r.error)throw r.error;await readData();announce('✓ Sessão '+(status==='done'?'concluída':'salva como rascunho')+' na nuvem.');}catch(e){announce('Falha ao salvar: '+e.message,true)}}
async function skipSession(){if(!confirm('Pular a próxima sessão e avançar a sequência? Usa descanso quando não quiser avançar.'))return;const code=nextCode();try{const r=await sb.from('hw41_sessions').insert({owner_id:user.id,plan_version_id:version.id,session_code:code,performed_on:dateNow(),status:'skipped',execution:{title:'Sessão pulada',exercises:[]}});if(r.error)throw r.error;await readData();announce('Sessão '+code+' pulada.');}catch(e){announce('Falha: '+e.message,true)}}
async function saveBike(){let minutes=Number($('v42-bike-min').value),performed_on=$('v42-bike-day').value,intensity=$('v42-bike-int').value,notes=$('v42-bike-notes').value;if(!Number.isInteger(minutes)||minutes<1||minutes>360||!/^\d{4}-\d{2}-\d{2}$/.test(performed_on))return announce('Confere os minutos e a data da bicicleta.',true);try{let r=await sb.from('hw41_cardio').insert({owner_id:user.id,performed_on,minutes,intensity,modality:'bike',notes});if(r.error)throw r.error;await readData();announce('✓ Bicicleta registrada separadamente na nuvem.')}catch(e){announce('Falha ao registrar bicicleta: '+e.message,true)}}
async function historyClicks(e){let b=e.target.closest('button');if(!b)return;let id=b.dataset.hwedit||b.dataset.hwdel||b.dataset.cardiodel;if(!id)return;
 if(b.dataset.hwedit){let row=sessions.find(x=>x.id===id);if(!row)return; if(!planAvailable()||row.plan_version_id!==version.id){alert('Registro de uma versão anterior. A consulta está disponível aqui; a edição dessa versão ainda não foi habilitada.');return} switchToNew();$('v42-day').value=row.performed_on;$('v42-code').value=row.session_code;loadSelected();$('v42-panel').scrollIntoView({behavior:'smooth',block:'start'});return}
 if(!confirm('Excluir este registro da nuvem? Esta ação não pode ser desfeita.'))return;try{let table=b.dataset.cardiodel?'hw41_cardio':'hw41_sessions';let r=await sb.from(table).delete().eq('id',id).eq('owner_id',user.id);if(r.error)throw r.error;await readData();announce('Registro excluído.')}catch(err){announce('Falha: '+err.message,true)}}
async function exportEvolution(){
 if(!user||!sb){alert('Entra na tua conta para baixar o relatório completo.');return}
 const button=$('v42-export');const oldLabel=button?.textContent;
 if(button){button.disabled=true;button.textContent='Preparando relatório...'}
 try{
  // Read the legacy data from this authenticated account, rather than localStorage.
  // The legacy account uses one JSONB payload per auth.uid(). RLS keeps accounts separate.
  const {data:legacy,error}=await sb.from('training_profiles')
      .select('payload').eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  const prior=legacy?.payload||{};
  const oldEntries=Object.values(prior.entries||{}).filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')&&['done','draft','skipped'].includes(x.status));
  const priorDates=oldEntries.filter(x=>x.status==='done').map(x=>x.date).sort();
  const legacyDefs=window.HW42_LEGACY_DEFS||{};
  const adaptation=oldEntries.map(r=>{
   const def=legacyDefs[r.kind]||{};
   const exercises=(def.ex||[]).map((ex,i)=>({name:ex[0],loadMode:ex[4],restSeconds:ex[3],sets:(r.sets?.[i]||[]).map((set,j)=>({number:j+1,reps:set.reps??'',kg:set.kg??'',done:Boolean(set.done)}))}));
   return {date:r.date,code:r.kind,sessionName:def.title||r.kind,status:r.status,exercises,cardioMinutes:Number(r.bike||0)||0,notes:r.notes||''};
  }).sort((a,b)=>a.date.localeCompare(b.date));
  const custom=sessions.map(x=>({date:x.performed_on,code:x.session_code,status:x.status,planName:x.execution?.planName||'',version:x.execution?.planVersion||null,exercises:(x.execution?.exercises||[]).map(e=>({name:e.name,loadMode:e.loadMode,restSeconds:e.restSeconds,sets:(e.sets||[]).map((s,j)=>({number:j+1,reps:s.reps,kg:s.kg,done:Boolean(s.done)}))})),notes:x.execution?.notes||''})).sort((a,b)=>a.date.localeCompare(b.date));
  const data={format:'home-workout-evolution',schemaVersion:2,exportedAt:new Date().toISOString(),
   scope:'Conta autenticada — treino de adaptação e planos personalizados',
   adaptation:{name:'Treino de Adaptação',division:'A–G',startDate:priorDates[0]||null,lastCompletedDate:priorDates.at(-1)||null,executions:adaptation},
   customPlans:{executions:custom,cardio:cardio.map(x=>({date:x.performed_on,minutes:Number(x.minutes||0),intensity:x.intensity,notes:x.notes||''})).sort((a,b)=>a.date.localeCompare(b.date))},
   bodyMeasurements:(prior.bodyMetrics||[]).filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')).map(x=>({...x})),
   summary:{adaptationCompleted:adaptation.filter(x=>x.status==='done').length,customCompleted:custom.filter(x=>x.status==='done').length,customCardioSessions:cardio.length},
   notes:['Não inclui e-mail, senhas ou identificadores de login.','Cargas e repetições são registros realizados, não novas prescrições.','As datas de início da Adaptação são inferidas do primeiro treino concluído, não necessariamente da estreia do plano.']};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='home-workout-evolucao-completa-'+dateNow()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 }catch(e){alert('Não foi possível gerar o relatório completo. Nenhum arquivo parcial foi exportado. '+e.message)}
 finally{if(button){button.disabled=false;button.textContent=oldLabel}}
}
async function refresh(){if(!user)return;ready=false;if(active)render();if(historyVisible())renderNewHistory();try{await readData()}catch(e){loadError=e.message;ready=true;render();renderNewHistory()}}
// New Supabase client shares the same account session using the standard persisted auth storage.
async function init(){if(!window.supabase||!cfg.url||!cfg.key)return;sb=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true}});const initAuth=async()=>{const r=await sb.auth.getUser();const newUser=r.data?.user||null;if(newUser?.id!==user?.id){user=newUser;sessions=[];cardio=[];plan=null;version=null;ready=false;if(user)await refresh();else{render();renderNewHistory()}}};
 await initAuth();sb.auth.onAuthStateChange((_event,session)=>{const id=session?.user?.id||null;if(id!==(user?.id||null)){user=session?.user||null;sessions=[];cardio=[];plan=null;version=null;ready=false;if(user)setTimeout(refresh,0);else{render();renderNewHistory()}}});
 if(user&&planAvailable())switchToNew();else{visiblePanel(false);$('v42-panel').classList.add('hidden');const legacy=document.querySelector('[data-tab="train"]');if(legacy)legacy.classList.add('active')}
}
// Update notifier; avoid interrupting a workout mid-series.
function configureUpdates(){if(!('serviceWorker' in navigator))return;let waiting=null,updateRequested=false;
 function promptUpdate(reg){if(!reg.waiting)return;waiting=reg.waiting;$('v42-update').classList.remove('hidden')}
 navigator.serviceWorker.register('./sw.js').then(reg=>{if(reg.waiting)promptUpdate(reg);reg.addEventListener('updatefound',()=>{let w=reg.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)promptUpdate(reg)})});document.addEventListener('visibilitychange',()=>{if(!document.hidden)reg.update().catch(()=>{})});window.addEventListener('online',()=>reg.update().catch(()=>{}));reg.update().catch(()=>{})}).catch(()=>{});
 $('v42-update-now').onclick=()=>{if(waiting){updateRequested=true;waiting.postMessage({type:'SKIP_WAITING'})}else location.reload()};
 let switching=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested&&!switching){switching=true;location.reload()}})
}
window.addEventListener('DOMContentLoaded',()=>{configureUpdates();init().catch(e=>{loadError=e.message;render()})});
})();
