// Editable SVG sources plus portable PNGs for GitHub's README image renderer.
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const directory=path.resolve('docs/assets/readme');
await mkdir(directory,{recursive:true});
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;');
const text=(x,y,value,size=22,fill='#171a18',weight=400)=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${escape(value)}</text>`;
const rect=(x,y,w,h,fill='#ffffff',stroke='#e2e4df',r=18)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
const arrow=(d,color='#8a958b',dash='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="2" ${dash?'stroke-dasharray="'+dash+'"':''} marker-end="url(#arrow)"/>`;
const shell=(width,height,title,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><title>${title}</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="#8a958b"/></marker></defs><rect width="100%" height="100%" fill="#f7f8f4"/><g font-family="PingFang SC, Hiragino Sans GB, Arial, sans-serif">${body}</g></svg>`;

let hero=text(66,68,'CAREER / YOUR NEXT CHAPTER',17,'#607565',600);
hero+=text(66,148,'把每一次机会，',58,'#172b20',600)+text(66,222,'变成下一次的底气。',58,'#172b20',600);
hero+=text(68,280,'找工作 · 做项目 · 记经验',24,'#5f6b61')+text(68,321,'一个保存在自己电脑上的长期职业工作台。',24,'#5f6b61');
hero+=rect(932,64,292,280,'#e8eee3','#dce5d7',24)+text(963,114,'Career-Next',32,'#172b20',600);
hero+=text(963,170,'资料留在本机',24)+text(963,211,'AI 建议由你决定',24)+text(963,252,'历史保留当时版本',24)+text(963,305,'LOCAL FIRST · HUMAN DECIDES',13,'#607565',600);
const cards=[['01','机会','围绕一个岗位，把准备串起来'],['02','项目','把实际做过的事，记录下来'],['03','任职','记住每段工作与协作关系'],['04','Wiki','把经验整理成以后能用的知识']];
for(let i=0;i<cards.length;i++){const x=66+i*294;const [number,title,description]=cards[i];hero+=rect(x,388,276,150)+text(x+22,424,number,15,'#829186',600)+text(x+22,470,title,28,'#172b20',600)+text(x+22,507,description,17,'#5f6b61');}
hero+=text(66,584,'求职只是其中一段。你的积累，可以一直继续。',20,'#607565');
const artworks=[['hero',1300,630,shell(1300,630,'Career-Next：长期职业工作台',hero)]];

let diagram=text(48,61,'Career 是怎么工作的',34,'#172b20',600)+text(48,99,'你在界面里操作；本机后台保存正式资料；需要外部服务时，再确认发送。',19,'#5f6b61');
diagram+=rect(34,130,812,670,'#eef2e9','#d8e1d2',24)+text(58,163,'你的电脑',17,'#607565',600);
diagram+=rect(58,185,764,108)+text(82,222,'Chrome 界面',24,'#172b20',600)+text(82,255,'Wiki  /  机会  /  项目  /  任职',21)+text(82,280,'React 负责展示、输入与编辑；Career.app 启动本机 Node 后台。',16,'#5f6b61');
diagram+=arrow('M440 294 V330')+text(460,320,'查询 / 保存命令（Contract 校验）',16,'#607565');
diagram+=rect(58,336,764,260)+text(82,373,'Node 本机后台',24,'#172b20',600)+text(82,404,'每类资料由自己的业务模块管理，跨模块通过公开接口协作。',16,'#5f6b61');
diagram+=rect(82,425,400,143,'#f7f8f4','#dce2d8',12)+text(100,454,'机会',21,'#172b20',600)+text(100,484,'简历  ·  情报  ·  沟通  ·  投递',18)+text(100,515,'面试  ·  Offer',18)+text(100,549,'当前稿、实际投递材料分别保存',16,'#607565');
diagram+=rect(502,425,294,143,'#f7f8f4','#dce2d8',12)+text(520,457,'Wiki  /  项目  /  任职',20,'#172b20',600)+text(520,491,'基础资料  /  原始材料',18)+text(520,527,'来源、关系与各自的历史',16,'#607565');
diagram+=arrow('M440 597 V640')+text(460,624,'唯一写入队列 · 保存回执',16,'#607565');
diagram+=rect(58,647,370,123)+text(80,689,'SQLite',25,'#172b20',600)+text(80,723,'正文、关系、状态与操作记录',18)+text(80,749,'正式资料保存在本机',16,'#607565');
diagram+=rect(448,647,374,123)+text(470,689,'本地文件',25,'#172b20',600)+text(470,723,'原始材料与冻结 PDF',18)+text(470,749,'版本保留当时内容；备份与恢复',16,'#607565');
diagram+=rect(880,185,348,411,'#fffdf6','#e5debf',24)+text(906,225,'按需使用外部能力',24,'#172b20',600)+text(906,261,'AI / Search',24,'#706843',600)+text(906,295,'DeepSeek：整理情报',18)+text(906,325,'Tavily：搜索线索',18);
diagram+=rect(902,348,304,78,'#f2efdf','#e5debf',12)+text(918,379,'选材料 → 看完整外发预览',18)+text(918,409,'明确授权后，才发送本次请求',17);
diagram+=text(906,464,'返回的建议 → 你决定是否采纳',18)+text(906,497,'采纳后，由对应业务模块保存',17,'#5f6b61')+text(906,550,'飞书：只读发现与有限预览',17)+text(906,576,'导入仍按预览与确认流程推进',16,'#5f6b61');
diagram+=arrow('M822 390 H880','#8a958b','6 5')+arrow('M880 495 H826','#8a958b','6 5');
diagram+=rect(880,647,348,123,'#ffffff','#dce2d8',18)+text(906,685,'macOS 窄系统能力',23,'#172b20',600)+text(906,719,'Keychain 保存密钥',18)+text(906,749,'固定 Chromium 打印引擎生成 PDF',16,'#5f6b61');
diagram+=text(48,844,'本机连接：127.0.0.1  ·  正式运行采用 Node / Chrome  ·  AI 不会自动投递或接受 Offer',17,'#607565');
artworks.push(['architecture',1260,880,shell(1260,880,'Career-Next 当前 Node / Chrome 产品架构',diagram)]);

const browser=await chromium.launch({headless:true});
try{for(const [name,width,height,source] of artworks){const file=path.join(directory,name+'.svg');await writeFile(file,source+'\n');const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});await page.goto(pathToFileURL(file).href);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(directory,name+'.png')});await page.close();}}finally{await browser.close();}
console.log('README SVG sources and PNGs rendered.');
