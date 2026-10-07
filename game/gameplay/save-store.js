/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {validateHistoryExperience} from './experience-rules.js';
import {normalizeRecords,recoverRecords} from './records.js';
import {touchSettings} from './touch-controls.js';
import {copyAllies} from './snapshot-fields.js';
import {initialSave,META} from './data.js';
import {restoreRun} from './run-factory.js';
import {normalizeGarden} from './expedition-data.js';
export const MAX_SAVE_IMPORT_BYTES=8*1024*1024;
export const SAVE_KEY='fanren-qingzhu-v1',BACKUP_KEY=SAVE_KEY+'-backup',RAW_BACKUP_KEY=SAVE_KEY+'-unreadable',JOURNAL_KEY=SAVE_KEY+'-backup-journal';
export class SaveError extends Error{constructor(code,message,options){super(message,options);this.code=code;}}
// Isolated raw records: bounded, deduplicated by full text, still exportable and restorable from settings.
export const RAW_RECORD_LIMIT=12;
export function rawHash(text){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<text.length;i++){const ch=text.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507);h1^=Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507);h2^=Math.imul(h1^(h1>>>13),3266489909);return (h2>>>0).toString(16).padStart(8,'0')+(h1>>>0).toString(16).padStart(8,'0');}
export function appendRawRecord(records,raw,savedAt=Date.now()){if(typeof raw!=='string'||records.some(r=>r.raw===raw))return records;if(records.length>=RAW_RECORD_LIMIT)throw new SaveError('raw-capacity','隔离原文已满 12 份，本次覆盖已停止；请先导出原始记录，再在设置中确认清理隔离原文');records.push({raw,savedAt,hash:rawHash(raw)});return records;}
const validHistory=h=>h&&Number.isFinite(h.time)&&Number.isFinite(h.kills)&&Number.isFinite(h.path);
export const keptHistory=list=>list.filter(validHistory).slice(0,30);
export const historyDropCount=x=>Array.isArray(x?.history)?x.history.length-keptHistory(x.history).length:0;
// A-10: completed endless loops of a continuing run must agree with this device's retained best entry of the same run.
// Detection needs that witness; a run whose entry was superseded by a better run in the same group has none.
function validateCheckpointRecords(c,records){const ex=c?.expedition,state=ex?.recordState;if(!ex||c.options?.mode!=='endless'||c.options.recordVersion!==1||![1,2].includes(c.options.challengeVersion)||!state?.eligibleStart||!(state.completedLoops>0))return;
 const choices=(ex.challenges||[]).map(p=>p.choice);
 for(const r of records.entries){if(r.runId!==ex.runId||r.mode!=='endless'||r.challengeVersion!==c.options.challengeVersion)continue;const expected=choices.slice(0,r.loops);if(expected.length!==r.loops||r.challengeChoices.some((v,i)=>v!==expected[i]))throw new SaveError('invalid','续玩的已完成圈挑战选择与本机成绩不符');}
}
export function readableSaveError(error){
 if(error instanceof SyntaxError)return '存档 JSON 格式不完整或无法解析';
 const message=typeof error?.message==='string'?error.message:'';
 return /[\u3400-\u9fff]/.test(message)?message.slice(0,160).replace(/，原记录未被修改$/,''):'存档内容无法识别';
}
export function normalizeSave(x){
 if(!x||x.version!==1||!Array.isArray(x.meta)||!Array.isArray(x.history))throw new SaveError('invalid','存档格式无法识别');
 const base=initialSave(),allowed=['version','unlocked','insight','meta','metaRulesVersion','seen','relicSeen','wins','runs','kills','best','achievements','history','records','checkpoint','settings','keymap','garden','completed','guidesSeen','savedAt','revision'],known=Object.fromEntries(allowed.filter(k=>k in x).map(k=>[k,x[k]])),out={...base,...known,settings:{...base.settings,...x.settings}};out.metaRulesVersion=x.metaRulesVersion??(x.meta.length?1:3);if(![1,2,3].includes(out.metaRulesVersion))throw new SaveError('invalid','洞府规则版本无法识别');
 for(const key of ['insight','unlocked','wins','runs','kills','best'])if(!Number.isSafeInteger(out[key])||out[key]<0||out[key]>1e12)throw new SaveError('invalid','存档数值无效');
 if(!Number.isInteger(out.unlocked)||out.unlocked>5||out.best>72)throw new SaveError('invalid','存档章节无效');
 out.meta=[...new Set(x.meta.filter(id=>META.some(m=>m.id===id)))];out.history=keptHistory(x.history);for(const h of out.history)validateHistoryExperience(h);
 for(const key of ['seen','relicSeen','achievements','completed','guidesSeen'])out[key]=Array.isArray(x[key])?x[key].filter(v=>typeof v==='string'||Number.isFinite(v)):[];
 for(const key of ['music','sfx'])out.settings[key]=Number.isFinite(out.settings[key])?Math.max(0,Math.min(1,out.settings[key])):base.settings[key];
 for(const key of ['shake','flash','numbers','skipSeenCinematics','endlessSkipSeen','skipSeenAfterWin'])out.settings[key]=typeof out.settings[key]==='boolean'?out.settings[key]:base.settings[key];out.settings.quality=out.settings.quality===0?0:1;Object.assign(out.settings,touchSettings(out.settings));
 for(const k of ['revision','savedAt'])if(out[k]!==undefined&&(!Number.isSafeInteger(out[k])||out[k]<0||out[k]>1e15))throw new SaveError('invalid','存档时间或修订记录无效');
 const defaults={dash:'Space',thunder:'KeyE',formation:'KeyQ',item1:'Digit1',item2:'Digit2'};if(x.keymap){if(typeof x.keymap!=='object'||Array.isArray(x.keymap))throw new SaveError('invalid','存档键位无效');const keys={...defaults,...Object.fromEntries(Object.keys(defaults).filter(k=>k in x.keymap).map(k=>[k,x.keymap[k]]))};if(Object.values(keys).some(v=>typeof v!=='string'||!/^[A-Za-z][A-Za-z0-9]{0,30}$/.test(v)))throw new SaveError('invalid','存档键位无效');out.keymap=keys;}
 out.records=normalizeRecords(x.records);out.garden=normalizeGarden(x.garden);if(out.checkpoint){if(out.checkpoint.options?.studyVersion)throw Error('观察包只能从对照体验入口恢复，不能覆盖正式存档');restoreRun(out.checkpoint,()=>{});validateCheckpointRecords(out.checkpoint,out.records);if(out.checkpoint.options?.rulesVersion===3){const c=out.checkpoint,ex=c.expedition;out.checkpoint={...c,expedition:{...ex,insects:copyAllies(ex.insects,'insect'),puppets:copyAllies(ex.puppets,'puppet')}};}}return out;
}
const removeKey=(storage,key)=>typeof storage.removeItem==='function'?storage.removeItem(key):storage.setItem(key,'');
const validJournal=j=>j&&[BACKUP_KEY,RAW_BACKUP_KEY].includes(j.key)&&typeof j.after==='string'&&typeof j.primaryAfter==='string'&&(j.before===null||typeof j.before==='string');
const parseOrNull=raw=>{try{return JSON.parse(raw);}catch{return null;}};
const readableProfile=raw=>{try{return raw?normalizeSave(JSON.parse(raw)):null;}catch{return null;}};
export function recoveryPreview(raw){
 const empty={raw,save:null,status:'仅可导出',discarded:[],recordReport:null,historyDropped:0};
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_SAVE_IMPORT_BYTES)return {...empty,status:'未知格式',reason:'原文为空或超过 8 MiB'};
 const input=parseOrNull(raw);if(!input)return {...empty,reason:'JSON 无法解析'};
 if(input.kind==='qingzhu-active-study'||input.options?.studyVersion||input.checkpoint?.options?.studyVersion)return {...empty,status:'观察资料',reason:'观察包只能在对照体验入口恢复，不转换为正式进度'};
 try{return {...empty,save:normalizeSave(input),status:'完整可读',historyDropped:historyDropCount(input)};}catch{}
 if(input.version!==1)return {...empty,status:'未知格式',reason:'未知存档版本，不转换字段'};
 const recovered=recoverRecords(input.records),recordsInvalid=(()=>{try{normalizeRecords(input.records);return false;}catch{return true;}})();
 for(const dropCheckpoint of [false,true]){try{
  const save=normalizeSave({...input,records:recovered.records,...(dropCheckpoint?{checkpoint:null}:{})});
  return {...empty,save,status:'可恢复长期进度',discarded:[...(recordsInvalid?['records']:[]),...(dropCheckpoint&&input.checkpoint?['checkpoint']:[])],recordReport:recordsInvalid?recovered.report:null,historyDropped:historyDropCount(input)};
 }catch{}}
 return {...empty,reason:'长期进度也未通过校验，保留原文供导出'};
}
// Accept this product's exports and historical naked/raw wrappers, without any writes.
export function recoveryImportCandidates(raw){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_SAVE_IMPORT_BYTES)throw new SaveError('invalid','恢复资料超过 8 MiB');
 const out=[],seen=new Set();let count=0;
 const add=(text,label,depth=0)=>{if(text===null||text===undefined)return;if(typeof text!=='string'||depth>8||++count>512)throw new SaveError('invalid','恢复资料结构或条目数量无效');const x=parseOrNull(text);
  if(['fanren-recovery-records','fanren-preserved-state'].includes(x?.format)){
   if(x.records!==undefined&&(!Array.isArray(x.records)||x.records.some(r=>!r||typeof r.raw!=='string')))throw new SaveError('invalid','恢复资料中的原文条目无效');
   add(x.primary,label+' · 主记录',depth+1);if(x.backup){const backup=parseOrNull(x.backup);add(typeof backup?.raw==='string'?backup.raw:x.backup,label+' · 备份',depth+1);}
   if(x.pendingBackup){const j=parseOrNull(x.pendingBackup);for(const k of ['before','after','primaryAfter'])if(typeof j?.[k]==='string')add(j[k],label+' · 中断记录 '+k,depth+1);}
   for(const [i,r] of (x.records||[]).entries())add(r.raw,label+' · 保护记录 '+(i+1),depth+1);return;
  }
  if(x?.version!==1&&typeof x?.raw==='string'){add(x.raw,label,depth+1);return;}
  if(x?.version!==1&&Array.isArray(x?.records)&&x.records.every(r=>r&&typeof r.raw==='string')){for(const [i,r]of x.records.entries())add(r.raw,label+' '+(i+1),depth+1);return;}
  if(seen.has(text))return;seen.add(text);out.push({id:'import-'+out.length,label,...recoveryPreview(text)});
 };
 add(raw,'导入记录');return out;
}
export class SaveVault{
 constructor(storage){this.storage=storage;this.expectedRaw=undefined;this.corrupt=false;this.recoveryIssue=null;this.recoverySnapshot=null;this.owner=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
 snapshot(){return {primary:this.storage.getItem(SAVE_KEY),backup:this.storage.getItem(BACKUP_KEY),journal:this.storage.getItem(JOURNAL_KEY),unreadable:this.storage.getItem(RAW_BACKUP_KEY)};}
 inspectRecovery(){
  const state=this.snapshot(),badJournal=!!state.journal&&!validJournal(parseOrNull(state.journal)),orphan=!state.primary&&state.backup!==null;
  this.recoveryIssue=badJournal?'备份恢复记录待处理':orphan?'主记录未找到，仍有备份待处理':state.primary!==null&&!readableProfile(state.primary)?'旧存档待恢复，当前未载入':null;
  this.recoverySnapshot=this.recoveryIssue?state:null;return this.recoveryIssue;
 }
 recoveryCandidates(){
  const s=this.snapshot(),out=[];
  const add=(raw,label,id)=>{if(typeof raw==='string')out.push({id,label,...recoveryPreview(raw),expectedSnapshot:s});};
  add(s.primary,'当前主记录','primary');const journal=parseOrNull(s.journal),backupRaw=validJournal(journal)&&journal.key===BACKUP_KEY&&s.primary!==journal.primaryAfter?journal.before:s.backup;add(parseOrNull(backupRaw)?.raw,'上次备份','backup');
  if(validJournal(journal)){add(journal.primaryAfter,'中断写入的待提交主记录','pending-primary');add(parseOrNull(journal.after)?.raw,'中断写入的备份候选','pending-backup');}
  for(const [i,record] of this.rawRecords().entries()){
   let candidates;try{candidates=recoveryImportCandidates(record.raw);}catch{candidates=[recoveryPreview(record.raw)];}
   for(const [j,c] of candidates.entries())add(c.raw,c.label?.endsWith(' · 备份')?'受保护的旧备份':c.label?.endsWith(' · 主记录')?'受保护的旧主记录':'受保护的旧记录 '+(i+1)+' / '+(j+1),'protected-'+i+'-'+j);
  }return out;
 }
 resolveRecovery(input){
  if(!this.recoveryIssue||!this.recoverySnapshot)throw new SaveError('storage','没有待处理的恢复记录，请重新载入');
  return this.adoptRecovery(input,{expectedSnapshot:this.recoverySnapshot});
 }
 adoptRecovery(input,{expectedSnapshot,sourceRaw}={}){
  const next=normalizeSave(input),before=expectedSnapshot||this.snapshot(),signature=JSON.stringify([before,sourceRaw,next]);
  // Retry accepts only the exact bytes written by this in-memory recovery attempt.
  // Every write (including commit rollback) checks all four slots before and after.
  const attempt=this.recoveryAttempt?.signature===signature?this.recoveryAttempt:{signature,snapshot:{...before},protected:false};
  const storage=this.storage,read=()=>({primary:storage.getItem(SAVE_KEY),backup:storage.getItem(BACKUP_KEY),journal:storage.getItem(JOURNAL_KEY),unreadable:storage.getItem(RAW_BACKUP_KEY)});
  // A preview taken before a later write by this same page is stale, not a cross-window conflict: disk primary is still exactly what this page wrote.
  // Only that case is reclassified; any other change (including another window touching backup, journal or quarantine) stays a hard conflict.
  if(before.primary!==this.expectedRaw)throw read().primary===this.expectedRaw?new SaveError('stale-preview','预览之后本页已保存过新的记录，请重新查看并确认'):new SaveError('conflict','主记录已变化，请重新载入');
  const check=()=>{if(JSON.stringify(read())!==JSON.stringify(attempt.snapshot))throw new SaveError('conflict','恢复资料已被另一窗口更改，请重新载入');};
  check();this.recoveryAttempt=attempt;
  const keys={[SAVE_KEY]:'primary',[BACKUP_KEY]:'backup',[JOURNAL_KEY]:'journal',[RAW_BACKUP_KEY]:'unreadable'};
  const write=(key,value,remove=false)=>{check();if(remove)removeKey(storage,key);else storage.setItem(key,value);attempt.snapshot[keys[key]]=remove?(typeof storage.removeItem==='function'?null:''):value;check();};
  this.storage={getItem:key=>storage.getItem(key),setItem:(key,value)=>write(key,value),removeItem:key=>write(key,null,true)};
  try{
   if(!attempt.protected){
    const raw=before.backup!==null||before.journal!==null?JSON.stringify({format:'fanren-preserved-state',primary:before.primary,backup:before.backup,pendingBackup:before.journal}):before.primary,records=this.rawRecords();
    appendRawRecord(records,raw);appendRawRecord(records,sourceRaw);
    this.storage.setItem(RAW_BACKUP_KEY,JSON.stringify({records}));attempt.protected=true;
   }
   if(attempt.snapshot.journal)removeKey(this.storage,JOURNAL_KEY);
   this.recoveryIssue=null;this.recoverySnapshot=null;
   const result=this.commit(next,{backup:true,allowCorrupt:true});this.recoveryAttempt=null;return result;
  }catch(error){
   try{this.inspectRecovery();}catch{}if(error instanceof SaveError)throw error;
   throw new SaveError('storage','恢复处理未完成，原记录与已保护前态仍保留，请重试或导出',{cause:error});
  }finally{this.storage=storage;}
 }
 recoverBackup(allowBusy=false){
  const raw=this.storage.getItem(JOURNAL_KEY);if(!raw)return true;let j;try{j=JSON.parse(raw);}catch{throw new SaveError('storage','备份恢复记录无法读取，请先导出恢复记录');}
  if(!validJournal(j))throw new SaveError('storage','备份恢复记录无效，请先导出恢复记录');
  const primary=this.storage.getItem(SAVE_KEY),current=this.storage.getItem(j.key);
  if(primary!==j.primaryAfter&&j.owner!==this.owner&&Date.now()-(j.createdAt||0)<5000){if(allowBusy)return false;throw new SaveError('busy','备份恢复仍在保护等待中，请稍后重试；可能是页面刚刷新或另一个页面尚未保存完毕');}
  if(primary!==j.primaryAfter){if(current===j.after){if(j.before===null)removeKey(this.storage,j.key);else this.storage.setItem(j.key,j.before);}else if(current!==j.before)throw new SaveError('conflict','备份已被其他页面更改，请先导出恢复记录');}
  removeKey(this.storage,JOURNAL_KEY);return true;
 }
 previewLatest(){const expectedSnapshot=this.snapshot();return {...recoveryPreview(expectedSnapshot.primary),expectedSnapshot};}
 loadConfirmed(expectedSnapshot){if(JSON.stringify(this.snapshot())!==JSON.stringify(expectedSnapshot))throw new SaveError('stale-preview','磁盘记录已变化，请重新核对当前与目标记录');return this.load();}
 load(){try{this.expectedRaw=this.storage.getItem(SAVE_KEY);const journal=this.storage.getItem(JOURNAL_KEY);if(!journal||validJournal(parseOrNull(journal)))this.recoverBackup(true);this.expectedRaw=this.storage.getItem(SAVE_KEY);this.inspectRecovery();}catch(e){this.expectedRaw=undefined;if(e instanceof SaveError)throw e;throw new SaveError('storage','浏览器暂时无法读取或恢复备份');}try{if(this.expectedRaw==='')throw Error('empty');const value=this.expectedRaw!==null?normalizeSave(JSON.parse(this.expectedRaw)):initialSave();this.corrupt=false;return value;}catch(error){this.corrupt=true;throw new SaveError('invalid','旧存档：'+readableSaveError(error)+'，原始记录已保留');}}
 changedElsewhere(){try{return this.storage.getItem(SAVE_KEY)!==this.expectedRaw;}catch{return false;}}
 backup(){try{const j=parseOrNull(this.storage.getItem(JOURNAL_KEY)),raw=validJournal(j)&&j.key===BACKUP_KEY&&this.storage.getItem(SAVE_KEY)!==j.primaryAfter?j.before:this.storage.getItem(BACKUP_KEY),entry=JSON.parse(raw||'null');if(!entry)return null;return {...entry,save:normalizeSave(JSON.parse(entry.raw))};}catch{return null;}}
 profileRecoveryPlan(){if(!this.corrupt||!this.expectedRaw)return null;const preview=recoveryPreview(this.expectedRaw);return preview.save?preview:null;}
 profileOnly(){return this.profileRecoveryPlan()?.save||null;}
 rawRecords(){try{const raw=this.storage.getItem(RAW_BACKUP_KEY);if(!raw)return [];let value;try{value=JSON.parse(raw);}catch{return [{raw,savedAt:0}];}if(Array.isArray(value?.records)&&value.records.every(r=>r&&typeof r.raw==='string'))return value.records;if(value&&typeof value==='object'&&'records' in value)return [{raw,savedAt:value.savedAt||0}];if(typeof value?.raw==='string')return [{raw:value.raw,savedAt:value.savedAt||0}];return [{raw,savedAt:0}];}catch{throw new SaveError('storage','无法读取隔离原文');}}
 // The UI supplies the exact four-slot snapshot shown before explicit confirmation.
 // This is also available during recovery, so a full archive cannot deadlock recovery.
 clearRawRecords(expectedSnapshot){
  if(!expectedSnapshot||JSON.stringify(this.snapshot())!==JSON.stringify(expectedSnapshot))throw new SaveError('stale-preview','恢复资料已变化，请重新查看并确认清理；原文未删除');
  if(expectedSnapshot.primary!==this.expectedRaw)throw new SaveError('conflict','其他窗口已更新存档，请先载入最新记录；原文未删除');
  const count=this.rawRecords().length;if(!count)return 0;
  if(JSON.stringify(this.snapshot())!==JSON.stringify(expectedSnapshot))throw new SaveError('stale-preview','恢复资料已变化，原文未删除');
  try{removeKey(this.storage,RAW_BACKUP_KEY);}catch(e){throw new SaveError('storage','隔离原文清理未完成，原文仍保留',{cause:e});}
  const after=this.snapshot(),expectedAfter={...expectedSnapshot,unreadable:typeof this.storage.removeItem==='function'?null:''};
  if(JSON.stringify(after)!==JSON.stringify(expectedAfter)){
   // A concurrent change in another slot must not turn a failed cleanup into lost raw data.
   if(after.unreadable===expectedAfter.unreadable&&expectedSnapshot.unreadable!==null)this.storage.setItem(RAW_BACKUP_KEY,expectedSnapshot.unreadable);
   throw new SaveError('conflict','清理期间恢复资料发生变化，请重新载入并导出核对');
  }
  this.recoveryAttempt=null;this.inspectRecovery();return count;
 }
 recoveryBundle(){return {format:'fanren-recovery-records',exportedAt:Date.now(),primary:this.storage.getItem(SAVE_KEY),backup:this.storage.getItem(BACKUP_KEY),records:this.rawRecords(),pendingBackup:this.storage.getItem(JOURNAL_KEY)||null};}
 commit(input,{backup=false,allowCorrupt=false}={}){
  if(this.expectedRaw===undefined)throw new SaveError('storage','存档尚未载入，操作已停止');
  if(this.corrupt&&!allowCorrupt)throw new SaveError('invalid','旧存档尚未处理，操作已停止');
  if(this.recoveryIssue&&this.corrupt&&allowCorrupt&&this.recoveryIssue==='旧存档待恢复，当前未载入')return this.adoptRecovery(input,{expectedSnapshot:this.recoverySnapshot});
  if(this.recoveryIssue)throw new SaveError('recovery',this.recoveryIssue+'，请先查看恢复资料并确认处理');
  if(this.corrupt&&!allowCorrupt)throw new SaveError('invalid','旧存档尚未处理，操作已停止');
  const next=normalizeSave(input);let raw;try{this.recoverBackup();raw=this.storage.getItem(SAVE_KEY);}catch(e){if(e instanceof SaveError)throw e;throw new SaveError('storage','备份尚未恢复，未覆盖存档',{cause:e});}
  if(raw!==this.expectedRaw)throw new SaveError('conflict','其他窗口已更新存档，本页暂时停止写入');
  const stamp=Date.now();next.savedAt=stamp;next.revision=(Number(next.revision)||0)%1e15+1;/* wraps inside the 1e15 bound normalizeSave enforces, so an imported edge value never yields an unloadable save */const encoded=JSON.stringify(next);let journalText=null;
  try{
   if(raw&&(backup||this.corrupt)){
    const key=this.corrupt?RAW_BACKUP_KEY:BACKUP_KEY,before=this.storage.getItem(key);let entry={raw,savedAt:stamp};
    if(this.corrupt){const records=this.rawRecords();appendRawRecord(records,raw,stamp);entry={...entry,records};}
    const after=JSON.stringify(entry);journalText=JSON.stringify({key,before,after,primaryAfter:encoded,owner:this.owner,createdAt:stamp});
    this.storage.setItem(JOURNAL_KEY,journalText);this.storage.setItem(key,after);
   }
   if(this.storage.getItem(SAVE_KEY)!==raw||(journalText&&this.storage.getItem(JOURNAL_KEY)!==journalText))throw new SaveError('conflict','保存期间其他页面更新了记录');
   this.storage.setItem(SAVE_KEY,encoded);
  }catch(e){try{this.recoverBackup();}catch{}if(e instanceof SaveError)throw e;throw new SaveError('storage','保存未成功，原存档与备份恢复记录均已保留，请重试或导出',{cause:e});}
  this.expectedRaw=encoded;this.corrupt=false;try{if(journalText)removeKey(this.storage,JOURNAL_KEY);}catch{}return JSON.parse(encoded);
 }
}
export function checkpointDirty(b,save){
 if(!b||b.mode==='training'||b.finished)return false;const c=save?.checkpoint;
 return !c||(b.isExpedition&&b.revision!==c.expedition?.revision)||b.chapter!==c.chapter||b.wave!==c.wave||b.time>(c.time||0)+.05||b.gold!==c.gold||b.level!==c.level||JSON.stringify(b.traits)!==JSON.stringify(c.traits)||JSON.stringify(b.relics)!==JSON.stringify(c.relics)||JSON.stringify(b.consumables)!==JSON.stringify(c.consumables);
}
