// ============================================================
// 研究系统(Research) —— 第二声望层级
// 达到 12 想法后可进行"研究重置",会重置知识、理论、想法、元力量。
// 研究重置会:推进研究阶段 + 获得行动点。
// 行动点公式:5 * (Knowledge / 1e72)^(1/20),最低 5。
// 阶段推进:重置时若想法数达到下一阶段要求则推进一个阶段。
// 里程碑:达到对应研究阶段时点亮,提供全局效果。
// ============================================================


// ============================================================
// 研究系统配置(调整这里即可改变参数)
// ============================================================
const RESEARCH_CONFIG = {
    minIdeas: 12,       // 研究重置所需的最少想法数
    actionBase: 5,      // 行动点公式基数
    actionScale: 1e72,  // 行动点公式的知识标度
    actionExp: 1/20,    // 行动点公式指数
    actionMin: 5,       // 行动点最低值
    bonusCap: 10,       // 里程碑加成上限(重置次数,最大10)
    designedStages: 3,  // 已设计的研究阶段数(超出则显示"后续研究阶段待更新")
    // "高速研究"成就:相邻两次研究重置的游戏时间间隔 ≤ 该值(秒)即达成。
    // 成就描述文本由 achievements.js 引用此值生成,改这里即可同步。
    fastResearchWindow: 30
};


// 各研究阶段所需的想法数(索引 i 对应"进入第 i+1 阶段")
const RESEARCH_STAGE_REQUIREMENTS = [
    12,      // 进入阶段1 需要 12 想法
    16,      // 进入阶段2 需要 16 想法
    24,      // 进入阶段3 需要 24 想法
    1e100    // 进入阶段4 需要(暂不可达)
];


// 里程碑列表(按阶段顺序)
// id: 唯一标识  stage: 点亮所需的阶段
// name/desc: 显示文本
// 命名约定:阶段1=基础研究,阶段2=跨学科研究(从实验3起为非物理主题)
const RESEARCH_MILESTONES = [
    {
        id: "stage1",
        stage: 1,
        name: "基础研究",
        desc: "知识和所有理论力量获取 ×(1+研究重置次数,最大10)"
    },
    {
        id: "stage2",
        stage: 2,
        name: "跨学科研究",
        desc: "基于研究阶段提升行动点数获取 ×2^(阶段-1)"
    },
    {
        id: "stage3",
        stage: 3,
        name: "自动化研究",
        desc: "允许重复完成实验,并解锁自动实验助手"
    }
];


// 研究重置所需想法数(当前)
function researchNeedIdeas(){
    return RESEARCH_CONFIG.minIdeas;
}


// 是否可以进行研究重置
function canResearchReset(){
    return game.ideas >= researchNeedIdeas();
}


// 下一个研究阶段的解锁想法数(当前阶段对应)
// researchStage=0 → 阶段1(12);researchStage=1 → 阶段2(1e100)...
function nextStageIdeas(){

    if(game.researchStage < RESEARCH_STAGE_REQUIREMENTS.length)
        return RESEARCH_STAGE_REQUIREMENTS[game.researchStage];

    return Infinity;

}


// 本次研究重置可获得的行动点(基于当前知识)
// 公式:5 * (Knowledge / 1e72)^(1/20),最低 5
// 里程碑 stage2 解锁后:×2^(researchStage-1)
function actionPointsGain(){

    let base =
    new Decimal(RESEARCH_CONFIG.actionBase)
    .mul(
        Decimal.pow(
            game.knowledge.div(
                new Decimal(RESEARCH_CONFIG.actionScale)
            ),
            RESEARCH_CONFIG.actionExp
        )
    );

    // 最低行动点
    if(base.lt(RESEARCH_CONFIG.actionMin))
        base = new Decimal(RESEARCH_CONFIG.actionMin);

    // 里程碑 stage2:行动点获取 ×2^(阶段-1)
    if(isMilestoneActive("stage2")){
        base =
        base.mul(
            new Decimal(2).pow(game.researchStage - 1)
        );
    }

    // 行动点取整(向下取整)
    return base.floor();

}


// 行动点获取加成倍率(里程碑 stage2)
// stage=2 时 ×2^(2-1)=×2;stage=3 时 ×4...;未激活返回 ×1
function researchAPBonus(){

    if(!isMilestoneActive("stage2"))
        return new Decimal(1);

    return new Decimal(2)
    .pow(game.researchStage - 1);

}


// 里程碑是否已点亮
function isMilestoneActive(id){

    for(let i = 0; i < RESEARCH_MILESTONES.length; i++){

        let m = RESEARCH_MILESTONES[i];

        if(m.id === id)
            return game.researchStage >= m.stage;

    }

    return false;

}


// 研究加成倍率:基于研究重置次数
// 研究阶段 >= 1 时:×(1 + min(researchResets, 10)),否则 ×1
function researchPowerBonus(){

    if(game.researchStage < 1)
        return new Decimal(1);

    let resets =
    Math.min(
        game.researchResets,
        RESEARCH_CONFIG.bonusCap
    );

    return new Decimal(1)
    .add(resets);

}


// 执行研究重置
// 重置:知识、理论、想法、元力量
// 获得:行动点(基于重置前知识)、推进研究阶段
function researchReset(){

    if(!canResearchReset())
        return;

    // 记录重置前状态(用于结算)
    let resetIdeas = game.ideas;
    let gainedAP = actionPointsGain();

    // 推进研究阶段:若重置时想法数达到当前阶段要求
    // researchStage 从 0 开始:第一次(12想法) → 阶段1
    if(resetIdeas >= nextStageIdeas())
        game.researchStage++;

    // 研究重置次数 +1(里程碑加成依据)
    game.researchResets++;

    // 高速研究成就计时:与上次研究重置的游戏时间间隔 ≤ 阈值(默认30秒)
    // (首次重置无上次记录,不计;达成一次即永久解锁)
    let nowTime = game.totalTime || 0;
    if(game.lastResearchResetTime !== null
        && nowTime - game.lastResearchResetTime
            <= RESEARCH_CONFIG.fastResearchWindow)
        game.fastResearchFlag = true;

    // 生涯统计:最快研究重置用时(相邻两次重置的游戏时间间隔;首次无上次不计)
    if(game.lastResearchResetTime !== null){
        let gap = nowTime - game.lastResearchResetTime;
        if(game.fastestResearchReset === null
            || game.fastestResearchReset === undefined
            || gap < game.fastestResearchReset)
            game.fastestResearchReset = gap;
    }

    game.lastResearchResetTime = nowTime;

    // 获得行动点
    game.actionPoints =
    game.actionPoints.add(gainedAP);

    // 生涯统计:累计获得的研究点(行动点总获得量;消费不影响)
    game.totalResearchPoints =
    (game.totalResearchPoints || new Decimal(0))
    .add(gainedAP);

    // 重置知识(成就"新篇之始"达成后:保留 10 知识)
    game.knowledge =
    isAchievementUnlocked("stage1")
    ? new Decimal(10)
    : new Decimal(0);

    // 重置理论
    for(let id in game.theories){

        let t =
        game.theories[id];

        t.unlocked = false;
        t.level = 0;
        t.power =
        new Decimal(1);

    }

    // 重置想法
    game.ideas = 0;

    // 重置元-力量
    game.metaPower =
    new Decimal(0);

    // 保存
    saveGame();

    // 仅第一次研究重置时播放剧情
    if(!game.researchStorySeen){

        game.researchStorySeen = true;

        saveGame();

        showResearchStory();

    }

    // 刷新界面
    renderTheories();
    renderIdeaPage();
    renderResearchPage();

}


// 绘制研究页面(增量更新文本)
function renderResearchPage(){

    let stageEl =
    document.getElementById(
        "researchStageVal"
    );

    if(stageEl)
        stageEl.innerText = game.researchStage;

    let apEl =
    document.getElementById(
        "researchAP"
    );

    if(apEl)
        apEl.innerText = format(game.actionPoints);

    // 阶段页:重置按钮状态 + 里程碑
    let needEl =
    document.getElementById(
        "researchNeed"
    );

    if(needEl)
        needEl.innerText =
        researchNeedIdeas() + " 想法";

    let progressEl =
    document.getElementById(
        "researchProgress"
    );

    if(progressEl)
        progressEl.innerText =
        game.ideas + " / " + researchNeedIdeas();

    let gainEl =
    document.getElementById(
        "researchAPGain"
    );

    if(gainEl)
        gainEl.innerText = format(actionPointsGain());

    let btn =
    document.getElementById(
        "researchResetBtn"
    );

    if(btn)
        btn.disabled = !canResearchReset();

    // 下个研究阶段信息:
    // 未达到阶段1 → 不显示
    // 达到阶段1 且后面还有已设计阶段 → 显示两行(需要想法数 / 当前想法)
    // 没有已设计阶段 → 显示一行"后续研究阶段待更新"
    let nextBox =
    document.getElementById(
        "researchNextStage"
    );

    if(nextBox){

        if(game.researchStage < 1){

            nextBox.style.display = "none";

        }else if(game.researchStage < RESEARCH_CONFIG.designedStages){

            nextBox.style.display = "block";

            nextBox.innerHTML =
            "<p>到下个研究阶段需要:" +
            "<b>" + nextStageIdeas() + " 想法</b></p>" +
            "<p>当前想法:" +
            "<b>" + game.ideas + " / " + nextStageIdeas() + "</b></p>";

        }else{

            nextBox.style.display = "block";

            nextBox.innerHTML =
            "<p>后续研究阶段待更新</p>";

        }

    }

    // 里程碑渲染
    renderResearchMilestones();

    // 助手页面渲染
    renderResearchHelpers();

    // 实验页面渲染
    renderExperimentPage();

}


// 绘制里程碑列表(增量渲染:阶段/重置次数变化时重建)
let lastMilestoneStage = -1;
let lastMilestoneResets = -1;

function renderResearchMilestones(){

    let box =
    document.getElementById(
        "researchMilestones"
    );

    if(!box)
        return;

    // 阶段和重置次数都没变 → 只更新数值文本
    if(lastMilestoneStage === game.researchStage
        && lastMilestoneResets === game.researchResets){

        let vals =
        box.querySelectorAll(".milestone-val");

        for(let i = 0; i < vals.length; i++){

            let el = vals[i];

            let mid = el.dataset.milestoneId;

            for(let j = 0; j < RESEARCH_MILESTONES.length; j++){

                let m = RESEARCH_MILESTONES[j];

                if(m.id === mid){
                    el.innerText = milestoneDesc(m);
                    break;
                }

            }

        }

        return;

    }

    lastMilestoneStage = game.researchStage;
    lastMilestoneResets = game.researchResets;

    box.innerHTML = "";

    for(let i = 0; i < RESEARCH_MILESTONES.length; i++){

        let m = RESEARCH_MILESTONES[i];

        let active =
        isMilestoneActive(m.id);

        let div =
        document.createElement("div");

        div.className = "milestone"
        + (active ? " active" : "");

        if(active){

            div.dataset.unlocked = "1";

            div.innerHTML =
            "<span class=\"milestone-name\">" + m.name + "</span>" +
            "<span class=\"milestone-val\" data-milestone-id=\"" + m.id + "\">" +
            milestoneDesc(m) +
            "</span>";

        }else{

            div.innerHTML =
            "<span class=\"milestone-name\">" + m.name + "</span>" +
            "<span class=\"milestone-lock\">🔒 达到研究阶段 " +
            m.stage +
            " 以点亮</span>";

        }

        box.appendChild(div);

    }

}


// 里程碑效果描述(带当前数值)
function milestoneDesc(m){

    if(m.id === "stage1"){

        let resets =
        Math.min(
            game.researchResets,
            RESEARCH_CONFIG.bonusCap
        );

        return "知识与所有理论力量获取 ×(1+重置次数,最大10) | 当前 ×" + (1 + resets) + " ； 购买最大按钮始终可用";
    }

    if(m.id === "stage2"){

        return "行动点数获取 ×2^(阶段-1) | 当前 ×" +
        format(researchAPBonus()) +
        " ； 解锁新助手与实验3/4";
    }

    if(m.id === "stage3"){

        return "允许重复完成实验(重新开始会保留升级状态);解锁自动实验助手";
    }

    return m.desc;

}


// ============================================================
// 助手系统
// 消耗行动点解锁助手,解锁后可用开关控制是否启用
// ============================================================

// 助手配置列表
// key: 唯一标识(对应 game.assistants[key])
// price: 解锁所需行动点
// name/desc: 显示文本
// stage: 可选,达到该研究阶段才显示(如研究总结员需要阶段2)
// threshold: 可选,该助手是否有阈值设置(研究总结员的重置AP阈值)
// requires: 可选,需要先解锁的前置助手 key(自动实验助手链式解锁)
// expKey: 可选,对应的实验 key(自动实验助手生产该实验完成次数)
// optimalOps: 可选,对应实验的最优化操作次数(效率上限/已最优化标记)
// upgradePrice: 可选,第一次升级价格(自动实验助手:解锁价 ×10)
const ASSISTANT_LIST = [
    {
        key: "theorist",
        name: "理论研究员",
        price: 5,
        desc: "自动解锁和升级理论"
    },
    {
        key: "ideaSorter",
        name: "想法整理员",
        price: 10,
        desc: "自动进行想法重置"
    },
    {
        key: "researchSummarizer",
        name: "研究总结员",
        price: 5000,
        stage: 2,
        threshold: true,
        desc: "自动进行研究重置(可设置重置阈值)"
    },
    {
        key: "expAuto1",
        name: "实验1自动助手",
        price: 5e8,
        stage: 3,
        expKey: "exp1",
        optimalOps: 9,
        desc: "自动完成实验1(非线性元件测量)"
    },
    {
        key: "expAuto2",
        name: "实验2自动助手",
        price: 5e9,
        stage: 3,
        requires: "expAuto1",
        expKey: "exp2",
        optimalOps: 15,
        desc: "自动完成实验2(信号周期测量)"
    },
    {
        key: "expAuto3",
        name: "实验3自动助手",
        price: 5e10,
        stage: 3,
        requires: "expAuto2",
        expKey: "exp3",
        optimalOps: 20,
        desc: "自动完成实验3(函数优化)"
    },
    {
        key: "expAuto4",
        name: "实验4自动助手",
        price: 5e11,
        stage: 3,
        requires: "expAuto3",
        expKey: "exp4",
        optimalOps: 6,
        desc: "自动完成实验4(DNA测序)"
    }
];


// 助手是否已解锁
function isAssistantUnlocked(key){

    let a =
    game.assistants[key];

    return a ? a.unlocked : false;

}


// 助手开关是否启用(未解锁视为关闭)
function isAssistantEnabled(key){

    let a =
    game.assistants[key];

    return a ? (a.unlocked && a.enabled) : false;

}


// 解锁助手(消耗行动点)
function unlockAssistant(key){

    // 已解锁则跳过
    if(isAssistantUnlocked(key))
        return;

    let a =
    game.assistants[key];

    if(!a)
        return;

    // 找配置
    let conf = null;

    for(let i = 0; i < ASSISTANT_LIST.length; i++){

        if(ASSISTANT_LIST[i].key === key){
            conf = ASSISTANT_LIST[i];
            break;
        }

    }

    if(!conf)
        return;

    // 行动点不足
    if(game.actionPoints.lt(conf.price))
        return;

    game.actionPoints =
    game.actionPoints.sub(conf.price);

    a.unlocked = true;
    a.enabled = true;

    saveGame();

    renderResearchHelpers();

}


// 切换助手开关
function toggleAssistant(key){

    let a =
    game.assistants[key];

    if(!a || !a.unlocked)
        return;

    a.enabled = !a.enabled;

    saveGame();

    renderResearchHelpers();

}


// 绘制助手页面(增量渲染:unlocked/enabled 变化时重建)
let lastHelperState = "";

// 助手当前是否可见(有 stage 限制则需达到对应阶段;有 requires 则需前置已解锁)
function assistantVisible(key){

    for(let i = 0; i < ASSISTANT_LIST.length; i++){

        let conf = ASSISTANT_LIST[i];

        if(conf.key !== key)
            continue;

        if(conf.stage !== undefined
            && game.researchStage < conf.stage)
            return false;

        // 前置助手未解锁 → 不显示(自动实验助手链式解锁)
        if(conf.requires !== undefined
            && !isAssistantUnlocked(conf.requires))
            return false;

        return true;

    }

    return true;

}


// 设置助手阈值(研究总结员:重置可获得 X AP 时自动重置)
function setAssistantThreshold(key, val){

    let a =
    game.assistants[key];

    if(!a)
        return;

    val = Number(val);

    if(isNaN(val) || val < 1)
        return;

    a.threshold = Math.floor(val);

    saveGame();

    renderResearchHelpers();

}


// ============================================================
// 自动实验助手(研究阶段3):自动生产实验完成次数
// ============================================================

// 从配置取自动实验助手配置
function expAutoConf(key){

    for(let i = 0; i < ASSISTANT_LIST.length; i++){

        if(ASSISTANT_LIST[i].key === key)
            return ASSISTANT_LIST[i];

    }

    return null;

}


// 基础速率 = 0.1 / max(最少操作次数, 最优化操作次数)
// 对应实验未解锁或没有最少操作记录 → 0
function expAutoBaseRate(key){

    let conf =
    expAutoConf(key);

    if(!conf || !conf.expKey)
        return 0;

    let e =
    game.experiments[conf.expKey];

    if(!e)
        return 0;

    if(e.bestOperations === null
        || e.bestOperations === undefined)
        return 0;

    return 0.1 / Math.max(
        e.bestOperations,
        conf.optimalOps
    );

}


// 当前速率 = 基础速率 × 2^等级(未启用返回 0)
function expAutoRate(key){

    let conf =
    expAutoConf(key);

    if(!conf)
        return 0;

    let a =
    game.assistants[key];

    if(!a || !a.unlocked || !a.enabled)
        return 0;

    return expAutoBaseRate(key)
    * Math.pow(2, a.level || 0);

}


// 升级价格 = 解锁价 × 10^(等级+1)(第一次升级 = 解锁价 ×10)
function expAutoUpgradeCost(key){

    let conf =
    expAutoConf(key);

    if(!conf)
        return new Decimal(0);

    let a =
    game.assistants[key];

    if(!a)
        return new Decimal(0);

    return new Decimal(conf.price)
    .mul(
        Decimal.pow(10, (a.level || 0) + 1)
    );

}


// 升级自动实验助手(效率×2,价格×10)
function upgradeExpAutoAssistant(key){

    let conf =
    expAutoConf(key);

    let a =
    game.assistants[key];

    if(!conf || !a || !a.unlocked)
        return "locked";

    let cost =
    expAutoUpgradeCost(key);

    if(game.actionPoints.lt(cost))
        return "noAP";

    game.actionPoints =
    game.actionPoints.sub(cost);

    a.level =
    (a.level || 0) + 1;

    saveGame();

    renderResearchHelpers();

    return "ok";

}


// 每 tick 生产完成次数(仅启用的自动助手)
// completions 存小数,显示与效果计算时向下取整
function updateExpAutoAssistants(dt){

    if(!game.assistants)
        return;

    for(let i = 0; i < ASSISTANT_LIST.length; i++){

        let conf =
        ASSISTANT_LIST[i];

        if(!conf.expKey)
            continue;

        let a =
        game.assistants[conf.key];

        if(!a || !a.unlocked || !a.enabled)
            continue;

        let rate =
        expAutoRate(conf.key);

        if(rate <= 0)
            continue;

        let e =
        game.experiments[conf.expKey];

        if(!e)
            continue;

        if(e.completions === undefined)
            e.completions = 0;

        e.completions += rate * dt;

    }

}


// 该助手对应的实验是否"已最优化"(最少操作次数 ≤ 最优化操作次数)
function expAutoOptimized(key){

    let conf =
    expAutoConf(key);

    if(!conf || !conf.expKey)
        return false;

    let e =
    game.experiments[conf.expKey];

    if(!e || e.bestOperations === null
        || e.bestOperations === undefined)
        return false;

    return e.bestOperations <= conf.optimalOps;

}


function renderResearchHelpers(){

    let box =
    document.getElementById(
        "researchHelpers"
    );

    if(!box)
        return;

    // 状态没变 → 不重建
    // 注意:包含当前行动点——研究重置/购买会使 AP 变化,
    // 若不含则按钮 disabled 状态不会更新(需刷新才修复)
    let stateStr =
    "ap:" + game.actionPoints.toString() + ";";

    for(let i = 0; i < ASSISTANT_LIST.length; i++){

        let key = ASSISTANT_LIST[i].key;

        // 阶段未达 → 视为不存在,不参与状态
        if(!assistantVisible(key))
            continue;

        let a = game.assistants[key];

        stateStr += key + ":" + (a.unlocked ? 1 : 0) + (a.enabled ? 1 : 0) + ":" + (a.threshold || 0) + ":" + (a.level || 0) + ";";
    }

    if(lastHelperState === stateStr)
        return;

    lastHelperState = stateStr;

    box.innerHTML = "";

    let anyExpAutoUnlocked = false;

    for(let i = 0; i < ASSISTANT_LIST.length; i++){

        let conf = ASSISTANT_LIST[i];

        // 阶段限制/前置限制:不满足则不显示
        if(!assistantVisible(conf.key))
            continue;

        let a = game.assistants[conf.key];

        let div =
        document.createElement("div");

        div.className = "assistant-card"
        + (a.unlocked ? " active" : "");

        let html =
        "<div class=\"assistant-head\">" +
        "<span class=\"assistant-name\">" + conf.name + "</span>" +
        "<span class=\"assistant-price\">" + format(conf.price) + " 行动点</span>" +
        "</div>" +
        "<div class=\"assistant-desc\">" + conf.desc + "</div>";

        if(!a.unlocked){

            let canAfford =
            game.actionPoints.gte(conf.price);

            html +=
            "<button class=\"assistant-btn\" data-key=\"" + conf.key + "\" " +
            (canAfford ? "" : "disabled") + ">" +
            "解锁(" + format(conf.price) + " AP)" +
            "</button>";

        }else{

            // 自动实验助手:记录已解锁,显示升级/效率
            if(conf.expKey){

                anyExpAutoUnlocked = true;

                let rate =
                expAutoRate(conf.key);

                html +=
                "<button class=\"assistant-btn toggle\" data-key=\"" + conf.key + "\">" +
                (a.enabled ? "开" : "关") +
                "</button>" +
                "<span class=\"assistant-rate\">效率:" +
                (a.enabled ? rate.toFixed(4) : "0.0000") +
                " 完成/s</span>" +
                "<span class=\"assistant-level\">等级 " + (a.level || 0) + "</span>";

                let upCost =
                expAutoUpgradeCost(conf.key);

                let canAffordUp =
                game.actionPoints.gte(upCost);

                html +=
                "<button class=\"assistant-btn upgrade\" data-key=\"" + conf.key + "\" " +
                (canAffordUp ? "" : "disabled") + ">" +
                "升级(" + format(upCost) + " AP)" +
                "</button>";

            }else{

                html +=
                "<button class=\"assistant-btn toggle\" data-key=\"" + conf.key + "\">" +
                (a.enabled ? "开" : "关") +
                "</button>";

                // 阈值设置(研究总结员)
                if(conf.threshold){
                    html +=
                    "<div class=\"assistant-threshold\">" +
                    "重置可获得 <input type=\"number\" min=\"1\" step=\"1\" value=\"" + a.threshold +
                    "\" onchange=\"setAssistantThreshold('" + conf.key + "', this.value)\"> AP 时自动重置" +
                    "</div>";
                }

            }

        }

        div.innerHTML = html;

        div._assistantKey = conf.key;

        box.appendChild(div);

    }

    // 自动实验助手效率提示(任一解锁后显示)
    if(anyExpAutoUnlocked){

        let tip =
        document.createElement("div");

        tip.className = "assistant-tip";

        tip.innerHTML =
        "在相应实验最优化前,自动实验助手的效率与对应实验的最少操作次数反比。";

        box.appendChild(tip);

    }

    // 绑定点击(按钮)
    let btns =
    box.querySelectorAll(".assistant-btn");

    // mock 兼容:直接遍历 children 处理
    for(let i = 0; i < box.children.length; i++){

        let child = box.children[i];

        if(child._assistantKey){

            let key = child._assistantKey;
            let a = game.assistants[key];

            // 直接绑定:内部闭包调用
            child.addEventListener("click", function(e){

                let target = e && e.target ? e.target : null;

                // 升级按钮
                if(target && target.classList.contains("upgrade")){
                    upgradeExpAutoAssistant(key);
                    return;
                }

                if(!a.unlocked){
                    unlockAssistant(key);
                }else{
                    toggleAssistant(key);
                }

            });

        }

    }

}
