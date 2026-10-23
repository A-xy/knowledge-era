// ============================================================
// 调试开关
// enabled = true  :调试模式(时间碎片系统解锁全部档位且不消耗碎片)
// enabled = false :正常游戏(档位受成就解锁限制,消耗时间碎片)
// 发布正式版时,把 enabled 改成 false 即可。
// ============================================================
const DEBUG = {
    enabled: false
};

// ============================================================
// 时间碎片系统
// 离线时每 1 秒离线时间 → 1 时间碎片;消耗碎片加速游戏。
// 消耗速度 = (加速倍数-1)^2/秒(真实时间);碎片耗尽自动回 ×1。
// 储量上限 = 4 小时(14400),离线超过部分丢弃。
// 档位:×1/×2/×5/×10/×50/×100;普通模式初始解锁 ×1/×2,
//       更高档位待成就解锁;调试模式(DEBUG.enabled)解锁全部且不耗碎片。
// ============================================================
const TIME_CONFIG = {
    maxShards: 14400,          // 时间碎片储量上限(4 小时 × 3600 秒)
    maxMultUnlock: 2,          // 普通模式初始解锁的最大档位(成就可提升)
    mults: [1, 2, 3, 5, 10, 50, 100]  // 全部速度档位(×3 由成就"第一个想法"解锁)
};


// 当前可解锁的最大档位(普通模式;调试模式解锁全部)
// 成就解锁:×3(第一个想法,1想法)/ ×5(高速研究,30秒内再次重置)
function timeMaxMult(){
    if(DEBUG.enabled)
        return TIME_CONFIG.mults[TIME_CONFIG.mults.length - 1];
    if(isAchievementUnlocked("fastResearch"))
        return 5;
    if(isAchievementUnlocked("idea1"))
        return 3;
    return TIME_CONFIG.maxMultUnlock;
}


// 当前碎片储量上限(成就可提升:解放双手 8h / 全自动化 12h)
function timeMaxShards(){
    if(isAchievementUnlocked("stage3"))
        return 12 * 3600;
    if(isAchievementUnlocked("twoHelpers"))
        return 8 * 3600;
    return TIME_CONFIG.maxShards;
}


// 档位是否已解锁
function timeMultUnlocked(mult){
    return mult <= timeMaxMult();
}


// 当前生效的加速倍数(若碎片不足自动回 ×1,返回实际值)
function currentTimeMult(){
    return game.timeMult || 1;
}


// 设置加速档位(未解锁档忽略)
function setTimeMult(mult){
    if(TIME_CONFIG.mults.indexOf(mult) < 0)
        return;
    if(!timeMultUnlocked(mult))
        return;
    game.timeMult = mult;
    saveGame();
    renderTimePage();
    refreshDebugInfo();
}


// 加速 x 倍的碎片消耗速度 = (x-1)^2 /秒(真实时间)
// 用平方而不是线性,是为了让高倍率真正"贵"起来:
//   ×2 → 1/s(不变)  ×3 → 4/s  ×5 → 16/s  ×10 → 81/s  ×100 → 9801/s
// 所有需要显示/结算消耗的地方都走这个入口,避免两处公式不同步。
function timeShardRate(mult){
    let n = Math.max(mult - 1, 0);
    return n * n;
}


// 每真实 tick 消耗碎片(调用方传真实时间步长)
// 消耗 = (倍数-1)^2 × 真实秒;碎片不足 → 自动回 ×1
// 返回当前实际生效倍数(可能已被降回 1)
function consumeTimeShards(realDt){
    let mult = currentTimeMult();
    if(mult <= 1 || DEBUG.enabled)
        return mult;
    let need = timeShardRate(mult) * realDt;
    if(game.timeShards >= need){
        game.timeShards -= need;
        return mult;
    }
    // 碎片不足:清零并自动降回 ×1
    game.timeShards = 0;
    game.timeMult = 1;
    return 1;
}


// 碎片总储量(当前含小数,显示向下取整)
function timeShards(){
    return game.timeShards;
}


// 单帧最大真实步长(秒):标签页被浏览器节流/挂起后回到前台时,
// 把积压时间切成这样的小步依次结算(不会一步吃掉几十秒)
//
// 为什么必须切小步:速率和状态互相喂养(元-力量越高增速越快),
// 一步算完等于把增速固定在起点 → 系统性低估
// (实测:300 秒一步算出来的元-力量比逐步算少 44%)。
const MAX_FRAME_DT = 1;

// 每次 update 最多花多少毫秒做补帧(时间预算,不是步数上限)。
// 挂机很久后积压可能上千秒,一次补完会把主线程卡住好几秒;
// 按耗时设限就能"这帧先补一部分,剩下的留到下一帧",
// 页面保持流畅,时间也一秒不丢。
const CATCHUP_BUDGET_MS = 12;

// 兜底:单次 update 最多补多少步(防极端情况死循环;
// 正常情况由时间预算先触发)
const MAX_CATCHUP_TICKS = 100000;

// 积压超过这个时长(秒)时,显示"计算中"提示
// (浏览器在同步循环里不会重绘,所以提示只能在这一帧结束后才真正可见;
//  补帧跨帧时会一直保持,补完再延迟淡出)
const COMPUTE_HINT_SECONDS = 1;


// ============================================================
// 时间记账:整个游戏的时间推进只认一个基准 —— lastTickTime(毫秒)
//   · 每结算掉 t 秒,lastTickTime += t(未结算的时间自然积压成"额度")
//   · 额度 = now - lastTickTime,由主循环补帧与离线碎片转化共用
//   · 谁先来谁用,用完即扣,所以两边不会重复计算、也不会留下黑洞
// ============================================================

// 上次真正结算游戏的时间戳(毫秒);由 loadGame 用存档的 lastSave 补种
let lastTickTime = null;

// 离线额度(秒):"还没被结算"的时间。
// 谁先来谁用 —— 主循环的补帧循环与页面加载时的离线碎片转化共用它,
// 所以"开着窗口但被遮挡"和"完全关闭页面"的收益口径一致,
// 不会出现两边都算一遍、或者两边都不算的时间黑洞。
// (调试模式不限额度,与碎片消耗的处理保持一致)
function offlineQuota(){
    if(DEBUG.enabled)
        return Infinity;
    if(lastTickTime === null)
        return 0;
    return Math.max(0, (Date.now() - lastTickTime) / 1000);
}

// 确保计时基准已初始化(无存档 / 存档缺 lastSave 时兜底)。
// 不初始化的话 offlineQuota() 永远返回 0,主循环第一帧就 return,
// 整个游戏会静止不动。
function ensureTickBase(){
    if(lastTickTime === null)
        lastTickTime = Date.now();
}

// 从额度里扣掉 consumed 秒(推进计时基准)
function spendOfflineQuota(consumed){
    if(DEBUG.enabled || lastTickTime === null)
        return;
    lastTickTime += consumed * 1000;
}

// 本帧已跑的补帧步数(每个 update 开头清零)
let catchupSteps = 0;


// 离线转化:把"没被主循环结算掉"的时长转成时间碎片(上限 = 储量上限)
// 替代旧的离线收益系统:离线不再直接产出知识/理论力量/元-力量
//
// 关键 1:转多少就扣多少额度 —— 扣不满的话下一秒又会再转一次,
//   同一段时间会被反复发碎片。
// 关键 2:离线时长要"全量"扣掉额度,不能只扣实际发出的碎片数。
//   因为 gained 受储量上限封顶,离线超过上限时 gained < dtSec,
//   若只扣 gained,剩下的额度会被主循环的补帧循环当成"挂机积压"
//   逐步结算 —— 而这段时间已经算进离线碎片里了,等于白送一份收益。
//   离线时长一律不补帧、只转碎片:超出上限的部分就是"溢出的那部分",
//   本来就该丢弃(与"碎片储量上限=最多存 N 小时"的设计一致)。
function applyOfflineToShards(){
    let dtSec = offlineQuota();
    if(dtSec < 5)
        return 0; // 间隔太短不算离线
    // 转化前先记录,用于提示里显示"实际溢出丢弃了多少"
    let before = game.timeShards || 0;
    let capacity = timeMaxShards();
    let gained = Math.min(
        Math.floor(dtSec),
        capacity
    );
    game.timeShards = Math.min(
        before + gained,
        capacity
    );
    // 整份离线时长全部从额度里扣掉(含溢出的、以及不足 1 秒的零头),
    // 这样主循环拿到的额度就是 0,不会再去补帧重复结算这段时间。
    spendOfflineQuota(dtSec);
    // 实际入账的碎片(受总额上限约束),供提示显示
    return game.timeShards - before;
}


// 轻量刷新时间页里每帧都会变的数字(只改 textContent,不重建 DOM)
function refreshTimeNumbers(){
    let el = document.getElementById("timeShardVal");
    if(el)
        el.innerText = Math.floor(timeShards());
}


// 渲染时间页(增量:仅在"结构"变化时重建按钮区)
let lastTimeKey = "";
function renderTimePage(){
    let panel = document.getElementById("timePanel");
    if(!panel) return;
    // 调试提示显隐(静态说明在 index.html)
    let hint = document.getElementById("timeDebugHint");
    if(hint){
        hint.style.display =
        DEBUG.enabled ? "block" : "none";
    }
    // 结构签名:只放"会改变 DOM 结构"的东西(当前档位 / 储量上限 / 解锁档位)。
    // ⚠ 绝对不能放时间碎片数值:加速时碎片每帧都在减少,签名一变就重建
    //   innerHTML,按钮会在玩家点击的同一帧被替换掉,点击直接丢失 ——
    //   表现为"点了别的倍速没反应"(×5 消耗最快,所以最容易碰上)。
    let key = timeMaxShards() + ":" +
        currentTimeMult() + ":" + timeMaxMult();
    if(key === lastTimeKey){
        // 结构没变 → 只刷新碎片数字
        refreshTimeNumbers();
        return;
    }
    lastTimeKey = key;
    let html = "";
    // 碎片储量(数值由 refreshTimeNumbers 每帧单独刷新)
    html += '<div class="time-res">时间碎片:<span class="time-shard" id="timeShardVal">' +
        Math.floor(timeShards()) + '</span> / ' +
        Math.floor(timeMaxShards()) +
        '(储量上限 ' + (timeMaxShards()/3600) + ' 小时)</div>';
    // 当前倍数
    let mult = currentTimeMult();
    html += '<div class="time-res">当前加速:×' + mult +
        (mult > 1
            ? (DEBUG.enabled
                ? ' <span class="time-cost">调试模式免费</span>'
                : ' <span class="time-cost">消耗 ' + timeShardRate(mult) + ' 碎片/秒</span>')
            : '') +
        '</div>';
    // 档位按钮(仅显示已解锁的档位)
    html += '<div class="time-btns">';
    for(let i = 0; i < TIME_CONFIG.mults.length; i++){
        let m = TIME_CONFIG.mults[i];
        if(timeMultUnlocked(m)){
            let active = (mult === m) ? ' active' : '';
            html += '<button class="time-btn' + active + '" data-mult="' + m + '">×' + m +
                (m > 1 ? '<small>' + timeShardRate(m) + '/s</small>' : '') + '</button>';
        }
    }
    html += '</div>';
    panel.innerHTML = html;
    // 绑定
    let btns = panel.querySelectorAll ? panel.querySelectorAll('.time-btn') : [];
    for(let i = 0; i < btns.length; i++){
        btns[i].addEventListener('click', function(){
            let m = Number(this.dataset.mult);
            if(!isNaN(m)) setTimeMult(m);
        });
    }
}


// 刷新顶部加速提示(×N 或调试提示)
function refreshDebugInfo(){
    let info = document.getElementById("debugInfo");
    if(!info) return;
    let mult = currentTimeMult();
    if(DEBUG.enabled){
        if(mult !== 1){
            info.style.display = "block";
            info.innerText = "调试模式:全局速度 ×" + mult;
        }else{
            info.style.display = "none";
        }
    }else if(mult > 1){
        info.style.display = "block";
        info.innerText = "时间加速 ×" + mult;
    }else{
        info.style.display = "none";
    }
}


// ============================================================
// 补帧提示"计算中"
// 补帧是同步 while 循环,循环执行期间浏览器不会重绘,
// 所以这里只在循环前后改 display,真正可见要等这一帧结束。
// 跨帧补帧时(预算用完、还没补完)提示会一直保持,补完后延迟淡出。
// ============================================================
let computingVisible = false;
let computingHideTimer = null;

function setComputing(on){

    let el =
    document.getElementById("computingHint");

    if(!el)
        return;

    if(on){

        if(computingHideTimer){
            clearTimeout(computingHideTimer);
            computingHideTimer = null;
        }

        if(!computingVisible){
            computingVisible = true;
            el.style.display = "block";
        }

        return;

    }

    // 关闭:延迟 400ms,避免"补完立刻隐藏"导致根本看不见
    if(!computingVisible || computingHideTimer)
        return;

    computingHideTimer = setTimeout(function(){

        computingHideTimer = null;
        computingVisible = false;

        let e =
        document.getElementById("computingHint");

        if(e)
            e.style.display = "none";

    }, 400);

}


// 取本帧真实步长(秒)
function takeRealDt(){
    ensureTickBase();
    let now = Date.now();
    if(now <= lastTickTime)
        return 0;
    return (now - lastTickTime) / 1000;
}


loadGame();

// 计时基准兜底:loadGame 会用存档的 lastSave 补种,
// 但全新玩家(无存档)或存档缺 lastSave 时它仍是 null,
// 这里补成当前时间,否则主循环会一直拿不到额度而不结算。
ensureTickBase();


// 初始化实验数据(首次进入生成,之后从存档读取保持不变)
initExperiment1();


// 从存档恢复加速档位(兼容旧存档:旧 debugSpeed 迁移到 timeMult)
// 仅当档位在当前解锁范围内才沿用,否则回 ×1
if(game.timeMult === undefined
    || TIME_CONFIG.mults.indexOf(game.timeMult) < 0
    || !timeMultUnlocked(game.timeMult)){
    game.timeMult = 1;
}
// 旧存档迁移:debugSpeed(旧调试速度)>1 → 若档位已解锁则沿用
if(game.timeMult <= 1
    && game.debugSpeed && game.debugSpeed > 1
    && TIME_CONFIG.mults.indexOf(game.debugSpeed) >= 0
    && timeMultUnlocked(game.debugSpeed)){
    game.timeMult = game.debugSpeed;
}
// 时间碎片存量兼容
if(game.timeShards === undefined)
    game.timeShards = 0;


// 离线转化:离线时长 → 时间碎片(替代旧离线收益系统)
const OFFLINE_NOTICE_MS = 10000; // 离线提示显示时长(10 秒后自动消失)
// 转化前先记下额度(= 本次离线总时长),提示里要显示"离线了多久"
let offlineSeconds = offlineQuota();
let offlineShards = applyOfflineToShards();
let offlineNoticeTimer = null;
if(offlineShards > 0){
    let notice = document.getElementById("offlineNotice");
    if(notice){
        notice.style.display = "block";
        notice.innerText =
        "欢迎回来!你离线了 "
        + formatOfflineTime(offlineSeconds)
        + ",共获得 "
        + Math.floor(offlineShards)
        + " 时间碎片";
        // 显示一段时间后自动消失
        if(offlineNoticeTimer)
            clearTimeout(offlineNoticeTimer);
        offlineNoticeTimer = setTimeout(function(){
            notice.style.display = "none";
            offlineNoticeTimer = null;
        }, OFFLINE_NOTICE_MS);
    }
}
game.lastSave = Date.now();


if(!game.storyFinished)

startStory();

else{

document
.getElementById("storyScreen")
.style.display="none";


document
.getElementById("gameScreen")
.style.display="block";

}

// 首次渲染时间页与加速提示
renderTimePage();
refreshDebugInfo();

// 格式化离线时长
function formatOfflineTime(sec){

    sec = Math.floor(sec);

    let h = Math.floor(sec / 3600);

    let m = Math.floor((sec % 3600) / 60);

    let s = sec % 60;

    if(h > 0)
        return h + " 小时 " + m + " 分钟";

    if(m > 0)
        return m + " 分钟 " + s + " 秒";

    return s + " 秒";

}


// 页面切换
(function(){

    let nav =
    document.getElementById(
        "pageNav"
    );

    if(!nav)
        return;

    // 页面 id 映射:data-page 值 → 对应页面元素 id
    let pageMap = {
        knowledge: "knowledgePage",
        idea: "ideaPage",
        research: "researchPage",
        origin: "originPage",
        time: "timePage",
        achievement: "achievementPage",
        save: "savePage",
        stats: "statsPage",
        about: "aboutPage"
    };

    function switchPage(page){

        for(let key in pageMap){

            let el =
            document.getElementById(
                pageMap[key]
            );

            if(!el) continue;

            el.style.display =
            (key === page) ? "block" : "none";

        }

        let btns =
        nav.querySelectorAll(".nav-btn");

        for(let i = 0; i < btns.length; i++){

            let b = btns[i];

            if(b.dataset.page === page)
                b.classList.add("active");
            else
                b.classList.remove("active");

        }

    }

    nav.addEventListener("click", function(e){

        let btn = e.target.closest(".nav-btn");

        if(!btn) return;

        switchPage(btn.dataset.page);

    });

})();


// 研究页子页面切换(阶段/助手/实验)
(function(){

    let subNav =
    document.querySelector(
        ".research-subnav"
    );

    if(!subNav)
        return;

    let subMap = {
        stage: "researchStagePage",
        helper: "researchHelperPage",
        experiment: "researchExperimentPage",
        frontier: "researchFrontierPage"
    };

    subNav.addEventListener("click", function(e){

        let btn = e.target.closest(".research-tab");

        if(!btn) return;

        let sub = btn.dataset.sub;

        for(let key in subMap){

            let el =
            document.getElementById(
                subMap[key]
            );

            if(!el) continue;

            el.style.display =
            (key === sub) ? "block" : "none";

        }

        let tabs =
        subNav.querySelectorAll(".research-tab");

        for(let i = 0; i < tabs.length; i++){

            let t = tabs[i];

            if(t.dataset.sub === sub)
                t.classList.add("active");
            else
                t.classList.remove("active");

        }

    });

})();


// 统计页子页面切换(游戏统计/数值统计)
(function(){

    let subNav =
    document.querySelector(
        ".stats-subnav"
    );

    if(!subNav)
        return;

    let subMap = {
        game: "statsGamePage",
        num: "statsNumPage"
    };

    subNav.addEventListener("click", function(e){

        let btn = e.target.closest(".stats-tab");

        if(!btn) return;

        let sub = btn.dataset.sub;

        for(let key in subMap){

            let el =
            document.getElementById(
                subMap[key]
            );

            if(!el) continue;

            el.style.display =
            (key === sub) ? "block" : "none";

        }

        let tabs =
        subNav.querySelectorAll(".stats-tab");

        for(let i = 0; i < tabs.length; i++){

            let t = tabs[i];

            if(t.dataset.sub === sub)
                t.classList.add("active");
            else
                t.classList.remove("active");

        }

    });

})();


// 更新研究 nav 按钮显示状态(已看过研究剧情才显示)
function updateResearchButton(){

    let btn =
    document.querySelector(
        'button.nav-btn[data-page="research"]'
    );

    if(!btn)
        return;

    btn.style.display =
    game.researchStorySeen ? "" : "none";

}


// 单步结算:推进 dt 秒的游戏状态(dt 已含加速倍率)
// 由 update() 的补帧循环调用,一次 update 可能跑多步(积压时)
function tickOnce(dt, mult){


// 累计游戏总时间(加速计时,用于"高速研究"等成就)
game.totalTime =
(game.totalTime || 0) + dt;


let speed=
getKnowledgeSpeed();

let gain=
speed.mul(dt);

game.knowledge=
game.knowledge.add(gain);

// 累计生产的知识总量(跨重置不清零,供游戏统计)
game.totalKnowledgeProduced =
(game.totalKnowledgeProduced || new Decimal(0))
.add(gain);



updateTheoryPower(dt);

// 元-力量随想法数量增长
updateMetaPower(dt);

// 实验2:信号时间随游戏时间推进(解锁后)
updateExperiment2Time(dt);

// 自动实验助手:生产实验完成次数(研究阶段3 解锁,启用时)
updateExpAutoAssistants(dt);

// 前沿领域:以与知识获取速率相同的速率累计灵感(仅前沿领域中)
updateFrontier(dt);

// 你的理论:理论力量自行增长 + 定理入账(第一次完成研究后解锁)
updateOwnTheory(dt);


// 助手:理论研究员——自动解锁和升级理论
if(isAssistantEnabled("theorist")){
    buyMaxTheories();
}

// 助手:想法整理员——知识达标时自动进行想法重置
if(isAssistantEnabled("ideaSorter") && canGetIdea()){
    getIdea();
}

// 助手:研究总结员——可进行研究重置且满足触发条件时自动重置
// (阈值模式:可获得 ≥ 阈值;倍数模式:可获得 ≥ 上次重置所得 × 倍数)
if(isAssistantEnabled("researchSummarizer")
    && canResearchReset()
    && summarizerShouldReset()){
    researchReset();
}

// 助手:论文发表员——本源达到设定阈值时自动完成研究
// (本源里程碑"自动发表"解锁;自动触发时不弹确认框)
if(isAssistantEnabled("paperPublisher")
    && canOriginReset()
    && publisherShouldReset()){
    originReset(true);
}

// 助手:助手提拔员——自动升级四个自动实验助手
// (本源里程碑"自动提升"解锁;直接改状态,界面由渲染层刷新)
promoteExpAssistants();

// 补帧步数计数(调用方据此做死循环兜底)
catchupSteps++;


}


function update(){



// 真实步长:按上一次结算到现在的实际间隔算(不是固定的 0.05 秒),
// 这样标签页被浏览器节流到每秒 1 帧、或窗口被遮挡暂停渲染时
// 进度不会按"帧数"缩水;超过 MAX_FRAME_DT 的部分由下面的"补帧"循环
// 继续结算(与离线碎片转化共用一份额度),不会白丢。
let realDt =
takeRealDt();

if(realDt <= 0)
    return;

// 本次要结算的总时长(秒);不超过离线额度
let pendingDt =
Math.min(realDt, offlineQuota());

if(pendingDt <= 0)
    return;

catchupSteps = 0;

// 积压超过 COMPUTE_HINT_SECONDS → 亮出"计算中"
if(pendingDt >= COMPUTE_HINT_SECONDS)
    setComputing(true);

// 补帧循环:把积压的时间切成 ≤ MAX_FRAME_DT 的小步依次结算。
// 双重刹车:
//   · 时间预算(CATCHUP_BUDGET_MS)—— 本帧最多花这么多毫秒,到点就停,
//     剩下的额度留给下一帧接着补,页面不卡、时间不丢;
//   · 步数兜底(MAX_CATCHUP_TICKS)—— 防极端情况下的死循环。
// 平时 1 帧只有几十毫秒,循环只跑 1 次,开销可忽略。
//
// 碎片按"每一步实际结算的时长"扣(不能按 pendingDt 一次性扣:
// 预算用完时只结算了一部分,先扣全部会多扣碎片)。
let catchupStart =
Date.now();

let mult =
currentTimeMult();

while(pendingDt > 0){

    let step =
    Math.min(pendingDt, MAX_FRAME_DT);

    // 按这一步的时长消耗碎片;碎片不足会自动降回 ×1,
    // 后面的步骤就按 ×1 结算
    mult =
    consumeTimeShards(step);

    pendingDt -= step;

    // 结算掉的时间同步从额度里扣除(与离线转化共用同一本账)
    spendOfflineQuota(step);

    tickOnce(step * mult, mult);

    if(catchupSteps > MAX_CATCHUP_TICKS)
        break;

    // 本帧预算用完 → 剩下的额度留到下一帧继续补
    if(Date.now() - catchupStart >= CATCHUP_BUDGET_MS)
        break;

}

// 没补完 → 提示继续亮着;补完了 → 延迟淡出
setComputing(pendingDt > 0);


// 渲染与剧情判定(每帧只跑一次,不参与补帧循环)
// 注:补帧循环只管"推进状态",渲染留在这里,
// 所以挂机回来补 1000 步也只渲染 1 次,不会卡。

let speed=
getKnowledgeSpeed();


document
.getElementById("knowledge")
.innerText=
format(game.knowledge);



document
.getElementById("kps")
.innerText=
format(speed);


// 知识边界提示:原始知识速度(软上限前)超过当前知识边界时显示
// 边界值受论文升级"摘要"影响,因此这里同步刷新显示的边界数值
let limitNotice =
document.getElementById(
    "knowledgeLimit"
);

let limitValEl =
document.getElementById(
    "knowledgeLimitVal"
);

if(limitValEl)
    limitValEl.innerText = format(knowledgeLimit());

if(limitNotice){

    limitNotice.style.display =
    knowledgeBeyondLimit(
        knowledgeRawSpeed()
    )
    ? "block" : "none";

}


// 顶部加速提示(时间加速 ×N 或调试模式)
refreshDebugInfo();


// 第一次到 12 想法时触发研究剧情(永久,只触发一次)
if(game.ideas >= 12 && !game.researchStorySeen){

    game.researchStorySeen = true;

    saveGame();

    showResearchStory();

    // 触发后阻断本次渲染(剧情界面接管)
    return;

}

// 第一次研究重置后:介绍助手与实验机制
// (研究解锁剧情看过、至少完成过一次研究重置)
if(game.researchResets >= 1
    && game.researchStorySeen
    && !game.firstResetHelperStorySeen){

    game.firstResetHelperStorySeen = true;

    saveGame();

    showFirstResetHelperStory();

    return;

}

// 研究阶段3:介绍重复完成实验与自动实验助手
if(game.researchStage >= 3
    && !game.stage3AutoStorySeen){

    game.stage3AutoStorySeen = true;

    saveGame();

    showStage3AutoStory();

    return;

}

// 知识速度达到 1.79e308/s:介绍知识边界
if(!game.knowledgeLimitStorySeen
    && knowledgeBeyondLimit(
        knowledgeRawSpeed()
    )){

    game.knowledgeLimitStorySeen = true;

    saveGame();

    showKnowledgeLimitStory();

    return;

}

// 研究阶段4:介绍前沿领域
if(game.researchStage >= 4
    && !game.stage4FrontierStorySeen){

    game.stage4FrontierStorySeen = true;

    saveGame();

    showStage4FrontierStory();

    return;

}

// 前沿领域中知识达到 1e180:发现拓展理论(理论6)
// 该标记永久保留(不随研究重置清空),此后理论6 按前置理论规则解锁
if(!game.theory6StorySeen
    && frontierActive()
    && game.knowledge.gte(THEORY6_DISCOVER_KNOWLEDGE)){

    game.theory6StorySeen = true;

    saveGame();

    showTheory6Story();

    return;

}


// 第一次完成研究后:解锁"你的理论"(本源页第二子页)
if(originResets() >= 1 && !game.ownTheoryStorySeen){

    game.ownTheoryStorySeen = true;

    saveGame();

    showOwnTheoryStory();

    return;

}


// 本源里程碑"追寻答案"(完成 10 次研究):
// 只要满足「结论」的三个条件就自动获得该升级(不消耗灵感)。
// 这里每帧判定,挂机时也会自动获得。
if(autoConclusionReady()){

    game.conclusionUnlocked = true;

    saveGame();

    renderFrontierPage();

    // 首次获得:播放本源层剧情
    if(!game.conclusionStorySeen){

        game.conclusionStorySeen = true;

        saveGame();

        showConclusionStory();

        return;

    }

}


// 更新研究 nav 按钮显示(已看过剧情才显示)
updateResearchButton();

// 更新本源 nav 按钮显示(论文"结论"完成后永久显示)
updateOriginNavButton();

// 记录历史最高研究阶段(本源里程碑"记忆印记"保留研究里程碑用)
if(game.researchStage > (game.maxResearchStage || 0))
    game.maxResearchStage = game.researchStage;


renderTheories();

// 想法页面数据(增量更新文本)
renderIdeaPage();

// 时间页面数据(碎片储量/加速档位)
renderTimePage();

// 成就:集中检查达成 + 渲染成就页
updateAchievementsUI();

// 研究页面数据(增量更新文本)
renderResearchPage();

// 本源页面数据(数值每帧刷新,里程碑结构变化才重建)
renderOriginPage();

// 展示面板(增量更新数值)
renderStatsPage();

// 游戏统计(增量更新)
renderGameStats();

// 关于页-游戏介绍(进度解锁变化时重建)
renderAboutIntro();



}



setInterval(update,50);



setInterval(
saveGame,
10000
);
