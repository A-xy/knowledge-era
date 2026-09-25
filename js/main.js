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
// 消耗速度 = (加速倍数-1)/秒(真实时间);碎片耗尽自动回 ×1。
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


// 每真实 tick 消耗碎片(调用方传真实时间步长 BASE_DT)
// 消耗 = (倍数-1) × 真实秒;碎片不足 → 自动回 ×1
// 返回当前实际生效倍数(可能已被降回 1)
function consumeTimeShards(realDt){
    let mult = currentTimeMult();
    if(mult <= 1 || DEBUG.enabled)
        return mult;
    let need = (mult - 1) * realDt;
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


// 离线转化:把离线时长转为时间碎片(上限 = 储量上限)
// 替代旧的离线收益系统:离线不再直接产出知识/理论力量/元-力量
function applyOfflineToShards(){
    let now = Date.now();
    let last = game.lastSave || now;
    let dtSec = (now - last) / 1000;
    if(dtSec < 5)
        return 0; // 间隔太短不算离线
    let gained = Math.min(
        Math.floor(dtSec),
        timeMaxShards()
    );
    game.timeShards = Math.min(
        (game.timeShards || 0) + gained,
        timeMaxShards()
    );
    return gained;
}


// 渲染时间页(增量:碎片整数/档位/解锁态变化时重建按钮区)
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
    let key = Math.floor(timeShards()) + ":" + timeMaxShards() + ":" +
        currentTimeMult() + ":" + timeMaxMult();
    if(key === lastTimeKey) return;
    lastTimeKey = key;
    let html = "";
    // 碎片储量
    html += '<div class="time-res">时间碎片:<span class="time-shard">' +
        Math.floor(timeShards()) + '</span> / ' +
        Math.floor(timeMaxShards()) +
        '(储量上限 ' + (timeMaxShards()/3600) + ' 小时)</div>';
    // 当前倍数
    let mult = currentTimeMult();
    html += '<div class="time-res">当前加速:×' + mult +
        (mult > 1
            ? (DEBUG.enabled
                ? ' <span class="time-cost">调试模式免费</span>'
                : ' <span class="time-cost">消耗 ' + (mult - 1) + ' 碎片/秒</span>')
            : '') +
        '</div>';
    // 档位按钮(仅显示已解锁的档位)
    html += '<div class="time-btns">';
    for(let i = 0; i < TIME_CONFIG.mults.length; i++){
        let m = TIME_CONFIG.mults[i];
        if(timeMultUnlocked(m)){
            let active = (mult === m) ? ' active' : '';
            html += '<button class="time-btn' + active + '" data-mult="' + m + '">×' + m +
                (m > 1 ? '<small>' + (m - 1) + '/s</small>' : '') + '</button>';
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


// 当前每 tick 的基准时间步长(秒)
const BASE_DT = 0.05;


loadGame();


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
let offlineShards = applyOfflineToShards();
let offlineNoticeTimer = null;
if(offlineShards > 0){
    let notice = document.getElementById("offlineNotice");
    if(notice){
        notice.style.display = "block";
        notice.innerText =
        "欢迎回来!你离线了 "
        + formatOfflineTime(offlineShards)
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


function update(){



// 真实 tick 基准(BASE_DT 秒);先消耗碎片获得实际倍率
// (碎片不足自动回 ×1;调试模式不消耗且全档可用)
let mult =
consumeTimeShards(BASE_DT);

let dt =
BASE_DT * mult;

// 累计游戏总时间(加速计时,用于"高速研究"等成就)
game.totalTime =
(game.totalTime || 0) + dt;


let speed=
getKnowledgeSpeed();

let gain =
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


// 更新研究 nav 按钮显示(已看过剧情才显示)
updateResearchButton();


renderTheories();

// 想法页面数据(增量更新文本)
renderIdeaPage();

// 时间页面数据(碎片储量/加速档位)
renderTimePage();

// 成就:集中检查达成 + 渲染成就页
updateAchievementsUI();

// 研究页面数据(增量更新文本)
renderResearchPage();

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
