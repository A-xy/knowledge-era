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
    actionExp: 1/20,    // 行动点公式指数(0.05)
    // 论文"参考文献-引用实验成果"(第6行)解锁后改用该指数(0.06)
    actionExpRef: 0.06,
    actionMin: 5,       // 行动点最低值
    bonusCap: 10,       // 里程碑加成上限(重置次数,最大10)
    // 里程碑"无尽阶梯"(阶段9):实验助手速度 ×(1+重置次数/30)
    // 达到 endlessResetCap 次重置时封顶(300 次 → ×11)
    endlessResetDivisor: 30,
    endlessResetCap: 300,
    // "高速研究"成就:相邻两次研究重置的游戏时间间隔 ≤ 该值(秒)即达成。
    // 成就描述文本由 achievements.js 引用此值生成,改这里即可同步。
    fastResearchWindow: 30,
    // 研究总结员触发条件的默认值(玩家可改;以字符串存储,支持"1e10"这类科学计数法)
    //   阈值模式:重置可获得 ≥ 该值 时自动重置
    //   倍数模式:重置可获得 ≥ 上次重置所得 × 该倍数 时自动重置
    summarizerDefaultThreshold: "5",
    summarizerDefaultMultiplier: "2",
    // 阶段需求公式:第 n(n≥4)个研究阶段需要 12 + 4n 想法
    stageFormulaBase: 12,
    stageFormulaStep: 4
};


// 各研究阶段所需的想法数
// 阶段1~3 为早期手调值;阶段4 起统一按公式 12+4n(n = 阶段序号)计算。
// 例:阶段4 = 12+16 = 28,阶段5 = 32,阶段6 = 36 …
const RESEARCH_STAGE_REQUIREMENTS = [
    12,      // 进入阶段1 需要 12 想法
    16,      // 进入阶段2 需要 16 想法
    24       // 进入阶段3 需要 24 想法
];


// 第 n 个研究阶段所需的想法数(1 起算)
// 超出 RESEARCH_STAGE_REQUIREMENTS 的部分走公式 12+4n
function stageRequirement(n){

    if(n >= 1 && n <= RESEARCH_STAGE_REQUIREMENTS.length)
        return RESEARCH_STAGE_REQUIREMENTS[n - 1];

    return RESEARCH_CONFIG.stageFormulaBase
    + RESEARCH_CONFIG.stageFormulaStep * n;

}


// 里程碑列表(按阶段顺序)
// id: 唯一标识  stage: 点亮所需的阶段
// name/desc: 显示文本
// 命名约定:阶段1=基础研究,阶段2=跨学科研究(从实验3起为非物理主题)
//          阶段3=自动化研究,阶段4=前沿研究(前沿领域),阶段9=无尽阶梯
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
    },
    {
        id: "stage4",
        stage: 4,
        name: "前沿研究",
        desc: "基于累计获得的行动点总数,加成知识获取"
    },
    {
        id: "stage9",
        stage: 9,
        name: "无尽阶梯",
        desc: "所有实验助手速度 ×(1+研究重置次数/30),300 次重置时达到上限"
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
// researchStage=0 → 阶段1(12);researchStage=1 → 阶段2(16) …
// 阶段4 起按公式 12+4n 计算(永不封顶,可继续推进)
function nextStageIdeas(){
    return stageRequirement(game.researchStage + 1);
}


// 行动点获取的"基础值":只由知识决定(含最低值限制)
// 公式:5 * (Knowledge / 1e72)^指数,最低 5
// 指数默认 0.05(RESEARCH_CONFIG.actionExp)
// 论文"参考文献-引用实验成果"(第6行)解锁后提升为 0.06(researchActionExp)
function actionPointsBase(){

    let base =
    new Decimal(RESEARCH_CONFIG.actionBase)
    .mul(
        Decimal.pow(
            game.knowledge.div(
                new Decimal(RESEARCH_CONFIG.actionScale)
            ),
            researchActionExp()
        )
    );

    // 最低行动点
    if(base.lt(RESEARCH_CONFIG.actionMin))
        base = new Decimal(RESEARCH_CONFIG.actionMin);

    return base;

}


// 研究里程碑 stage2(跨学科研究):行动点获取 ×2^(研究阶段-1)
// (未点亮返回 ×1)
function actionPointsStageMultiplier(){

    if(!isMilestoneActive("stage2"))
        return new Decimal(1);

    return new Decimal(2).pow(game.researchStage - 1);

}


// 本次研究重置可获得的行动点(基于当前知识)
//   = 基础值 × 里程碑stage2倍数 × 效果6(引言·行动点加成)
// 最终向下取整
function actionPointsGain(){

    return actionPointsBase()
    .mul(actionPointsStageMultiplier())
    // 效果6(引言·行动点加成):×(1+MetaPower)^0.1
    .mul(metaAPBonus())
    .floor();

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


// 里程碑 stage4(前沿研究):基于累计获得的行动点总数加成知识获取
// 公式:知识获取速率 ×(1 + 累计行动点);未点亮时 ×1
function frontierResearchBonus(){

    if(!isMilestoneActive("stage4"))
        return new Decimal(1);

    let base =
    new Decimal(1)
    .add(game.totalResearchPoints || new Decimal(0));

    // 公式已调整为1+totalAP
    return base;

}


// 里程碑"无尽阶梯"(阶段9):所有实验助手速度 ×(1 + 研究重置次数/30)
// 重置次数在 endlessResetCap(300)次时封顶 → 最大 ×11;未点亮时 ×1
function endlessStaircaseBonus(){

    if(!isMilestoneActive("stage9"))
        return new Decimal(1);

    let resets =
    Math.min(
        game.researchResets,
        RESEARCH_CONFIG.endlessResetCap
    );

    return new Decimal(1)
    .add(
        new Decimal(resets)
        .div(RESEARCH_CONFIG.endlessResetDivisor)
    );

}


// "无尽阶梯"当前计入的重置次数(已封顶,用于展示)
function endlessStaircaseResets(){

    return Math.min(
        game.researchResets,
        RESEARCH_CONFIG.endlessResetCap
    );

}


// 研究重置的核心状态变更(供普通研究重置 / 前沿领域进出共用)
// 行动点在重置前按当前知识结算,之后才清空知识/理论/想法/元-力量。
// gainAP       : 是否获得行动点(不足 12 想法时的前沿重置不获得)
// advanceStage : 是否可能推进研究阶段
// 返回本次获得的行动点
function applyResearchResetCore(gainAP, advanceStage){

    let gainedAP =
    gainAP
    ? actionPointsGain()
    : new Decimal(0);

    // 推进研究阶段:若重置时想法数达到当前阶段要求
    // researchStage 从 0 开始:第一次(12想法) → 阶段1
    if(advanceStage
        && game.ideas >= nextStageIdeas())
        game.researchStage++;

    if(gainedAP.gt(0)){

        // 获得行动点
        game.actionPoints =
        game.actionPoints.add(gainedAP);

        // 生涯统计:累计获得的行动点(消费不影响)
        game.totalResearchPoints =
        (game.totalResearchPoints || new Decimal(0))
        .add(gainedAP);

        // 记录"上次重置获得的行动点"(研究总结员·倍数模式的判断依据)
        // 只在真正获得行动点时记录:不足 12 想法的前沿重置(0 AP)不覆盖此值
        game.lastResearchAPGain = gainedAP;

    }

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

    return gainedAP;

}


// 记录一次"正常"研究重置的统计信息(仅当重置满足正常条件,即想法数达标时调用)
//   - 研究重置次数 +1(里程碑 stage1 加成依据)
//   - 刷新最快重置用时(相邻两次正常重置的游戏时间间隔;首次无上次不计)
//   - 可触发"高速研究"(间隔 ≤ fastResearchWindow)
// 前沿领域:想法达标时同样走这里,不足 12 想法则完全不计入任何数据
function recordResearchReset(){

    // 研究重置次数 +1
    game.researchResets++;

    let nowTime =
    game.totalTime || 0;

    // 高速研究:与上次正常重置的游戏时间间隔 ≤ 阈值(默认30秒)
    // (首次无上次记录,不计;达成一次即永久解锁)
    if(game.lastResearchResetTime !== null
        && nowTime - game.lastResearchResetTime
            <= RESEARCH_CONFIG.fastResearchWindow)
        game.fastResearchFlag = true;

    // 生涯统计:最快研究重置用时(首次无上次,不计)
    if(game.lastResearchResetTime !== null){

        let gap =
        nowTime - game.lastResearchResetTime;

        if(game.fastestResearchReset === null
            || game.fastestResearchReset === undefined
            || gap < game.fastestResearchReset)
            game.fastestResearchReset = gap;

    }

    game.lastResearchResetTime = nowTime;

}


// 执行研究重置
// 重置:知识、理论、想法、元力量
// 获得:行动点(基于重置前知识)、推进研究阶段
// 同时计入研究重置次数(里程碑 stage1 依据)、刷新最快重置用时、可触发"高速研究"
function researchReset(){

    if(!canResearchReset())
        return;

    applyResearchResetCore(true, true);

    // 正常研究重置:计入次数 / 最快用时 / 高速研究
    recordResearchReset();

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
    renderFrontierPage();

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
    // 达到阶段1 → 显示两行(下个阶段所需想法数 / 当前想法)
    // 阶段需求由 stageRequirement 计算:阶段4 起按公式 12+4n,可继续推进
    let nextBox =
    document.getElementById(
        "researchNextStage"
    );

    if(nextBox){

        if(game.researchStage < 1){

            nextBox.style.display = "none";

        }else{

            nextBox.style.display = "block";

            nextBox.innerHTML =
            "<p>到下个研究阶段需要:" +
            "<b>" + nextStageIdeas() + " 想法</b></p>" +
            "<p>当前想法:" +
            "<b>" + game.ideas + " / " + nextStageIdeas() + "</b></p>";

        }

    }

    // 里程碑渲染
    renderResearchMilestones();

    // 助手页面渲染
    renderResearchHelpers();

    // 实验页面渲染
    renderExperimentPage();

    // 前沿领域页面渲染(阶段4 解锁)
    renderFrontierPage();

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

    if(m.id === "stage4"){

        return "知识获取 ×(1+累计行动点) | 当前 ×" +
        format(frontierResearchBonus()) +
        " ； 解锁前沿领域";
    }

    if(m.id === "stage9"){

        return "所有实验助手速度 ×(1+研究重置次数/30) | 当前 ×" +
        format(endlessStaircaseBonus()) +
        " (重置次数 " + endlessStaircaseResets() + "/" +
        RESEARCH_CONFIG.endlessResetCap + " 封顶)";
    }

    return m.desc;

}


// ============================================================
// 助手系统
// 消耗行动点解锁助手,解锁后可用开关控制是否启用
// ============================================================

// ============================================================
// 自动实验助手:升级价格膨胀参数(默认值)
// 价格 = 解锁价 × 10^f(x, A, B, N),其中:
//   f(x, a, b, n) = a*x + b*max(x-n, 0)^2
//   x = level + 1(与"第一次升级 = 解锁价 ×10"一致)
// 低等级每级稳定 ×10^A;超过 N 级后叠加二次项,价格快速陡增,
// 抑制后期靠堆等级把实验效率无限拉高(与想法价格/理论升级同构)。
// 每个助手可在 ASSISTANT_LIST 里用自己的 upgradePrice 覆盖。
// 对应实验3(exp3Effect)/实验4(exp4Effect)的"膨胀起始点延后"是给
// 想法价格与理论升级用的,这里不叠加(除非以后明确要求)。
// ============================================================
const EXP_AUTO_PRICE = {
    A: 1,     // 线性指数系数:每升 1 级价格约 ×10^A
    B: 0.2,   // 二次项系数:超过 N 级后价格加速增长
    N: 11     // 二次项生效的起始 x 值(x = level + 1,即 level > 10 后加速)
};


// 助手配置列表
// key: 唯一标识(对应 game.assistants[key])
// price: 解锁所需行动点
// name/desc: 显示文本
// stage: 可选,达到该研究阶段才显示(如研究总结员需要阶段2)
// threshold: 可选,该助手是否有阈值设置(研究总结员的重置AP阈值)
// modeAchievement: 可选,达成该成就后解锁该助手的第二工作模式
//                  (研究总结员:阈值模式 ↔ 倍数模式)
// requires: 可选,需要先解锁的前置助手 key(自动实验助手链式解锁)
// expKey: 可选,对应的实验 key(自动实验助手生产该实验完成次数)
// optimalOps: 可选,对应实验的最优化操作次数(效率上限/已最优化标记)
// upgradePrice: 可选,升级价格膨胀参数(仅自动实验助手用,不填则用 EXP_AUTO_PRICE 默认值)
//   { A, B, N } —— 见 expAutoPriceExponent 的说明
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
        // 达成该成就后解锁"倍数模式"(见 achievements.js 的"项目迭代")
        modeAchievement: "research10",
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
        optimalOps: 20,
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


// ============================================================
// 研究总结员的工作模式
//   threshold 阈值模式(默认):重置可获得 ≥ X 行动点 时自动重置
//   multiple  倍数模式:重置可获得 ≥ 上次重置所得 ×X 时自动重置
//             达成成就"项目迭代"后解锁(见 summarizerModeUnlocked)
// 两个设置值都以**字符串**存储(玩家输入,支持"1e10"这类科学计数法):
// 既能表示超出 double 范围的大数,读档时也无需额外的还原步骤,
// 使用时统一走 new Decimal()。
// ============================================================
const SUMMARIZER_MODE = {
    THRESHOLD: "threshold",
    MULTIPLE: "multiple"
};


// 数值输入格式:整数/小数,可带 e 指数(如 1e10、1e+580、2.5e30)
const SETTING_NUMBER_RE = /^[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?$/;


// 研究总结员的设置对象
function summarizerConf(){

    return game.assistants
    ? game.assistants.researchSummarizer
    : null;

}


// 解锁"倍数模式"的成就 id(取配置;无配置返回 null)
function summarizerModeAchievement(){

    let conf =
    assistantConf("researchSummarizer");

    return (conf && conf.modeAchievement)
    ? conf.modeAchievement
    : null;

}


// 倍数模式是否已解锁
function summarizerModeUnlocked(){

    let id =
    summarizerModeAchievement();

    return id ? isAchievementUnlocked(id) : false;

}


// 研究总结员当前生效的模式(倍数模式未解锁时按阈值模式工作)
function summarizerMode(){

    let a =
    summarizerConf();

    if(!a)
        return SUMMARIZER_MODE.THRESHOLD;

    if(a.mode === SUMMARIZER_MODE.MULTIPLE
        && summarizerModeUnlocked())
        return SUMMARIZER_MODE.MULTIPLE;

    return SUMMARIZER_MODE.THRESHOLD;

}


// 解析玩家输入的数值设置(支持科学计数法)
// 不合法或小于 min → null
function parseSettingValue(str, min){

    if(str === null || str === undefined)
        return null;

    let s =
    String(str).trim();

    if(!SETTING_NUMBER_RE.test(s))
        return null;

    let v =
    new Decimal(s);

    // break_eternity 对非法串会解析成 0,这里再兜一层
    if(!v.isFinite() || v.lt(min))
        return null;

    return v;

}


// 阈值模式:重置可获得 ≥ 该 AP 时自动重置
function summarizerThreshold(){

    let a =
    summarizerConf();

    let v =
    a
    ? parseSettingValue(a.threshold, 1)
    : null;

    return v
    ? v
    : new Decimal(RESEARCH_CONFIG.summarizerDefaultThreshold);

}


// 倍数模式:重置可获得 ≥ 上次重置所得 × 该倍数 时自动重置
function summarizerMultiplier(){

    let a =
    summarizerConf();

    let v =
    a
    ? parseSettingValue(a.multiplier, 1)
    : null;

    return v
    ? v
    : new Decimal(RESEARCH_CONFIG.summarizerDefaultMultiplier);

}


// 本次自动重置所需达到的行动点
//   阈值模式 → 阈值;倍数模式 → 上次重置所得 × 倍数
// 倍数模式下若还没有"上次重置所得"记录 → 返回 null(此时不自动重置)
function summarizerTargetAP(){

    if(summarizerMode() === SUMMARIZER_MODE.MULTIPLE){

        let last =
        game.lastResearchAPGain;

        if(last === null || last === undefined)
            return null;

        last =
        new Decimal(last);

        if(!last.isFinite() || last.lte(0))
            return null;

        return last.mul(summarizerMultiplier());

    }

    return summarizerThreshold();

}


// 研究总结员此刻是否应触发研究重置
function summarizerShouldReset(){

    let target =
    summarizerTargetAP();

    if(target === null)
        return false;

    return actionPointsGain().gte(target);

}


// 设置研究总结员的阈值/倍数(field: "threshold" | "multiplier")
// 支持科学计数法输入;非法输入忽略并把界面恢复为原值
function setSummarizerSetting(key, field, val){

    let a =
    game.assistants[key];

    if(!a)
        return;

    if(field !== "threshold" && field !== "multiplier")
        return;

    if(parseSettingValue(val, 1) === null){
        renderResearchHelpers();
        return;
    }

    a[field] =
    String(val).trim();

    saveGame();

    renderResearchHelpers();

}


// 切换研究总结员的工作模式(阈值 ↔ 倍数;倍数模式未解锁时不动作)
function toggleSummarizerMode(key){

    let a =
    game.assistants[key];

    if(!a || !summarizerModeUnlocked())
        return;

    a.mode =
    summarizerMode() === SUMMARIZER_MODE.MULTIPLE
    ? SUMMARIZER_MODE.THRESHOLD
    : SUMMARIZER_MODE.MULTIPLE;

    saveGame();

    renderResearchHelpers();

}


// 旧存档兼容:研究总结员的模式/倍数设置 + 上次重置行动点
// (读档/导入存档时各调用一次,见 save.js)
function ensureSummarizerCompat(){

    if(!game.assistants)
        game.assistants = {};

    let a =
    game.assistants.researchSummarizer;

    if(!a){

        a =
        game.assistants.researchSummarizer = {
            unlocked: false,
            enabled: true
        };

    }

    if(a.threshold === undefined)
        a.threshold =
        RESEARCH_CONFIG.summarizerDefaultThreshold;

    if(a.multiplier === undefined)
        a.multiplier =
        RESEARCH_CONFIG.summarizerDefaultMultiplier;

    if(a.mode === undefined)
        a.mode = SUMMARIZER_MODE.THRESHOLD;

    if(game.lastResearchAPGain === undefined
        || game.lastResearchAPGain === null)
        game.lastResearchAPGain = null;
    else
        game.lastResearchAPGain =
        new Decimal(game.lastResearchAPGain);

}


// ============================================================
// 自动实验助手(研究阶段3):自动生产实验完成次数
// ============================================================

// 从配置取助手配置(按 key)
function assistantConf(key){

    for(let i = 0; i < ASSISTANT_LIST.length; i++){

        if(ASSISTANT_LIST[i].key === key)
            return ASSISTANT_LIST[i];

    }

    return null;

}


// 兼容旧名:自动实验助手相关代码用的就是这个入口
function expAutoConf(key){

    return assistantConf(key);

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


// 当前速率 = 基础速率 × 2^等级 × 元-力量效果5(引言·实验助手加成)
//                                 × 论文升级"实验导向"加成
//                                 × 里程碑"无尽阶梯"(阶段9)
// (未启用返回 0)
function expAutoRate(key){

    let conf =
    expAutoConf(key);

    if(!conf)
        return 0;

    let a =
    game.assistants[key];

    if(!a || !a.unlocked || !a.enabled)
        return 0;

    // 效果5:所有实验助手的速度 ×(1+MetaPower)^0.05
    // 论文升级"实验导向":×(1+实验完成次数总和)^0.2
    // 里程碑"无尽阶梯":×(1+研究重置次数/30,最大300次)
    return expAutoBaseRate(key)
    * Math.pow(2, a.level || 0)
    * metaExpAssistantBonus().toNumber()
    * experimentOrientedBonus().toNumber()
    * endlessStaircaseBonus().toNumber();

}


// 取某个自动实验助手的升级价格参数(未单独配置时用全局默认值)
function expAutoPrice(key){
    let conf =
    expAutoConf(key);

    return (conf && conf.upgradePrice)
    ? conf.upgradePrice
    : EXP_AUTO_PRICE;
}


// 价格指数 f(x, p) = p.A*x + p.B*max(x-p.N, 0)^2
// x = level + 1(第 1 次升级 x=1 → 解锁价 ×10,与原公式一致)
function expAutoPriceExponent(level, p){
    let x =
    level + 1;

    let over =
    Math.max(x - p.N, 0);

    return p.A * x + p.B * over * over;
}


// 升级价格 = 解锁价 × 10^f(level+1)
// 低等级:每级 ×10;超过 N 级后叠加二次项陡增
function expAutoUpgradeCost(key){

    let conf =
    expAutoConf(key);

    if(!conf)
        return new Decimal(0);

    let a =
    game.assistants[key];

    if(!a)
        return new Decimal(0);

    let p =
    expAutoPrice(key);

    let exp =
    expAutoPriceExponent(a.level || 0, p);

    return new Decimal(conf.price)
    .mul(
        Decimal.pow(10, exp)
    );

}


// 升级自动实验助手(效率×2,价格按 f(level+1) 膨胀)
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


// 只刷新自动实验助手的"效率"数值(不重建卡片)
// 效率 = 基础速率 × 2^等级 × 元-力量效果5,其中效果5 随元-力量持续增长,
// 所以必须每帧更新文本;但结构签名里不能放效率数值,否则会每帧重建整张卡片
// (会打断研究总结员阈值输入框的输入、按钮点击态闪动)
function refreshHelperRates(box){

    if(!box || !box.children)
        return;

    for(let i = 0; i < box.children.length; i++){

        let card = box.children[i];

        let key =
        card ? card._assistantKey : null;

        if(!key)
            continue;

        let conf =
        expAutoConf(key);

        if(!conf)
            continue;

        let a =
        game.assistants[key];

        if(!a || !a.unlocked)
            continue;

        // 自动实验助手:刷新"效率"
        // (效率含元-力量效果5等实时加成,不能只在重建时写一次)
        if(conf.expKey){

            let rateEl =
            card.querySelector
            ? card.querySelector(".assistant-rate")
            : null;

            if(rateEl){

                // 效率数值统一走 format(超过 1e6 显示为科学计数法)
                rateEl.textContent = "效率:"
                + format(a.enabled ? expAutoRate(key) : 0)
                + " 完成/s";

            }

            continue;

        }

        // 研究总结员:刷新倍数模式的"目标 AP"(= 上次重置所得 × 倍数)
        // 该值随研究重置变化,故走轻量刷新而非重建卡片(重建会打断输入)
        if(conf.threshold){

            let targetEl =
            card.querySelector
            ? card.querySelector(".assistant-target")
            : null;

            if(targetEl)
                targetEl.textContent = summarizerTargetText();

        }

    }

}


// 倍数模式"目标 AP"的显示文本(= 上次重置所得 × 倍数)
// 尚无上次重置记录时给出提示
function summarizerTargetText(){

    let target =
    summarizerTargetAP();

    if(target === null)
        return "暂无上次重置记录";

    return format(target);

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

        // 模式/倍数解锁状态会影响卡片结构(模式按钮是否出现)→ 纳入签名
        stateStr += key + ":" + (a.unlocked ? 1 : 0) + (a.enabled ? 1 : 0) + ":" + (a.threshold || 0) + ":" + (a.level || 0) + ":" + (a.mode || "") + ":" + (a.multiplier || 0) + ":" + (key === "researchSummarizer" && summarizerModeUnlocked() ? 1 : 0) + ";";
    }

    // 结构没变 → 不重建卡片,只刷新"效率"数值文本
    // (效率含元-力量效果5,随元-力量实时增长,不能只在重建时写一次)
    if(lastHelperState === stateStr){

        refreshHelperRates(box);

        return;

    }

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
                format(a.enabled ? rate : 0) +
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

                // 触发条件设置(研究总结员:阈值模式 / 倍数模式)
                if(conf.threshold){

                    // 模式切换按钮(倍数模式解锁后才出现)
                    if(conf.modeAchievement
                        && summarizerModeUnlocked()){

                        let isMultiple =
                        summarizerMode() === SUMMARIZER_MODE.MULTIPLE;

                        html +=
                        "<button class=\"assistant-btn mode\" data-key=\"" + conf.key + "\">" +
                        "模式:" + (isMultiple ? "倍数" : "阈值") +
                        "</button>";

                        if(isMultiple){

                            html +=
                            "<div class=\"assistant-threshold\">" +
                            "重置可获得的 AP 达到上次重置获得 AP 的 " +
                            "<input class=\"assistant-input\" type=\"text\" inputmode=\"decimal\" " +
                            "value=\"" + a.multiplier +
                            "\" onchange=\"setSummarizerSetting('" + conf.key + "', 'multiplier', this.value)\">" +
                            " 倍时自动重置(即 <span class=\"assistant-target\" data-summarizer-target" +
                            "=\"" + conf.key + "\"></span> AP)" +
                            "</div>";

                        }else{

                            html +=
                            "<div class=\"assistant-threshold\">" +
                            "重置可获得 " +
                            "<input class=\"assistant-input\" type=\"text\" inputmode=\"decimal\" " +
                            "value=\"" + a.threshold +
                            "\" onchange=\"setSummarizerSetting('" + conf.key + "', 'threshold', this.value)\">" +
                            " AP 时自动重置" +
                            "</div>";

                        }

                    }else{

                        html +=
                        "<div class=\"assistant-threshold\">" +
                        "重置可获得 " +
                        "<input class=\"assistant-input\" type=\"text\" inputmode=\"decimal\" " +
                        "value=\"" + a.threshold +
                        "\" onchange=\"setSummarizerSetting('" + conf.key + "', 'threshold', this.value)\">" +
                        " AP 时自动重置" +
                        "</div>";

                    }

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

                let tag =
                (target && target.tagName)
                ? String(target.tagName).toUpperCase()
                : "";

                // 阈值输入框(及 label/textarea)→ 不触发开关切换
                if(tag === "INPUT"
                    || tag === "TEXTAREA"
                    || tag === "LABEL"
                    || tag === "SELECT")
                    return;

                let cls =
                (target && target.classList)
                ? target.classList
                : null;

                // 卡片上除按钮以外的区域(描述文字、阈值提示行等)→ 忽略
                let isBtn =
                !!cls && cls.contains("assistant-btn");

                if(!isBtn)
                    return;

                // 模式切换按钮(研究总结员:阈值 ↔ 倍数)
                if(cls.contains("mode")){
                    toggleSummarizerMode(key);
                    return;
                }

                // 升级按钮
                if(cls.contains("upgrade")){
                    upgradeExpAutoAssistant(key);
                    return;
                }

                // 解锁按钮(未解锁时的 assistant-btn,无 toggle 类)
                if(!cls.contains("toggle")){
                    unlockAssistant(key);
                    return;
                }

                // 开关按钮
                if(!a.unlocked){
                    unlockAssistant(key);
                }else{
                    toggleAssistant(key);
                }

            });

        }

    }

    // 重建后立即填一次实时数值(效率 / 倍数模式的目标 AP),
    // 避免这些值要等到下一帧刷新才出现
    refreshHelperRates(box);

}
