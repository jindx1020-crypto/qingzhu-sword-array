/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
const EFFECTS={level:[[523,.3],[659,.4],[784,.5]],choose:[[440,.12],[660,.18]],dash:[[210,.13]],hurt:[[85,.18],[65,.15]],thunder:[[55,.8],[110,.65],[220,.4]],boss:[[98,.5],[110,.5],[82,.8]],item:[[392,.18],[523,.25]],kill:[[310,.055]],focus:[[740,.08],[990,.07]],sigil:[[160,.08],[320,.07]],echo:[[420,.08]],line:[[560,.08],[840,.08]],counter:[[520,.08],[780,.08]],critical:[[1040,.06]],denied:[[125,.06]]};
const MECHANISMS=new Set(['focus','sigil','echo','line','counter','critical']);
export const SOUND_GAPS={hurt:.08,dash:.12,thunder:.15,level:.2,item:.2,choose:.12,boss:.4,kill:.1,denied:.4};
export class Sound {
 constructor(){this.ctx=null;this.settings={music:.15,sfx:.4};this.step=0;this.last=0;this.paused=false;this.voices=new Set();this.voiceMeta=new Map();this.buses={};this.levels={};this.soundAt={};this.lastMechanism=-Infinity;}
 start(){if(!this.ctx){const C=window.AudioContext||window.webkitAudioContext;if(C)this.ctx=new C();}this.ctx?.resume().catch(()=>{});}
 stopVoice(o){const meta=this.voiceMeta.get(o);this.voices.delete(o);this.voiceMeta.delete(o);try{o.stop();}catch{}try{o.disconnect();meta?.gain.disconnect();}catch{}}
 // Called every frame; bus gains are only rescheduled when the level actually changes.
 configure(settings){this.settings=settings;const c=this.ctx;if(!c||c.state==='closed')return;for(const channel of ['music','sfx']){if(!(settings[channel]>0))for(const voice of this.voices)if(this.voiceMeta.get(voice)?.channel===channel)this.stopVoice(voice);if(!this.buses[channel]){this.buses[channel]=c.createGain();this.buses[channel].connect(c.destination);}const level=this.paused?0:settings[channel];if(this.levels[channel]!==level){this.levels[channel]=level;this.buses[channel].gain.setValueAtTime(level,c.currentTime);}}}
 setPaused(paused){if(paused)for(const voice of this.voices)this.stopVoice(voice);this.paused=paused;this.configure(this.settings);}
 tone(freq,duration,type='sine',volume=.1,channel='sfx',delay=0,priority=0,name=channel){
  const c=this.ctx;if(this.paused||!c||c.state!=='running'||volume<=0||!(this.settings[channel]>0))return false;
  // Eight ordinary voices leave four slots for damage warnings and mechanism cues.
  const limit=priority>=4?12:8;if(channel==='music'&&[...this.voiceMeta.values()].filter(v=>v.channel==='music').length>=4)return false;
  if(this.voices.size>=limit){const victim=[...this.voices].filter(o=>(this.voiceMeta.get(o)?.priority??0)<priority).sort((a,b)=>this.voiceMeta.get(a).priority-this.voiceMeta.get(b).priority||this.voiceMeta.get(a).at-this.voiceMeta.get(b).at)[0];if(!victim)return false;this.stopVoice(victim);}
  const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume*(this.buses[channel]?1:this.settings[channel]),t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.buses[channel]||c.destination);this.voices.add(o);this.voiceMeta.set(o,{channel,priority,name,at:t,gain:g});o.onended=()=>{this.voices.delete(o);this.voiceMeta.delete(o);o.disconnect();g.disconnect();};o.start(t);o.stop(t+duration+.02);return true;
 }
 play(name){const c=this.ctx;if(!c||this.paused||!(this.settings.sfx>0))return;const now=c.currentTime,gap=SOUND_GAPS[name]??(MECHANISMS.has(name)?.18:0);if(now<(this.soundAt[name]??-Infinity)+gap)return;if(name==='kill'&&now<this.lastMechanism+.08)return;if(MECHANISMS.has(name)){if(now<this.lastMechanism+.045)return;this.lastMechanism=now;}this.soundAt[name]=now;const volume=name==='kill'?.025:MECHANISMS.has(name)?.055:name==='denied'?.035:name==='hurt'?.16:.1,priority=name==='hurt'?5:MECHANISMS.has(name)||name==='boss'?4:name==='level'?3:['thunder','dash','denied'].includes(name)?2:name==='kill'?0:1;(EFFECTS[name]||[]).forEach((s,i)=>this.tone(s[0],s[1],name==='thunder'?'sawtooth':'triangle',volume,'sfx',i*.04,priority,name));}
 update(t,boss=false){if(!this.ctx||this.paused||t-this.last<(boss?.33:.65))return;this.last=t;const notes=[146.83,196,220,293.66,329.63,293.66,220,196];this.tone(notes[this.step%8],1.2,'sine',.1,'music');if(this.step%4===0)this.tone(notes[0]/2,2,'triangle',.075,'music');this.step++;}
 close(){this.setPaused(true);this.ctx?.close().catch(()=>{});}
}
