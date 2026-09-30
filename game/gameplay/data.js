/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {chapterName} from './chapter-names.js';
import {modText} from './descriptions.js';
export {modText,STAT_NAMES} from './descriptions.js';
// Save-format version; independent from the player-facing GAME_VERSION.
export const VERSION=1;
export const COLORS=['#91dcc1','#edd083','#9fbbf3','#e8c466','#ebaa70','#b7b3e2'];
/** @type {Array<[string,string,string,string,Record<string,number>]>} */
const pathRows=[
 ['sword','御剑','剑','飞剑集火 · 剑光穿透',{damage:.1}],
 ['thunder','雷法','雷','雷源调度 · 克制阴邪',{manaRegen:.2}],
 ['puppet','傀儡','机','远程协战 · 交叉火力',{puppets:1}],
 ['insect','御虫','虫','虫群追击 · 破甲啃噬',{insects:2}],
 ['talisman','符阵','符','符火爆发 · 禁制控场',{burn:1}],
 ['guard','护身','御','护盾反击 · 从容周旋',{shield:15}],
];
export const PATHS=pathRows.map((r,i)=>({id:r[0],name:r[1],icon:r[2],desc:r[3],perk:r[4],color:COLORS[i]}));
/** @type {Array<Array<[string,string,Record<string,number>]>>} */
const rows=[
 [['锐意','飞剑伤害 +15%',{damage:.15}],['疾剑','攻击速度 +10%',{haste:.1}],['贯穿','额外穿透 1 个目标',{pierce:1}],['凝锋','暴击率 +8%',{crit:.08}],['破甲','命中叠加破甲，最多 +24% 受伤',{armorBreak:.08}],['回锋','飞剑移动速度 +30%',{swordSpeed:.3}],['远驭','索敌范围 +22%',{range:.22}],['重斩','暴击伤害 +45%',{critPower:.45}],['追势','击杀后 2 秒攻速 +25%',{killHaste:.25}],['孤锋','对首领伤害 +22%',{bossDamage:.22}],['满锋','生命高于 70% 时伤害 +20%',{healthyDamage:.2}],['群锋','每 12 剑提高 3% 伤害',{swordScale:.03}]],
 [['回灵','灵力恢复 +22%',{manaRegen:.22}],['雷威','神雷伤害 +25%',{thunderDamage:.25}],['节雷','神雷每次雷源消耗 −3',{thunderSave:3}],['驱邪','对阴邪之物的雷伤 +35%',{evilDamage:.35}],['余电','神雷后飞剑强化 5 秒',{afterThunder:.35}],['雷印','暴击附加雷印，神雷引爆',{mark:1}],['雷护','神雷恢复 18 点护盾',{thunderShield:18}],['驭电','每 3 秒触发跳跃电弧',{chain:1}],['静养','未受击 6 秒，回灵 +35%',{safeMana:.35}],['蓄势','满灵力时飞剑伤害 +18%',{fullMana:.18}],['引雷','击杀有 10% 概率回复 1 灵力',{killMana:.1}],['雷储','雷源上限与现有量 +20',{reserve:20}]],
 [['弩机','增加 1 具协战傀儡',{puppets:1}],['精工','傀儡伤害 +25%',{puppetDamage:.25}],['连弩','傀儡攻速 +20%',{puppetHaste:.2}],['穿弩','弩矢额外穿透 1 个敌人',{puppetPierce:1}],['神识延展','飞剑与傀儡索敌范围 +15%',{range:.15,puppetRange:.15}],['定点射击','站定时傀儡伤害 +35%',{stationary:.35}],['策应','靠近傀儡时减伤 8%',{puppetGuard:.08}],['交织','弩矢命中减速 15%',{puppetSlow:.15}],['识海','暴击 +5%，回灵 +10%',{crit:.05,manaRegen:.1}],['精密机括','弩矢击退 +60%',{puppetKnock:.6}],['守阵机','每具常驻傀儡提供 4 护盾上限，备用傀儡不计入',{puppetShield:4}],['协同齐射','对有印记目标弩矢伤害 +35%；需雷法雷印或御虫标猎先产生印记',{puppetMark:.35}]],
 [['育虫','增加 2 只协战噬金虫',{insects:2}],['利颚','噬金虫伤害 +25%',{insectDamage:.25}],['迅翼','噬金虫追击速度 +25%',{insectSpeed:.25}],['侵甲','虫群命中附加 6% 破甲',{insectBreak:.06}],['聚食','虫群对精英首领伤害 +25%',{insectBoss:.25}],['连噬','虫群攻击速度 +20%',{insectHaste:.2}],['虫潮','每 25 击杀孵化 1 虫，最多 6 只',{breed:1}],['护主','每 4 只虫提供 4 护甲',{insectGuard:4}],['余粮','每 12 击杀恢复 1 生命',{killHeal:1}],['标猎','虫群对标记目标增伤 20%',{insectMark:.2}],['扫落','拾取范围 +30%，移速 +4%',{magnet:.3,speed:.04}],['灵虫共鸣','虫群攻击有 8% 概率回复 1 灵力',{insectMana:.08}]],
 [['符火','命中附带持续灼烧',{burn:1}],['炽符','灼烧伤害 +40%',{burnDamage:.4}],['火势','灼烧敌人死亡产生符火',{deathFire:1}],['缚行','飞剑命中减速 12%',{slow:.12}],['禁制余波','每 7 秒在脚下留下减速阵',{ward:1}],['火符连爆','每 8 次击杀触发符火爆炸',{killBlast:1}],['双重符力','灼烧持续时间 +2 秒',{burnTime:2}],['震退','飞剑击退效果 +30%',{knock:.3}],['符阵护持','阵内每秒恢复 3 护盾',{wardShield:3}],['焰中取势','对灼烧目标伤害 +18%',{burnBonus:.18}],['遁后留符','闪避起点留下延时符火',{dashFire:1}],['符火映雷','雷击灼烧目标伤害 +35%',{burnThunder:.35}]],
 [['固元','生命上限 +20，恢复等量生命',{hp:20}],['护体','护盾上限 +16',{shield:16}],['铁衣','护甲 +5',{armor:5}],['轻身','移动速度 +10%',{speed:.1}],['息调','每秒恢复 0.35 生命',{regen:.35}],['连遁','闪避冷却缩短 18%',{dashHaste:.18}],['余影','闪避无敌时间 +0.07 秒',{iframes:.07}],['反震','受击后反震附近敌人',{thorns:1}],['养息','未受击 5 秒后每秒恢复 3 护盾',{shieldRegen:3}],['险境','生命低于 35% 时伤害 +30%',{lowDamage:.3}],['稳守','闪避后 2 秒减伤 25%',{dashGuard:.25}],['守心','每章抵挡一次致命伤并回复 25% 生命',{revive:1}]],
];
export const TRAITS=rows.flatMap((g,i)=>g.map((r,j)=>({id:PATHS[i].id+'-'+j,path:i,name:r[0],desc:r[1],mods:r[2],max:Object.keys(r[2]).some(k=>['mark','breed','deathFire','ward','dashFire','thorns','revive'].includes(k))?1:3,tier:j<4?1:j<9?2:3})));
export const COMBOS=[
 ['剑雷交鸣',0,1,'暴击有 25% 概率触发雷击','swordThunder'],
 ['百刃齐发',0,2,'傀儡额外继承基础飞剑伤害加成；不含群锋及条件增伤','swordPuppet'],
 ['剑引虫至',0,3,'虫群额外获得 20% 暴击率','swordInsect'],
 ['火中见锋',0,4,'对灼烧目标暴击率 +20%','swordFire'],
 ['进退有据',0,5,'闪避后 3 秒飞剑伤害 +30%','swordGuard'],
 ['雷机共振',1,2,'神雷使傀儡加速 6 秒','thunderPuppet'],
 ['虫翼引电',1,3,'神雷按虫数恢复生命','thunderInsect'],
 ['符雷同击',1,4,'神雷留下三处符火区，各持续 4 秒、每秒 35 伤害，不随等级或灼烧加成成长','thunderFire'],
 ['雷御周身',1,5,'神雷后获得 1.5 秒无敌','thunderGuard'],
 ['虫机协同',2,3,'傀儡与虫群各增加 1','puppetInsect'],
 ['镇阵守元',4,5,'阵法范围 +40%，生命恢复 +30%','fireGuard'],
 ['护阵傀儡',2,5,'每具常驻傀儡提供 3 护甲，备用傀儡不计入','puppetGuard'],
].map(r=>({name:r[0],a:PATHS[r[1]].id,b:PATHS[r[2]].id,desc:r[3],effect:r[4]}));
export const RELICS=[
 {id:'lingxi',name:'灵犀佩',desc:'护盾 +30，护甲 +3',mods:{shield:30,armor:3},chapter:2,story:true,source:'冰火道前所得护身物 · 游戏化设定，非原著器物'},
 {id:'icepearl',name:'冰珠',desc:'环境减伤 35%，生命 +15',mods:{hazardGuard:.35,hp:15},chapter:2,story:true,source:'蛮胡子给予的避热之物'},
 {id:'five-rings',name:'五行环',desc:'减速 +18%，护盾 +15',mods:{slow:.18,shield:15},chapter:3,story:true,source:'宝光阁古宝，效果数值游戏化'},
 {id:'cape',name:'血色披风',desc:'移速 +12%，闪避冷却 −20%',mods:{speed:.12,dashHaste:.2},chapter:3,story:true,source:'宝光阁古宝，位移以游戏冷却呈现'},
 {id:'refinement',name:'御剑·固锋',desc:'飞剑伤害 +18%，击退 +20%',mods:{damage:.18,knock:.2},chapter:0,story:false,source:'携行战术配置 · 非原著器物'},
 {id:'weeping',name:'啼魂协战',desc:'对阴魂伤害 +35%',mods:{ghostDamage:.35},chapter:3,story:true,source:'元瑶相关剧情后的协战配置'},
 ...PATHS.flatMap((p,i)=>/** @type {Array<[string,Record<string,number>]>} */ ([
  ['精修',[{damage:.17,regen:.1},{thunderDamage:.25,manaRegen:.12},{puppetDamage:.25,puppets:1},{insectDamage:.2,insects:2},{burn:1,burnDamage:.2},{armor:5,hp:15}][i]],
  ['轻装',[{haste:.15,speed:.05},{manaRegen:.25,speed:.05},{puppetHaste:.25,speed:.05},{insectSpeed:.3,speed:.05},{slow:.1,speed:.08},{dashHaste:.2,speed:.08}][i]],
  ['凝神',[{crit:.12,critPower:.25},{reserve:20,thunderSave:2},{puppetPierce:1,range:.1},{insectBreak:.1,insectMark:.15},{burnTime:2,burnBonus:.15},{shield:25,shieldRegen:2}][i]],
  ['稳进',[{range:.2,pierce:1},{safeMana:.3,thunderShield:10},{puppets:1,puppetGuard:.06},{insects:3,killHeal:1},{ward:1,wardShield:2},{regen:.5,dashGuard:.15}][i]],
  ['决胜',[{bossDamage:.25,damage:.08},{evilDamage:.3,thunderDamage:.15},{puppetDamage:.35,bossDamage:.1},{insectBoss:.35,insectHaste:.15},{deathFire:1,killBlast:1},{thorns:1,lowDamage:.2}][i]],
 ]).map((r,j)=>({id:'kit-'+i+'-'+j,name:p.name+'·'+r[0],desc:'携行配置：'+modText(r[1]),mods:r[1],chapter:0,story:false,path:i,source:'战术配置 · 非新增原著法宝'}))),
];
export const CONSUMABLES=[
 ['heal','回元药包','恢复 35% 最大生命','heal',.35],['mana','回灵药包','补充 65 灵力，不补雷源','mana',65],['shield','护身符','获得 45 点额外护盾','shield',45],['fire','火球符','在集火点引爆符火','fire',1],['wind','疾行符','12 秒移速 +35%','speed',12],['magnet','收摄符','收取场上全部掉落','magnet',1],['guard','金光符','获得 3 秒无敌','invincible',3],['ice','束缚符','全场敌人减速 65%，6 秒','slow',6],['sword','锐锋符','12 秒飞剑伤害 +35%','damage',12],['blink','遁行符','刷新闪避，恢复 10 生命','dash',1],['shock','震荡符','击退并伤害周围敌人','shock',1],['heal2','疗伤丹','恢复 55% 生命','heal',.55],['mana2','回灵丹','恢复 100 灵力，不补雷源','mana',100],['shield2','铁衣符','12 秒护甲 +40','armor',12],['seal','镇灵符','重创场上阴魂，定身 3 秒','seal',1],['puppet','备用傀儡','临时增加 1 具傀儡，持续 30 秒；重复使用刷新时间，不叠加数量','puppet',30],['insect','灵虫诱饵','临时增加 4 只虫，持续 25 秒；重复使用刷新时间，不叠加数量','insect',25],['recovery','养息药散','12 秒内每秒恢复 3 生命','regen',12],
].map((r,i)=>({id:r[0],name:r[1],desc:r[2],effect:r[3],value:r[4],price:30+i*3}));
export const ENEMIES=[
 ['ghost','游魂','seek',0,12,46,7,1,'阴魂','追近；雷法克制'],
 ['cultist','执刃修士','flank',1,22,57,9,2,'修士','侧翼包抄'],
 ['skeleton','残骸阴魂','revive',2,20,39,8,2,'阴魂','重组一次'],
 ['wolf','狼首傀儡','charge',3,35,43,11,3,'傀儡','蓄力直线冲锋'],
 ['snake','洞窟妖蛇','snake',4,25,57,9,2,'妖物','曲线扑击'],
 ['spider','穴居妖蛛','web',5,30,38,8,3,'妖物','蛛网限制走位'],
 ['ant','铁火蚁','swarm',6,9,74,5,1,'虫群','成群追击'],
 ['beetle','甲壳妖虫','armor',7,48,29,10,3,'妖物','正面护甲'],
 ['sorcerer','阴功修士','caster',8,28,32,10,3,'鬼修','保持距离施法'],
 ['kingling','凝形厉鬼','pulse',9,46,34,12,4,'阴魂','环形扩散波'],
 ['puppet','古殿战傀','spin',10,45,39,12,3,'傀儡','近身旋转范围攻击'],
 ['ghostmage','持灯阴魂','link',11,26,33,9,3,'阴魂','鬼火封路'],
 ['poison','毒息妖物','poison',12,32,44,10,3,'妖物','死亡留下毒雾'],
 ['fire','火灵','suicide',13,16,67,15,2,'灵体','预警后自爆'],
 ['archer','持弓修士','snipe',14,25,33,12,3,'修士','红线瞄准狙击'],
 ['stone','重甲守傀','tank',15,88,24,14,5,'傀儡','重甲缓行'],
 ['blink','匿形阴魂','blink',0,25,46,10,3,'阴魂','预警后闪现'],
 ['split','聚魂阴影','split',2,32,39,10,3,'阴魂','死亡分裂'],
 ['healer','聚阴施法者','healer',8,30,31,8,4,'鬼修','修复附近敌人'],
 ['summoner','唤魂修士','summon',11,32,29,9,4,'鬼修','有限召唤'],
 ['triple','连弩守傀','triple',10,39,29,12,4,'傀儡','三连弩射击'],
 ['flameant','灼热铁火蚁','trail',6,17,62,8,2,'虫群','留下灼热路径'],
 ['eliteblade','御刃修士','dash',1,44,50,13,4,'修士','快速蓄力冲斩'],
 ['warder','守禁傀儡','warder',15,65,27,12,5,'傀儡','强化附近防御'],
 ['fanbow','符弩游修','fanbow',14,28,35,8,3,'修士','紫线预警 0.8 秒后扇射三箭；横移穿过箭隙'],
 ['frostweb','寒丝妖蛛','frostweb',5,33,34,7,3,'妖物','预警 1.1 秒后留下寒丝区，区域持续 3 秒、减速 40%，不直接造成伤害'],
 ['bulwark','执盾战傀','bulwark',15,65,26,10,4,'傀儡','举盾 2.4 秒时正面普通剑击伤害减少 40%，随后放下 1.6 秒；可绕侧或用协战'],
 ['orbitfire','游弋鬼火','orbitfire',13,20,50,7,2,'阴魂','绕身游弋，预警 0.65 秒后射出慢弹，发射后冷却 3 秒；雷法克制'],
].map((r,i)=>({id:r[0],name:r[1],ai:r[2],sprite:r[3],hp:r[4],speed:r[5],damage:r[6],cost:r[7],family:r[8],desc:r[9],index:i}));
export const CHAPTERS=[
 {id:0,name:chapterName(0),sub:'炼剑后探遗府',tag:'壹',map:1,color:'#83bcae',enemies:[4,5,7,12,1,14],boss:'洞窟妖蛇',bossType:'serpent',bossSprite:4,intro:['乱星海 · 结丹初期','天雷竹经绿液培育，七十二口青竹蜂云剑已炼成。韩立应邀探访古修遗府。','石门后的阴寒气息尚未散去。先探清禁制，再寻退路。'],outro:'遗府深处，曲魂与玄骨相关的变故令韩立警觉。虚天残图再次出现，新的机缘与凶险一同到来。',objective:'斩妖破禁，探清遗府',source:'《珠中》《妖蛇》《玄魂炼妖》《残图再现》'},
 {id:1,name:chapterName(1),sub:'虚天殿外殿',tag:'贰',map:2,color:'#b4a4ce',enemies:[0,2,8,9,11,16,17,18],boss:'鬼王',bossType:'ghost',bossSprite:9,intro:['虚天殿 · 外殿','各方修士齐聚虚天殿。踏入鬼雾之后，视野所及尽是阴影与遗骸。','飞剑中的金色雷光，对这些阴邪之物尤为有效。切勿耗尽底牌。'],outro:'鬼雾中的杀机暂歇。同行并不意味着可信，合作也有各自的代价。韩立继续前往内侧关卡。',objective:'穿越鬼雾，击破鬼王',source:'《鬼雾遗骸》《鬼王》'},
 {id:2,name:chapterName(2),sub:'熔岩与黑沙',tag:'叁',map:3,color:'#dc9c65',enemies:[6,7,13,21,4,12],boss:'铁火蚁潮',bossType:'swarm',bossSprite:6,intro:['虚天殿 · 冰火道','借助避热之物，韩立进入炽热的道路。黑沙下传来细密的摩擦声。','与虫潮纠缠之前，必须留下一条退路。'],outro:'噬金虫与铁火蚁的争斗给了韩立脱身的空隙。与元瑶的合作之后，啼魂才加入他的手段之中；取得的炼晶留待日后处理。',objective:'在铁火蚁潮中存活',source:'《冰火道》《黑沙漠》《铁火蚁》'},
 {id:3,name:chapterName(3),sub:'取宝有度',tag:'肆',map:4,color:'#cdbb85',enemies:[10,15,20,23,7,13],boss:'敛息取宝',bossType:'seal',bossSprite:15,intro:['虚天殿 · 宝光阁','古宝近在眼前，取宝却受禁制约束。韩立准备以噬金虫覆盖自身，隔绝灵气。','先辨明规则，再敛息取宝。青色阵位表示当前可以收敛灵息的位置。'],outro:'韩立取得五行环与血色披风。古宝入手，却仍需记住它们各自的限制。内殿开启，真正的争夺尚在后面。',objective:'站入青色阵位，以虫甲遮蔽灵息',source:'《宝光阁》《取宝》《幻景黑殿》'},
 {id:4,name:chapterName(4),sub:'石门重重',tag:'伍',map:4,color:'#89c9be',enemies:[3,10,15,20,23,8,14],boss:'狼首傀儡',bossType:'puppet',bossSprite:3,intro:['虚天殿 · 内殿','相似的石门连接成复杂通道，禁制的微光沿墙面游移。','元婴修士各有所图。韩立必须守住自己的作用，也必须守住退路。'],outro:'机关与傀儡已被越过，众人向取鼎之处深入。韩立没有将临时的庇护当作真正的安全。',objective:'击破傀儡，穿过内殿',source:'《狼首傀儡》《二层》《取宝》'},
 {id:5,name:chapterName(5),sub:'雷火之间',tag:'陆',map:5,color:'#a3c9ee',enemies:[0,9,11,16,17,18,19],boss:'玄骨',bossType:'xuangu',bossSprite:8,intro:['虚天殿 · 夺鼎之后','夺宝之局接近终点，玄骨与韩立之间的合作却已走到尽头。','乾蓝冰焰与灰白圣火交织。雷源终有耗尽之时，必须找出脱身机会。'],outro:'修罗圣火失控反噬，玄骨肉身被焚。危机并未结束，韩立仍需处理余下冰焰与隐患，方能带着所得离开。',objective:'应对玄骨，伺机脱身',source:'《收鼎》《辟邪神雷与修罗圣火》《玄骨之死》《乾蓝珠》'},
];
export const LORE_URLS=[['培竹','411'],['七十二剑炼成','415'],['鬼雾遗骸','438'],['狼首傀儡','475'],['玄骨之死','493'],['乾蓝珠','494'],['后续：剑阵初成','786']].map(r=>[r[0],'https://www.wuxiaworld.com/novel/rmji/rmji-chapter-'+r[1]]);
// Legacy texts (rule-1 engine only): the amounts in these choice descriptions are shown and applied by engine.js chooseEvent for
// rules-1 saves. Rules-3 expeditions build every option line from Expedition.singleEffectText/cashRewardFor and never show them.
const eventRows=[
 ['残余灵气','散乱灵气沿墙缝逸出，尚能收摄少许。停留越久，被察觉的机会越大。',['收摄余息','获得下级 70% 经验','xp'],['引气入体','下波压力 +20%，获得一次强化','riskTrait']],
 ['阵纹碎片','破损阵盘还有一道灵纹完好。韩立可将其改作临时护具，也可拆出灵石。',['补全护具','获得 25 护盾','shield'],['拆解阵盘','获得 45 灵石','gold']],
 ['遗落药囊','一只药囊半埋在石屑中。药性保存尚好，但药囊容量有限。',['取回元药','补充一份回元药包，需有药囊空位','medicine'],['直接调息','恢复 20% 生命','heal']],
 ['古壁铭文','残文记录着运转灵力的片段。修行不能照单全收，能用于眼下的只有一小部分。',['择要参照','获得下级 70% 经验','xp'],['细辨全篇','下波压力 +20%，获得一次强化','riskTrait']],
 ['岔路阴风','风声从两条石隙传来。近路灵石更多，踏入时却难免被阴风侵蚀。',['循稳路行','获得 25 护盾','shield'],['冒险抄近','损失 12% 当前生命，获得 100 灵石','riskGold']],
 ['破损傀儡','散落的机括尚可利用。韩立检查关节，分出能够拆换的一部分。',['拆出材料','获得 45 灵石','gold'],['拼装备用机','获得备用傀儡物资，需有空位','sparePuppet']],
 ['未熄符火','残留符火即将熄灭。可以借它整理符箓，也可远离热浪休整。',['补一张火符','获得火球符，需有药囊空位','fireItem'],['退至凉处','恢复 20% 生命','heal']],
 ['散落灵石','数枚灵石落在裂缝边。向里探去，还能看见更多微光。',['收取外缘','获得 45 灵石','gold'],['深入裂缝','损失 12% 当前生命，获得 100 灵石','riskGold']],
 ['封存药匣','药匣用一层微弱禁制封住。打开之后，可用灵石温养其中的药物。',['自行运功','恢复 20% 生命','heal'],['温养药性','支付 35 灵石，恢复 45% 生命','buyHeal']],
 ['石门灵纹','门上的灵纹时明时暗，恰好提供一次调整法力的机会。',['导引灵力','补充 50 灵力，不补雷源','mana'],['推演节律','获得 1 次强化重选','reroll']],
 ['微弱虫鸣','灵虫在储物袋中躁动。韩立可以调配诱饵，也可趁停留检查它们的状态。',['调配诱饵','获得灵虫诱饵，需有空位','insectItem'],['稳定气息','补充 50 灵力，不补雷源','mana']],
 ['隐蔽石隙','一处能容身的石隙隔开了风声。适合休息，也适合重新检点物资。',['养伤片刻','恢复 20% 生命','heal'],['整理储物袋','获得 45 灵石','gold']],
 ['旧阵阵眼','阵眼尚存灵力，取出便能作为护身之用。强行牵引全部灵力会惊动周围。',['缓缓导出','获得 25 护盾','shield'],['尽取阵力','下波压力 +20%，获得一次强化','riskTrait']],
 ['灰烬余温','地上残留一张没有完全烧毁的符纸。继续炼制需要消耗一些灵石。',['收起符纸','获得 30 灵石','smallGold'],['重绘金光符','支付 25 灵石，获得金光符，需有空位','buyGuard']],
 ['灵气回流','四周灵气忽然向同一处聚集。韩立顺势回收逸散的法力。',['平稳回灵','补充 50 灵力，不补雷源','mana'],['化作剑意','获得下级 70% 经验','xp']],
 ['狭路相逢','前方传来斗法声。绕行可能错过财物，靠近则难免受到余波。',['保持距离','获得 25 护盾','shield'],['取走遗物','损失 20% 当前生命，获得携行配置','riskRelic']],
 ['裂开的玉简','玉简中的记录残缺不全。与已有经验对照，仍能辨出一些战术思路。',['留作参照','获得 1 次强化重选','reroll'],['集中推演','下波压力 +20%，获得一次强化','riskTrait']],
 ['地底震动','细碎石屑不断落下。眼下可以快速穿过，也可借震动察看禁制走向。',['迅速离开','刷新闪避，获得 15 护盾','escape'],['顺势观阵','获得下级 70% 经验','xp']],
 ['黯淡符纸','符纸尚有余力，适合改作收摄之用。也能把最后一点灵力导入护具。',['制收摄符','获得收摄符，需有空位','magnetItem'],['补充护具','获得 25 护盾','shield']],
 ['遗弃储物袋','袋中大多是损坏物件，夹杂着一件可以调整的携行配置。强开残禁会伤身。',['取走灵石','获得 45 灵石','gold'],['破开残禁','损失 20% 当前生命，获得携行配置','riskRelic']],
 ['残存护罩','护罩边缘已经崩散，中心仍能容下一人。短暂停留可以缓和伤势。',['罩内调息','恢复 20% 生命','heal'],['转用护罩','获得 25 护盾','shield']],
 ['短暂宁静','韩立再次检查来路。没有敌人迫近的片刻，最适合恢复或调整准备。',['恢复法力','补充 50 灵力，不补雷源','mana'],['复核战术','获得 1 次强化重选','reroll']],
 ['退路与机缘','继续冒险意味着更丰厚的收益，也意味着下一波来敌更密集。退路仍在身后。',['稳守余力','恢复 20% 生命','heal'],['承压求进','下波压力 +20%，获得一次强化','riskTrait']],
 ['禁制回响','灵纹短暂亮起，显露出一处可以容身的空隙。韩立可以利用它重整护具。',['留好退路','刷新闪避，获得 15 护盾','escape'],['重新配药','支付 35 灵石，恢复 45% 生命','buyHeal']],
];
export const EVENTS=eventRows.map(([name,desc,a,b],id)=>({id,name,desc,choices:[a,b,['继续前行','不作停留','skip']].map(([name,desc,effect])=>({name,desc,effect}))}));
export {META} from './cultivation.js';
export const LEGACY_META=PATHS.flatMap((p,i)=>Array.from({length:6},(_,j)=>({id:p.id+'-meta-'+j,path:i,name:p.name+['心得','整备','灵识','调度','传习','通悟'][j],cost:20+j*15,desc:['此流派开局额外获得 15 灵石','出发额外携带 1 份药包','生命上限 +2，六分支累计上限 +12','出发额外获得 1 次重选','更容易遇见此流派强化','试剑台可用 72 剑完整配置'][j],step:j})));
export const DIFFICULTIES=[{name:'初入仙途',desc:'敌人生命 −15%、伤害 −30%；基础雷源150',hp:.85,damage:.7,xp:1.12,reserve:150},{name:'标准历练',desc:'敌人生命和伤害基准；基础雷源120',hp:1,damage:1,xp:1,reserve:120},{name:'险境求生',desc:'敌人生命 +20%、伤害 +25%；基础雷源110',hp:1.2,damage:1.25,xp:1.08,reserve:110}];
export function xpCost(l){return Math.round(8+2.4*l+.035*l*l);}
export function hashSeed(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function seeded(seed){let a=seed>>>0;const f=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};f.state=()=>a>>>0;f.set=n=>a=n>>>0;return f;}
export function initialSave(){return {version:VERSION,metaRulesVersion:3,unlocked:0,insight:0,meta:[],seen:[],relicSeen:[],wins:0,runs:0,kills:0,best:0,achievements:[],history:[],records:{schema:1,entries:[],receipts:[]},checkpoint:null,settings:{music:.15,sfx:.4,shake:true,flash:false,numbers:false,quality:1,joystickSide:'left',joystickSize:'standard',skillSide:'right',touchLock:false,skipSeenCinematics:false,endlessSkipSeen:true,skipSeenAfterWin:false}};}

export function relicDescription(item){return modText(RELICS.find(r=>r.id===item?.id)?.mods||item?.mods||{});}
