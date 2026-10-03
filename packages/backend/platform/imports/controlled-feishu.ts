/** Shape-only local fixture; no account, token, network or real Feishu document. */
const documents=[{id:'265d43ef-941b-4dce-9630-606164654966',title:'受控飞书形状候选：团队背景',url:'https://example.invalid/feishu-fixture/team',body:'受控 Feishu-shaped fixture 正文。团队背景用于 G5 导入协议验证；不是实际飞书资料，也不是已核实公司事实。'},{id:'a12fe470-ec7f-4b2e-87f3-ac9c57363083',title:'受控飞书形状候选：项目记录',url:'https://example.invalid/feishu-fixture/project',body:'受控 Feishu-shaped fixture 项目记录。仅本地测试资料。'}];
export function controlledFeishuCandidates(){return documents.map(({body:_,...candidate})=>candidate);}
export function controlledFeishuBody(id:string){return documents.find(document=>document.id===id);}
