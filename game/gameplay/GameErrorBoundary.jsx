/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
import {Button} from '../components/ui/button';
import {SaveVault} from './save-store';
// The game registers a reader for its unsaved pending record; the fallback only ever reads.
export const crashExports={pending:()=>null};
function download(raw,name){const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// Last-resort view for render errors. It never writes storage: it offers read-only exports and a reload.
export default class GameErrorBoundary extends React.Component{
 constructor(props){super(props);this.state={error:null,note:''};}
 static getDerivedStateFromError(error){return {error};}
 componentDidCatch(error,info){console.error(error,info?.componentStack);}
 exportRecords=()=>{try{download(JSON.stringify(new SaveVault(localStorage).recoveryBundle(),null,2),'青竹剑阵_原始记录汇总.json');this.setState({note:'已发起原始记录汇总下载，请确认文件已保存'});}catch{this.setState({note:'浏览器暂时无法读取本地记录；磁盘内容未改变'});}};
 exportPending=()=>{const next=crashExports.pending();if(!next)return;download(JSON.stringify(next,null,2),'青竹剑阵_本次待保存记录.json');this.setState({note:'已发起本次待保存记录下载，请确认文件已保存'});};
 render(){
  if(!this.state.error)return this.props.children;
  let pending=null;try{pending=crashExports.pending();}catch{}
  return <main className="fanren page-home in-menu crash-screen" role="alert"><div className="loading-screen"><div className="seal">凡</div><h1>青竹剑阵</h1>
   <p>界面出现异常，已停止显示。本页没有覆盖磁盘上的存档；可先导出记录，再重新载入。</p>
   <p>{String(this.state.error?.message||this.state.error).slice(0,200)}</p>
   <Button className="fr-btn" variant="outline" onClick={this.exportRecords}>导出原始记录汇总</Button>
   {pending&&<Button className="fr-btn" variant="outline" onClick={this.exportPending}>导出本次待保存记录</Button>}
   <Button className="fr-btn" onClick={()=>location.reload()}>重新载入</Button>
   {this.state.note&&<p>{this.state.note}</p>}
  </div></main>;
 }
}
