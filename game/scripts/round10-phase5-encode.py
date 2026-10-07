# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 bilibili@卡布奇诺ultra
"""Compare encoding copies; never alter original PNGs. Run from the game directory."""
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
from concurrent.futures import ThreadPoolExecutor
import json,math,hashlib,shutil,sys
root=Path.cwd();out=root/'qa/round10-phase5-encodings';out.mkdir(parents=True,exist_ok=True)
files=['hanli-sword-atlas.png','hanli-dialogue-portrait-v1.png','enemy-atlas.png','battlefield-atlas.png','golden-beetle.png','menu-backdrop.png','expedition-portraits-atlas.png','expedition-icons-atlas.png','expedition-props-atlas.png']
lossy={'menu-backdrop.png','battlefield-atlas.png','hanli-dialogue-portrait-v1.png'}
def encode(name):
 p=root/'public/assets'/name;im=Image.open(p);rgba=im.convert('RGBA');variants=[]
 for mode in ['lossless']+(['webp96','jpeg95'] if name in lossy and rgba.getchannel('A').getextrema()==(255,255) else []):
  dest=out/(p.stem+'-'+mode+('.jpg' if mode=='jpeg95' else '.webp'))
  if mode=='jpeg95':im.convert('RGB').save(dest,'JPEG',quality=95,subsampling=0,optimize=True)
  else:im.save(dest,'WEBP',lossless=mode=='lossless',quality=100 if mode=='lossless' else 96,method=6,exact=True,alpha_quality=100)
  decoded=Image.open(dest).convert('RGBA');delta=ImageChops.difference(rgba,decoded);stats=ImageStat.Stat(delta);mse=sum(x*x for x in stats.rms[:3])/3;alphaEqual=delta.getchannel('A').getextrema()==(0,0);exact=all(x==(0,0) for x in delta.getextrema());variants.append({'mode':mode,'path':str(dest.relative_to(root)),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'rgbaExact':exact,'alphaExact':alphaEqual,'rgbPSNR':None if mse==0 else 10*math.log10(255**2/mse),'rgbMaxError':max(x[1] for x in delta.getextrema()[:3])})
 row={'source':str(p.relative_to(root)),'sourceBytes':p.stat().st_size,'sourceSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'width':im.width,'height':im.height,'mode':im.mode,'alphaRange':rgba.getchannel('A').getextrema(),'decodedRGBABytes':im.width*im.height*4,'variants':variants};print(name,[(v['mode'],v['bytes'],v['rgbaExact']) for v in variants],flush=True);return row
with ThreadPoolExecutor(max_workers=3) as executor:rows=list(executor.map(encode,files))
report={'method':'Original-size copies. Lossless WebP for all assets; WebP96/JPEG95 comparisons only for opaque backgrounds and the new opaque portrait. Preserve alpha and original PNGs. RGBA byte accounting is decoded bitmap size, not total browser-process memory.','images':rows,'sourceBytes':sum(r['sourceBytes'] for r in rows),'decodedRGBABytes':sum(r['decodedRGBABytes'] for r in rows)}
(root/'qa/round10-phase5-encoding-trial.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('Completed',report['sourceBytes'],report['decodedRGBABytes'])

if '--apply' in sys.argv:
 target=root/'public/assets/encoded';target.mkdir(parents=True,exist_ok=True)
 keys=dict(zip(files,['hero','hanliPortrait','enemies','maps','golden','menu','portraits','icons','props']))
 assets={}
 for row in rows:
  name=Path(row['source']).name
  chosen=next((v for v in row['variants'] if v['mode']=='webp96'),row['variants'][0])
  dest=target/(Path(name).stem+'.webp');shutil.copy2(root/chosen['path'],dest)
  assets[keys[name]]={'source':name,'file':'encoded/'+dest.name,'mime':'image/webp','width':row['width'],'height':row['height'],'encoding':chosen['mode'],'sourceSHA256':row['sourceSHA256'],'sha256':chosen['sha256'],'bytes':chosen['bytes'],'rgbaExact':chosen['rgbaExact'],'alphaExact':chosen['alphaExact']}
 manifest={'schema':1,'assets':assets,'sourceBytes':report['sourceBytes'],'encodedBytes':sum(a['bytes'] for a in assets.values()),'decodedRGBABytes':report['decodedRGBABytes']}
 (target/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 print('Applied reviewed encoding profile; run browser pixel and crop validation before delivery.')
