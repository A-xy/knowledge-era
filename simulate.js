/**
 * ============================================================
 * 「知识纪元」游戏模拟器
 * ------------------------------------------------------------
 * 模拟"积极玩家"从开局自动游玩,统计到达各想法所需时间。
 *
 * 策略(可自行修改 autoTick 中的逻辑):
 *   - 每 tick:知识按当前速度增长,理论力量/元-力量同步增长
 *   - 知识够就自动解锁理论
 *   - 知识够就购买最大(升级所有已解锁理论到买不起为止)
 *   - 知识够就立即重置获得想法
 *   - (不自动进行研究重置:模拟器不玩研究,聚焦想法层面节奏)
 *
 * 用法:
 *   node simulate.js                  # 模拟到第 3 个想法(默认)
 *   node simulate.js 5                # 模拟到第 5 个想法
 *   node simulate.js 3 0.1            # 第 3 个想法,步长 0.1 秒(更精确,更慢)
 *   node simulate.js 3 0.5 verbose    # 附带每阶段详细日志
 *   node simulate.js 3 0.5 exp1       # 模拟实验1已完成(力量指数 1.5)
 *   node simulate.js 3 0.5 exp2       # 模拟实验2已完成(元-力量底数 3.0)
 *   node simulate.js 3 0.5 exp3       # 模拟实验3已完成(想法价格 N+5)
 *   node simulate.js 3 0.5 exp4       # 模拟实验4已完成(理论升级 N+5)
 *   node simulate.js 3 0.5 expall     # 所有实验都已完成
 * 实验参数:exp1 / exp2 / exp3 / exp4 / expall(模拟器无法玩实验,
 * 用此方式模拟"实验达到最大加成"后的数值环境;
 * exp2 会自动连带 exp1,exp3 连带 exp2,exp4 连带 exp3)
 *
 * 存档推演(从某存档开始):
 *   node simulate.js -savefile save.json 10 0.5
 *       # 读取 save.json 存档,从该存档的当前状态推演到累计 10 想法
 *   node simulate.js -savefile save.json -reset 10 0.5
 *       # 读取存档,但重置理论/想法层级(理论等级、想法数、知识、元-力量清零;
 *       # 研究阶段/重置次数/行动点/助手/实验全部保留),再推演到累计 10 想法
 * 参数位置不固定,可任意顺序:目标想法数/步长为前两个非选项参数。
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SaveCrypto = require(path.join(__dirname, 'js/savecrypto.js'));

// ---------- 参数解析 ----------
const args = process.argv.slice(2);
// 选项参数:-savefile <路径> / -reset / verbose
// 实验标记:exp1/exp2/exp3/exp4/expall(任意位置)
// 位置参数:前两个非选项参数 = 目标想法数 / 步长
let SAVEFILE = null;
let RESET = false;
const EXP_FLAGS = ['exp1','exp2','exp3','exp4','expall'];
const posArgs = [];
for(let i = 0; i < args.length; i++){
  if(args[i] === '-savefile'){
    SAVEFILE = args[i + 1];
    i++;
  }else if(args[i] === '-reset'){
    RESET = true;
  }else if(args[i] === 'verbose' || EXP_FLAGS.includes(args[i])){
    // 非位置参数,跳过
  }else{
    posArgs.push(args[i]);
  }
}
const TARGET_IDEAS = posArgs[0] ? Number(posArgs[0]) : 3;
const DT = posArgs[1] ? Number(posArgs[1]) : 0.5;
const VERBOSE = args.includes('verbose');
const EXP1_DONE = args.includes('exp1') || args.includes('expall');
const EXP2_DONE = args.includes('exp2') || args.includes('expall');
const EXP3_DONE = args.includes('exp3') || args.includes('expall');
const EXP4_DONE = args.includes('exp4') || args.includes('expall');
const ANY_EXP_DONE = EXP1_DONE || EXP2_DONE || EXP3_DONE || EXP4_DONE;
const MAX_TICKS = 50000000; // 防死循环上限

const BASE = __dirname;

// ---------- 加载 break_eternity.js ----------
const beCode = fs.readFileSync(path.join(BASE, 'lib/break_eternity.js'), 'utf8');
const beCtx = vm.createContext({ module: { exports: {} }, exports: {} });
vm.runInContext(beCode, beCtx);
const Decimal = beCtx.module.exports;

// ---------- 轻量 DOM mock(模拟不需要真实渲染) ----------
const elements = {};
function makeEl() {
  return {
    dataset: {}, children: [], style: {}, _listeners: {},
    addEventListener() {}, appendChild() {}, remove() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    set innerText(v) {}, set innerHTML(v) {}
  };
}
global.document = {
  getElementById(id) { return elements[id] || null; },
  createElement() { return makeEl(); },
  querySelector(sel) { return elements[sel.replace(/^\./, '')] || null; }
};
// localStorage mock:支持 setItem 存储,便于 -savefile 载入存档
const __store = {};
global.localStorage = {
  getItem(k) { return (k in __store) ? __store[k] : null; },
  setItem(k, v) { __store[k] = String(v); },
  removeItem(k) { delete __store[k]; }
};
global.alert = () => {}; global.confirm = () => true; global.location = { reload() {} };
['storyScreen','gameScreen','storyText','storyNextBtn','theories','knowledge','kps','buyMaxBtn',
 'ideaCount','metaPower','metaPowerRate','metaEffect','ideaCost','ideaProgress','getIdeaBtn',
 'offlineNotice','debugInfo','pageNav','achvToast','achvSummary','achvPanel','achvDetail','knowledgeLimit',
 'knowledgePage','ideaPage','researchPage','timePage','timePanel','timeDebugHint','achievementPage','savePage',
 'aboutPage','aboutIntroPage','aboutChangelogPage','aboutIntroPanel','about-subnav',
 'researchStageVal','researchAP','researchNeed','researchProgress','researchAPGain',
 'researchResetBtn','researchMilestones','researchStagePage','researchHelperPage',
 'researchExperimentPage','research-subnav','researchNavBtn','metaEffects','researchHelpers',
 'exp1Status','exp1Err','exp1UpgradeBtn','exp1MeasureBtn','exp1SubmitBtn','exp1MeasureU','exp1SubmitU','exp1Msg','exp1Result','exp1History','exp1Stats',
 'exp2Card','exp2Status','exp2Time','exp2Err','exp2UpgradeBtn','exp2MeasureBtn','exp2SubmitBtn','exp2SubmitT','exp2Msg','exp2Result','exp2History','exp2Stats',
 'statsPage','statsPanel','statsGamePage','statsNumPage','statsGamePanel','stats-subnav',
 'exp3Card','exp3Status','exp3Body','exp3X','exp3Y','exp3SubmitBtn','exp3Msg','exp3History','exp3Stats',
 'exp4Card','exp4Status','exp4Body','exp4Len','exp4UpgradeBtn','exp4MeasureBtn','exp4SubmitBtn','exp4Input','exp4Msg','exp4History','exp4Stats']
.forEach(id => { elements[id] = makeEl(); });
// 模拟 HTML 初始隐藏:研究按钮默认不显示
elements['researchNavBtn'].style.display = 'none';

// ---------- 加载游戏脚本(同一共享上下文) ----------
const shared = vm.createContext({
  Decimal, document: global.document, localStorage: global.localStorage,
  console, alert: global.alert, confirm: global.confirm,
  location: global.location, Date, setInterval: () => 0, setTimeout: () => 0,
  clearTimeout: () => {}, clearInterval: () => {}
});
function runJs(rel) { vm.runInContext(fs.readFileSync(path.join(BASE, rel), 'utf8'), shared); }
runJs('js/game.js');
runJs('js/format.js');
runJs('js/story.js');
runJs('js/theories.js');
runJs('js/ideas.js');
runJs('js/research.js');
runJs('js/experiment.js');
runJs('js/save.js');
runJs('js/achievements.js');
runJs('js/stats.js');
runJs('js/about.js');
runJs('js/main.js');

// 关闭调试倍速,确保模拟 1 倍速
vm.runInContext('DEBUG.enabled = false', shared);

// ---------- 存档推演模式(-savefile) ----------
// 读取存档文件,从该存档状态开始推演。
// -reset:读取存档后重置理论/想法层级(理论等级/想法数/知识/元-力量清零),
//         但保留研究阶段/重置次数/行动点/助手/实验完成状态。
let SAVE_START_IDEAS = 0; // 存档起点的当前想法数(用于累计目标)

if(SAVEFILE){

  const savePath = path.resolve(BASE, SAVEFILE);
  let saveText;
  try{
    saveText = fs.readFileSync(savePath, 'utf8');
  }catch(e){
    console.error('[错误] 无法读取存档文件: ' + savePath);
    console.error('      ' + e.message);
    process.exit(1);
  }

  // 加密存档 → 解密;明文旧档 → 原样
  if(SaveCrypto.isEncrypted(saveText)){
    try{
      saveText = SaveCrypto.decryptSync(saveText);
      console.log('[存档] 检测到加密存档,已解密');
    }catch(e){
      console.error('[错误] 存档解密失败: ' + e.message);
      console.error('      请确认文件完整且由同版本游戏导出。');
      process.exit(1);
    }
  }

  // 校验 JSON 基本格式
  try{
    JSON.parse(saveText);
  }catch(e){
    console.error('[错误] 存档文件不是合法 JSON: ' + savePath);
    console.error('      ' + e.message);
    process.exit(1);
  }

  // 写入 localStorage mock 后 loadGame() 恢复 game(与浏览器导入逻辑一致)
  __store['scienceSave'] = saveText;
  vm.runInContext('loadGame()', shared);

  // 记录存档起点的想法数
  SAVE_START_IDEAS = vm.runInContext('game.ideas', shared) || 0;

  // -reset:重置理论/想法层级
  if(RESET){
    vm.runInContext(`
      // 重置理论(等级/解锁/力量)
      for(let id in game.theories){
        let t = game.theories[id];
        t.unlocked = false;
        t.level = 0;
        t.power = new Decimal(1);
      }
      // 重置想法层级
      game.ideas = 0;
      game.knowledge = new Decimal(0);
      game.metaPower = new Decimal(0);
      // 研究阶段/重置次数/行动点/助手/实验保留不变
    `, shared);
    SAVE_START_IDEAS = 0;
  }

  console.log('[存档] 已加载: ' + savePath);
  console.log('        -reset: ' + (RESET ? '是(重置理论/想法层级)' : '否'));
  console.log('        起点想法数 : ' + SAVE_START_IDEAS + '(累计)');
  console.log('        研究阶段   : ' + vm.runInContext('game.researchStage', shared));
  console.log('        研究重置   : ' + vm.runInContext('game.researchResets', shared));
  console.log('        行动点     : ' + vm.runInContext('game.actionPoints.toString()', shared));
  console.log('');

}

// ---------- 实验完成状态(模拟"实验已达最大加成") ----------
// 模拟器无法玩实验,用参数 exp1/exp2/exp3/exp4/expall 直接设置最佳结果。
// 链式依赖:exp4 需要 exp3,exp3 需要 exp2,exp2 需要 exp1。
// 故指定 expN 时会连带完成其前置实验。
const NEED_EXP1 = EXP1_DONE || EXP2_DONE || EXP3_DONE || EXP4_DONE;
const NEED_EXP2 = EXP2_DONE || EXP3_DONE || EXP4_DONE;
const NEED_EXP3 = EXP3_DONE || EXP4_DONE;

if(NEED_EXP1){
  vm.runInContext(`
    // 实验1 完成:精确提交 u0 → 指数 1.5
    if(game.experiments && game.experiments.exp1 && !game.experiments.exp1.completed){
      game.experiments.exp1.completed = true;
      game.experiments.exp1.bestResult = {
        U: game.experiments.exp1.u0,
        deviation: 0
      };
    }
    `, shared);
}

// 实验2 完成:需要先有 exp1 完成才能初始化 exp2
if(NEED_EXP2){
  vm.runInContext(`
    if(game.experiments && game.experiments.exp1 && game.experiments.exp1.completed && !game.experiments.exp2){
      initExperiment2();
    }
    if(game.experiments && game.experiments.exp2 && !game.experiments.exp2.completed){
      game.experiments.exp2.completed = true;
      game.experiments.exp2.bestResult = {
        T: game.experiments.exp2.T,
        deviation: 0
      };
    }
  `, shared);
}

// 实验3 完成:需要先有 exp2 完成才能初始化 exp3
if(NEED_EXP3){
  vm.runInContext(`
    if(game.experiments && game.experiments.exp2 && game.experiments.exp2.completed && !game.experiments.exp3){
      initExperiment3();
    }
    if(game.experiments && game.experiments.exp3){
      game.experiments.exp3.completed = true;
      // 精确答案 → 距离 0 → Exp3Effect 5(想法价格 N 延后最大)
      game.experiments.exp3.bestResult = {
        x: game.experiments.exp3.a,
        y: game.experiments.exp3.b,
        distance: 0
      };
      // 确保系数存在(旧数据兼容)
      if(game.experiments.exp3.c1 === undefined) game.experiments.exp3.c1 = 1;
      if(game.experiments.exp3.c2 === undefined) game.experiments.exp3.c2 = 1;
      if(game.experiments.exp3.c3 === undefined) game.experiments.exp3.c3 = 0;
    }
  `, shared);
}

// 实验4 完成:需要先有 exp3 完成才能初始化 exp4
if(EXP4_DONE){
  vm.runInContext(`
    if(game.experiments && game.experiments.exp3 && game.experiments.exp3.completed && !game.experiments.exp4){
      initExperiment4();
    }
    if(game.experiments && game.experiments.exp4){
      game.experiments.exp4.completed = true;
      // 复原完整序列 → bestLength 10 → Exp4Effect 5(理论升级 N 延后最大)
      game.experiments.exp4.bestLength = 10;
      game.experiments.exp4.bestFragment = game.experiments.exp4.seq;
    }
  `, shared);
}

// ---------- 在上下文中编译自动游玩逻辑(避免每 tick 字符串解析) ----------
vm.runInContext(`
function autoTick(dt){
  // 1. 知识增长
  game.knowledge = game.knowledge.add(getKnowledgeSpeed().mul(dt));
  // 2. 理论力量增长
  updateTheoryPower(dt);
  // 3. 元-力量增长
  updateMetaPower(dt);
  // 4. 自动解锁所有可解锁的理论
  for(let i = 1; i <= 5; i++){
    let id = "theory" + i;
    if(game.theories[id] && !game.theories[id].unlocked && theoryVisible(id)){
      unlockTheory(id);
    }
  }
  // 5. 购买最大(知识够就立刻买)
  buyMaxTheories();
  // 6. 知识够就自动获得想法(重置)
  if(canGetIdea()){
    getIdea();
    __simIdeasTotal++;
  }
  // 7. (不自动研究重置:模拟器不玩研究,测试到想法层面的节奏)
}
`, shared);
const autoTick = vm.runInContext('autoTick', shared);

// ---------- 工具函数 ----------
let simTime = 0;
let totalTicks = 0;
// 累计获得的想法数(研究重置会清空 game.ideas,故用累计值判断目标)
// 存档推演模式:从存档起点的想法数开始累计(目标 TARGET_IDEAS 为累计数)
vm.runInContext('__simIdeasTotal = ' + SAVE_START_IDEAS, shared);

function fmtTime(sec) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
  if (m > 0) return m + 'm ' + s + 's';
  return s + 's';
}

function stateSnapshot() {
  return {
    ideas: vm.runInContext('game.ideas', shared),
    knowledge: vm.runInContext('game.knowledge.toString()', shared),
    metaPower: vm.runInContext('game.metaPower.toString()', shared),
    levels: (() => {
      const lv = {};
      for (let i = 1; i <= 5; i++) {
        lv['theory' + i] = vm.runInContext('game.theories.theory' + i + '.level', shared);
      }
      return lv;
    })()
  };
}

// ---------- 主流程 ----------
console.log('========================================');
console.log('「知识纪元」游戏模拟器');
console.log('========================================');
console.log('目标想法数 : ' + TARGET_IDEAS + '(累计' +
  (SAVEFILE ? ';存档起点 ' + SAVE_START_IDEAS + ',还需获得 ' + Math.max(TARGET_IDEAS - SAVE_START_IDEAS, 0) : '') + ')');
console.log('模拟步长   : ' + DT + 's');
console.log('模式       : ' + (SAVEFILE ? ('存档推演' + (RESET ? '(重置理论/想法)' : '')) : '开局自动游玩'));
console.log('策略       : 自动解锁 + 购买最大 + 自动重置(不含研究)');
console.log('实验状态   : ' + (
  ANY_EXP_DONE
  ? ['实验1','实验2','实验3','实验4'].map((n,i) =>
      [NEED_EXP1,NEED_EXP2,NEED_EXP3,EXP4_DONE][i] ? n + '✓' : ''
    ).filter(Boolean).join(' ')
  : '未完成(默认)'
));
if(ANY_EXP_DONE){
  const parts = [];
  if(EXP1_DONE) parts.push('力量指数 ^1.5');
  if(EXP2_DONE) parts.push('元-力量底数 ×3.0');
  if(EXP3_DONE) parts.push('想法价格 N+5');
  if(EXP4_DONE) parts.push('理论升级 N+5');
  console.log('实验加成   : ' + parts.join(' + '));
}
console.log('');

const results = []; // { label, start, end, snapshot }
let lastIdeaTime = 0;
let phaseStart = simTime;
let lastStage = vm.runInContext('game.researchStage', shared);

while (vm.runInContext('__simIdeasTotal', shared) < TARGET_IDEAS) {

  autoTick(DT);
  simTime += DT;
  totalTicks++;

  if (totalTicks > MAX_TICKS) {
    console.log('[警告] 达到 tick 上限,提前停止。');
    break;
  }

  // 每当累计想法数增加,记录阶段时间
  const curIdeas = vm.runInContext('__simIdeasTotal', shared);
  if (curIdeas >= SAVE_START_IDEAS + results.length + 1) {
    const snap = stateSnapshot();
    results.push({
      label: '第 ' + curIdeas + ' 个想法(累计)',
      start: phaseStart,
      end: simTime,
      snapshot: snap
    });
    phaseStart = simTime;
  }
}

// ---------- 输出结果 ----------
console.log('=== 模拟结果 ===');
console.log('');
for (const r of results) {
  const dur = r.end - r.start;
  console.log('【' + r.label + '】(' + fmtTime(dur) + ')');
  if (VERBOSE) {
    console.log('   推演用时   : ' + fmtTime(r.end));
    console.log('   元-力量    : ' + r.snapshot.metaPower);
    console.log('   各理论等级 : ' +
      Object.keys(r.snapshot.levels).map(k => k.replace('theory','T') + '=' + r.snapshot.levels[k]).join(' '));
    console.log('');
  }
}

console.log('----------------------------------------');
// 存档模式:起点为存档当前想法数(或 reset 后为 0)
const startLabel = SAVEFILE ? ('存档(想法' + SAVE_START_IDEAS + ')') : '开局';
console.log(startLabel + ' → 第' + (SAVE_START_IDEAS + 1) + '个想法 : ' + (results[0] ? fmtTime(results[0].end - results[0].start) : '-'));
for (let i = 1; i < results.length; i++) {
  console.log('第' + (SAVE_START_IDEAS + i) + '个 → 第' + (SAVE_START_IDEAS + i + 1) + '个想法 : ' + fmtTime(results[i].end - results[i].start));
}
console.log('推演总用时   : ' + fmtTime(simTime) + (SAVEFILE ? '(从存档开始)' : ''));
console.log('总 tick 数   : ' + totalTicks);
console.log('研究阶段     : ' + vm.runInContext('game.researchStage', shared));
console.log('研究重置次数 : ' + vm.runInContext('game.researchResets', shared));
console.log('行动点       : ' + vm.runInContext('game.actionPoints.toString()', shared));
console.log('');

// 最终状态
const final = stateSnapshot();
console.log('=== 最终状态 ===');
console.log('当前想法数 : ' + final.ideas + '(累计 ' + vm.runInContext('__simIdeasTotal', shared) + ')');
console.log('元-力量  : ' + final.metaPower);
console.log('各理论等级: ' + Object.keys(final.levels).map(k => k.replace('theory','T') + '=' + final.levels[k]).join(' '));
if(gameHasExp('exp1')) console.log('实验1状态 : ' + (vm.runInContext('game.experiments.exp1.completed', shared) ? '已完成' : '未完成'));
if(gameHasExp('exp2')) console.log('实验2状态 : ' + (vm.runInContext('game.experiments.exp2.completed', shared) ? '已完成' : '未完成'));
if(gameHasExp('exp3')) console.log('实验3状态 : ' + (vm.runInContext('game.experiments.exp3.completed', shared) ? '已完成' : '未完成'));
if(gameHasExp('exp4')) console.log('实验4状态 : ' + (vm.runInContext('game.experiments.exp4.completed', shared) ? '已完成' : '未完成'));
console.log('');

// 如果没跑完
if (vm.runInContext('__simIdeasTotal', shared) < TARGET_IDEAS) {
  console.log('[提示] 未达到目标想法数,可尝试减小步长或提高 MAX_TICKS。');
  process.exit(1);
}

// 辅助:判断实验是否存在(避免直接访问 undefined)
function gameHasExp(key){
  try {
    return !!vm.runInContext('game.experiments && game.experiments.' + key, shared);
  } catch(e){ return false; }
}
