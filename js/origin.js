// ============================================================
// 本源(Origin) —— 第三声望层级
// 论文升级「结论」完成后解锁,此后本源页面永久显示。
// 在这里可以"完成研究"(本源重置):
//   条件:当前持有论文升级「结论」
//   获得:本源 = floor((本轮累计行动点 / 1e80)^(1/40) × 2^(研究阶段-10) × 阶梯倍率)
//         ⚠ 累计行动点会在完成研究时清零,所以本源是"每次研究单独结算"的
// 本源重置会重置:行动点、研究阶段、助手(解锁与等级)、灵感、论文升级、
//   实验重复完成次数、研究层里程碑,以及理论与想法页面的内容(含知识)。
// 本源重置不会重置:实验的首次完成效果(bestEver)、实验的最优操作数、
//   实验的设备升级次数、研究重置次数、已登记的成就(因此实验/助手/前沿领域仍可见),
//   以及本源与完成次数本身。
// 完成 1~5 次研究依次点亮 5 个本源里程碑(见 ORIGIN_CONFIG.milestones)。
// ============================================================


// ============================================================
// 配置(调整这里即可改变本源层参数)
// ============================================================
const ORIGIN_CONFIG = {
    // 本源数量公式:floor((累计AP / apScale)^apExp × 2^(研究阶段 - stageBase) × 阶梯倍率)
    apScale: new Decimal("1e80"),
    apExp: 1 / 40,          // 40 次方根
    stageBase: 10,          // 研究阶段每高出 10 一级,本源翻倍

    // 本源里程碑"无尽阶梯II"(完成 30 次研究):本源 ×(1+完成次数/除数)
    // 完成 staircaseCap 次时封顶(300 → ×11)
    staircaseDivisor: 30,
    staircaseCap: 300,

    // 论文发表员的默认阈值(本源;玩家可在助手页改)
    publisherDefaultThreshold: "1",

    // 里程碑(按完成研究次数点亮)
    //   n: 需要完成的研究次数
    //   id: 代码内判断用
    milestones: [
        {
            n: 1,
            id: "commonExp",
            name: "通用实验",
            desc: "重置后,以四个实验已完成 1 次的状态开始"
        },
        {
            n: 2,
            id: "longCompany",
            name: "长久陪伴",
            desc: "所有助手的解锁状态不再会被重置(自动实验助手的等级仍会清空)"
        },
        {
            n: 3,
            id: "memoryMark",
            name: "记忆印记",
            desc: "所有研究页面的里程碑不再会被重置"
        },
        {
            n: 4,
            id: "autoPromote",
            name: "自动提升",
            desc: "在助手页面解锁助手提拔员"
        },
        {
            n: 5,
            id: "manuscript",
            name: "保存手稿",
            desc: "灵感以及除结论外的所有论文升级不再会被重置"
        },
        {
            n: 10,
            id: "seekAnswer",
            name: "追寻答案",
            desc: "满足论文升级「结论」的三个条件时自动获得该升级(不消耗灵感)"
        },
        {
            n: 20,
            id: "autoPublish",
            name: "自动发表",
            desc: "在助手页面解锁论文发表员"
        },
        {
            n: 30,
            id: "endlessStair2",
            name: "无尽阶梯II",
            desc: "本源获取 ×(1+完成研究次数/30),完成 300 次研究时达到上限"
        }
    ]
};


// ============================================================
// 你的理论(本源层第二子页)
// 理论力量 p 以 baseRate 每秒增长,速率再乘 2^(未使用定理数)。
// p 不受任何其它系统加成(元-力量 / 研究里程碑 / 论文都不影响它)。
// Effect = p(购买"改写公式"后为 p^2),直接乘在知识 / 元-力量 / 行动点的产出上。
//
// 定理:三种途径各自按门槛自动获得,三者之和即定理总数(只增不减 ——
// 知识被本源重置清空后,已经拿到的定理不会丢)。
//   知识     :第 n 个需要 10^(600n)
//   累计AP   :第 n 个需要 10^(40n)
//   累计本源 :第 n 个需要 2^n
// 每个"未使用"的定理使理论力量获取 ×2;购买升级会消耗定理。
// ============================================================
const OWN_THEORY_CONFIG = {
    baseRate: 0.1,       // 理论力量基础获取速率(每秒)
    theoremMult: 2,      // 每个未使用定理使获取速率 ×2
    knowledgeBase: 600,  // 第 n 个定理需要 10^(knowledgeBase*n) 知识
    apBase: 40,          // 第 n 个定理需要 10^(apBase*n) 累计行动点
    originBase: 2,       // 第 n 个定理需要 originBase^n 累计本源
    // 消耗定理的升级(数组顺序即显示顺序)
    upgrades: [
        {
            key: "powerSquared",
            name: "改写公式",
            desc: "将公式改为 Effect = p^2",
            cost: 6
        }
    ]
};


// ============================================================
// 本源升级(本源页第三子页;第一次完成研究后解锁)
// 消耗本源换取永久升级。本源本身不会被"完成研究"重置。
// ⚠ "真·无尽阶梯"的重置次数倍率按**累计本源**计算
//   (floor(√(累计本源+1))),只增不减:购买升级花掉本源也不会让它下降。
// ============================================================
const ORIGIN_UPGRADE_LIST = [
    {
        key: "multiPaper",
        name: "多元论文",
        type: "once",
        cost: new Decimal(5),
        desc: "论文升级「理论部分-实验导向」「实验部分-参考实验3」" +
              "「参考文献-引用实验成果」不再与同行的其它升级冲突"
    },
    {
        key: "trueStaircase",
        name: "真·无尽阶梯",
        type: "once",
        cost: new Decimal(10),
        desc: "移除里程碑「基础研究」「无尽阶梯」的加成上限;" +
              "研究重置次数 ×floor(√(累计本源+1))"
    },
    {
        key: "deepOrigin",
        name: "深入本源",
        type: "level",
        cost: new Decimal(10),
        costGrowth: 10,     // 每级价格 ×10
        desc: "本源获取 ×2"
    }
];


// ============================================================
// 旧存档兼容(读档 / 导入存档时各调用一次,见 save.js)
// ============================================================
function ensureOriginCompat(){

    if(game.origin === undefined)
        game.origin = new Decimal(0);
    else if(!(game.origin instanceof Decimal))
        game.origin = new Decimal(game.origin);

    if(game.originResets === undefined)
        game.originResets = 0;

    if(game.originUnlocked === undefined)
        game.originUnlocked = false;

    // 历史最高研究阶段:旧存档至少取当前阶段
    if(game.maxResearchStage === undefined)
        game.maxResearchStage = game.researchStage || 0;

    if(game.conclusionStorySeen === undefined)
        game.conclusionStorySeen = false;

    // 完成研究的统计:本轮研究的起算时间
    // (旧存档可能还带 lastOriginElapsed / lastOriginGain,已废弃,不再读写)
    if(game.lastOriginResetTime === undefined)
        game.lastOriginResetTime = null;

    // 已解锁本源却没记过起算时间(首次完成研究之前的老存档)→ 以当前总时间为准
    if(game.originUnlocked
        && (game.lastOriginResetTime === null
            || game.lastOriginResetTime === undefined))
        game.lastOriginResetTime = game.totalTime || 0;

    // 助手提拔员(本源里程碑"自动提升"解锁显示)
    if(!game.assistants)
        game.assistants = {};
    if(game.assistants.promotor === undefined){
        game.assistants.promotor = {
            unlocked: false,
            enabled: true
        };
    }

    // 论文发表员(本源里程碑"自动发表"解锁显示)
    // 阈值与研究总结员一样以**字符串**存储,支持科学计数法
    if(game.assistants.paperPublisher === undefined){
        game.assistants.paperPublisher = {
            unlocked: false,
            enabled: true,
            threshold: ORIGIN_CONFIG.publisherDefaultThreshold
        };
    }else if(game.assistants.paperPublisher.threshold === undefined){
        game.assistants.paperPublisher.threshold =
        ORIGIN_CONFIG.publisherDefaultThreshold;
    }

    // ---- 你的理论 ----
    if(game.ownTheory === undefined)
        game.ownTheory = new Decimal(1);
    else if(!(game.ownTheory instanceof Decimal))
        game.ownTheory = new Decimal(game.ownTheory || 1);

    if(!game.theorems || typeof game.theorems !== "object")
        game.theorems = { knowledge: 0, ap: 0, origin: 0 };
    if(game.theorems.knowledge === undefined)
        game.theorems.knowledge = 0;
    if(game.theorems.ap === undefined)
        game.theorems.ap = 0;
    if(game.theorems.origin === undefined)
        game.theorems.origin = 0;

    if(!game.theoremUpgrades || typeof game.theoremUpgrades !== "object")
        game.theoremUpgrades = {};

    if(game.totalOrigin === undefined)
        game.totalOrigin = new Decimal(0);
    else if(!(game.totalOrigin instanceof Decimal))
        game.totalOrigin = new Decimal(game.totalOrigin || 0);

    if(game.ownTheoryStorySeen === undefined)
        game.ownTheoryStorySeen = false;

    // 本源升级(一次性升级存 true,等级型存数字)
    if(!game.originUpgrades || typeof game.originUpgrades !== "object")
        game.originUpgrades = {};

}


// ============================================================
// 基础访问器
// ============================================================

// 本源存量(兼容字符串/数字形式的旧值)
function origin(){
    if(!(game.origin instanceof Decimal))
        game.origin = new Decimal(game.origin || 0);
    return game.origin;
}


// 累计获得的本源(不扣消耗;定理门槛与"真·无尽阶梯"用它)
function totalOrigin(){
    if(game.totalOrigin === undefined)
        game.totalOrigin = new Decimal(0);
    else if(!(game.totalOrigin instanceof Decimal))
        game.totalOrigin = new Decimal(game.totalOrigin || 0);
    return game.totalOrigin;
}


// 已完成的研究次数(不会被本源重置清空)
function originResets(){
    return game.originResets || 0;
}


// 本源页面是否已解锁:买过结论 / 完成过研究 / 已置位永久标记
// (标记保证了"此后永久显示":即使结论被重置也不会消失)
function originUnlocked(){
    return !!game.originUnlocked
    || originResets() > 0
    || paperOwned("conclusion");
}


// 第 n 个本源里程碑是否点亮
function originMilestoneActive(n){
    return originResets() >= n;
}


// 历史最高研究阶段(里程碑"记忆印记"保留研究里程碑时用)
function maxResearchStage(){
    return Math.max(
        game.researchStage || 0,
        game.maxResearchStage || 0
    );
}


// 完成研究的前置:当前持有论文升级「结论」
function canOriginReset(){
    return paperOwned("conclusion");
}


// 本源里程碑"追寻答案"(完成 10 次研究):
// 只要满足「结论」的三个条件(1e80 累计AP / 研究阶段10 / 其余各行完成),
// 就自动获得该升级,不消耗灵感。
// (判定复用论文自己的门槛检查,条件配置变了这里会自动跟上)
function autoConclusionReady(){

    if(!originMilestoneActive(10))
        return false;

    if(paperOwned("conclusion"))
        return false;

    let conf =
    paperConfig("conclusion");

    if(!conf)
        return false;

    return paperRequireMet(conf);

}


// 本次完成研究可获得的本源
//   floor( (totalAP / 1e80)^(1/40) × 2^(研究阶段-10) × 无尽阶梯II倍率 )
// 累计行动点不足 1e80 时返回 0(实际上结论本身就要求 1e80)
function originGain(){

    let ap =
    game.totalResearchPoints || new Decimal(0);

    let base =
    ap.div(ORIGIN_CONFIG.apScale);

    if(base.lt(1))
        return new Decimal(0);

    // 40 次方根,这里先不取整
    let steps =
    base.pow(ORIGIN_CONFIG.apExp);

    let stageMul =
    Decimal.pow(
        2,
        Math.max(
            (game.researchStage || 0) - ORIGIN_CONFIG.stageBase,
            0
        )
    );

    // 取整放在最外层:中间任何一步先取整,后面的倍率就会乘在
    // 被截断的小数上,白白损失收益(阶段倍率与无尽阶梯II 都受影响)
    return steps
    .mul(stageMul)
    .mul(originStaircaseBonus())
    // 本源升级"深入本源":×2^等级
    .mul(deepOriginMult())
    .floor();

}


// 本源里程碑"无尽阶梯II"(完成 30 次研究):本源获取 ×(1+完成次数/30)
// 完成次数 300 封顶 → ×11;未点亮时 ×1
function originStaircaseBonus(){

    if(!originMilestoneActive(30))
        return new Decimal(1);

    let n =
    Math.min(
        originResets(),
        ORIGIN_CONFIG.staircaseCap
    );

    return new Decimal(1)
    .add(
        new Decimal(n)
        .div(ORIGIN_CONFIG.staircaseDivisor)
    );

}


// ============================================================
// 你的理论:访问器与计算
// ============================================================

// 是否已解锁(第一次完成研究后)
function ownTheoryUnlocked(){
    return originResets() >= 1;
}


// 理论力量 p(兼容字符串/数字形式的旧值)
function ownTheoryPower(){

    if(!(game.ownTheory instanceof Decimal))
        game.ownTheory = new Decimal(game.ownTheory || 1);

    return game.ownTheory;

}


// 定理记录(保证结构存在)
function theoremRecord(){

    if(!game.theorems || typeof game.theorems !== "object")
        game.theorems = { knowledge: 0, ap: 0, origin: 0 };

    if(game.theorems.knowledge === undefined) game.theorems.knowledge = 0;
    if(game.theorems.ap === undefined) game.theorems.ap = 0;
    if(game.theorems.origin === undefined) game.theorems.origin = 0;

    return game.theorems;

}


// 定理总数(三种途径之和)
function theoremTotal(){

    let t = theoremRecord();

    return t.knowledge + t.ap + t.origin;

}


// 已消耗的定理(= 已购买升级的花费之和)
function theoremUsed(){

    let used = 0;

    for(let i = 0; i < OWN_THEORY_CONFIG.upgrades.length; i++){

        let conf = OWN_THEORY_CONFIG.upgrades[i];

        if(game.theoremUpgrades && game.theoremUpgrades[conf.key])
            used += conf.cost;

    }

    return used;

}


// 未使用的定理(每个使理论力量获取 ×2)
function theoremUnused(){
    return Math.max(0, theoremTotal() - theoremUsed());
}


// 理论力量获取速率 = 0.1 × 2^(未使用定理)
// 不受元-力量 / 研究里程碑 / 论文等任何外部加成影响
function ownTheoryRate(){

    return new Decimal(OWN_THEORY_CONFIG.baseRate)
    .mul(
        Decimal.pow(
            OWN_THEORY_CONFIG.theoremMult,
            theoremUnused()
        )
    );

}


// 是否已把公式改写为 p^2
function ownTheorySquared(){
    return !!(game.theoremUpgrades
        && game.theoremUpgrades.powerSquared);
}


// Effect:未改写公式时为 p,改写后为 p^2
// 直接乘在知识 / 元-力量 / 行动点的产出上
function ownTheoryEffect(){

    let p =
    ownTheoryPower();

    return ownTheorySquared()
    ? p.pow(2)
    : p;

}


// ------------------------------------------------------------
// 定理门槛:第 n 个定理需要的资源
// ------------------------------------------------------------

function theoremKnowledgeNeed(n){
    return Decimal.pow(
        10,
        OWN_THEORY_CONFIG.knowledgeBase * n
    );
}


function theoremAPNeed(n){
    return Decimal.pow(
        10,
        OWN_THEORY_CONFIG.apBase * n
    );
}


function theoremOriginNeed(n){
    return Decimal.pow(
        OWN_THEORY_CONFIG.originBase,
        n
    );
}


// 当前资源"够得着"的定理数(只是实时判断,是否入账由 updateTheorems 决定)
function theoremFromKnowledge(){

    let k =
    game.knowledge || new Decimal(0);

    if(k.lt(theoremKnowledgeNeed(1)))
        return 0;

    // log10(知识) / 1000,加极小量吃掉浮点误差
    return Math.max(0, Math.floor(
        k.log10().toNumber() / OWN_THEORY_CONFIG.knowledgeBase + 1e-9
    ));

}


function theoremFromAP(){

    let ap =
    game.totalResearchPoints || new Decimal(0);

    if(ap.lt(theoremAPNeed(1)))
        return 0;

    return Math.max(0, Math.floor(
        ap.log10().toNumber() / OWN_THEORY_CONFIG.apBase + 1e-9
    ));

}


function theoremFromOrigin(){

    let t =
    game.totalOrigin || new Decimal(0);

    if(t.lt(theoremOriginNeed(1)))
        return 0;

    return Math.max(0, Math.floor(
        t.log10().div(Math.log10(2)).toNumber() + 1e-9
    ));

}


// 定理入账:只增不减
// (知识会被本源重置清空,但已经拿到的定理保留)
function updateTheorems(){

    let t = theoremRecord();

    let k = theoremFromKnowledge();
    let a = theoremFromAP();
    let o = theoremFromOrigin();

    if(k > t.knowledge) t.knowledge = k;
    if(a > t.ap) t.ap = a;
    if(o > t.origin) t.origin = o;

}


// 每 tick 推进理论力量
function updateOwnTheory(dt){

    if(!ownTheoryUnlocked())
        return;

    game.ownTheory =
    ownTheoryPower().add(
        ownTheoryRate().mul(dt)
    );

    updateTheorems();

}


// ------------------------------------------------------------
// 消耗定理的升级
// ------------------------------------------------------------

function theoremUpgradeConf(key){

    for(let i = 0; i < OWN_THEORY_CONFIG.upgrades.length; i++){

        if(OWN_THEORY_CONFIG.upgrades[i].key === key)
            return OWN_THEORY_CONFIG.upgrades[i];

    }

    return null;

}


// 购买定理升级(消耗定理,不可退)
// 返回 "ok" | "owned"(已购买) | "noTheorem"(定理不够) | "none"
function buyTheoremUpgrade(key){

    let conf =
    theoremUpgradeConf(key);

    if(!conf)
        return "none";

    if(!game.theoremUpgrades)
        game.theoremUpgrades = {};

    if(game.theoremUpgrades[key])
        return "owned";

    if(theoremUnused() < conf.cost)
        return "noTheorem";

    game.theoremUpgrades[key] = true;

    saveGame();

    renderOriginPage();

    return "ok";

}


// 重置全部定理升级:已消耗的定理全部返还,理论力量重置为 1
// (用于重新分配定理;清空购买记录后可以再次购买)
function resetTheoremUpgrades(){

    let used =
    theoremUsed();

    if(used <= 0)
        return false;

    if(typeof confirm === "function"
        && !confirm("重置所有定理升级?已消耗的 " + used +
            " 个定理会全部返还,理论力量将重置为 1。"))
        return false;

    game.theoremUpgrades = {};

    game.ownTheory = new Decimal(1);

    saveGame();

    renderOriginPage();

    return true;

}


// ============================================================
// 本源升级:访问器 / 价格 / 购买
// ============================================================

function originUpgradeConf(key){

    for(let i = 0; i < ORIGIN_UPGRADE_LIST.length; i++){

        if(ORIGIN_UPGRADE_LIST[i].key === key)
            return ORIGIN_UPGRADE_LIST[i];

    }

    return null;

}


// 升级等级:一次性升级为 1/0,可叠加升级为实际等级
function originUpgradeLevel(key){

    if(!game.originUpgrades)
        return 0;

    let v =
    game.originUpgrades[key];

    if(v === undefined || v === null)
        return 0;

    if(v === true) return 1;
    if(v === false) return 0;

    return Number(v) || 0;

}


function originUpgradeActive(key){
    return originUpgradeLevel(key) > 0;
}


// 已购买(或已升级)的本源升级数量(成就「改写规则」用)
function originUpgradePurchasedCount(){

    let n = 0;

    for(let i = 0; i < ORIGIN_UPGRADE_LIST.length; i++){

        if(originUpgradeLevel(ORIGIN_UPGRADE_LIST[i].key) > 0)
            n++;

    }

    return n;

}


// 下一级价格 = 基础价 × 成长^当前等级
function originUpgradeCost(key){

    let conf =
    originUpgradeConf(key);

    if(!conf)
        return new Decimal(0);

    let lv =
    (conf.type === "level") ? originUpgradeLevel(key) : 0;

    return conf.cost.mul(
        Decimal.pow(conf.costGrowth || 1, lv)
    );

}


// 购买升级(消耗本源)
// 返回 "ok" | "owned"(仅一次性) | "noOrigin"(本源不足) | "none"
function buyOriginUpgrade(key){

    let conf =
    originUpgradeConf(key);

    if(!conf)
        return "none";

    if(conf.type === "once" && originUpgradeActive(key))
        return "owned";

    let cost =
    originUpgradeCost(key);

    if(origin().lt(cost))
        return "noOrigin";

    if(!game.originUpgrades)
        game.originUpgrades = {};

    game.origin = origin().sub(cost);

    if(conf.type === "level")
        game.originUpgrades[key] = originUpgradeLevel(key) + 1;
    else
        game.originUpgrades[key] = true;

    saveGame();

    renderOriginPage();

    return "ok";

}


// 深入本源:本源获取倍率 = 2^等级
function deepOriginMult(){

    return Decimal.pow(
        2,
        originUpgradeLevel("deepOrigin")
    );

}


// ============================================================
// 完成研究(本源重置)
// ============================================================
// 返回是否真的执行了重置
// 注意顺序:本源与完成次数先结算,本次重置就按新点亮的里程碑生效
// (例如第 1 次重置后,实验直接以"已完成 1 次"的状态开始)
function originReset(auto){

    if(!canOriginReset())
        return false;

    // 手动点击时确认一次;自动触发(论文发表员)不打断玩家
    if(!auto
        && typeof confirm === "function"
        && !confirm("完成研究将重置研究进度,确定继续吗?"))
        return false;

    // ---- 1. 先结算本源与次数 ----
    let gain =
    originGain();

    // 本源按清零前的数据结算,结算完从这一刻开始给下一轮计时
    game.lastOriginResetTime =
    game.totalTime || 0;

    game.origin =
    origin().add(gain);

    game.originResets =
    originResets() + 1;

    // 累计本源:只记"获得过多少",不扣消耗(给"你的理论"的定理门槛用)
    game.totalOrigin =
    (game.totalOrigin || new Decimal(0)).add(gain);

    // 清空 researchStage 之前记录历史最高阶段(记忆印记要用)
    if((game.researchStage || 0) > (game.maxResearchStage || 0))
        game.maxResearchStage = game.researchStage;

    // ---- 2. 本次生效的里程碑 ----
    let keepHelpers = originMilestoneActive(2);   // 长久陪伴
    let keepPapers  = originMilestoneActive(5);   // 保存手稿
    let expStart    = originMilestoneActive(1) ? 1 : 0;  // 通用实验

    // ---- 3. 行动点 / 累计行动点 / 研究阶段 ----
    game.actionPoints = new Decimal(0);

    // 累计行动点同步清零:本源公式基于它,每轮研究独立累计。
    // (「你的理论」的 AP 定理门槛靠 updateTheorems() 的"只增不减"记录保住,
    //  清零不会让已经拿到的定理丢失)
    game.totalResearchPoints = new Decimal(0);

    // 研究总结员(倍数模式)的"上次重置所得 AP"重置回最低值 5。
    // 否则它会一直拿着上一轮的大值当基准,倍数模式迟迟不触发 ——
    // 而"自动完成研究"需要研究总结员与论文发表员同时开着,
    // 所以这里必须让它从头开始比较。
    game.lastResearchAPGain = new Decimal(5);

    game.researchStage = 0;

    // ---- 4. 助手:解锁与等级 ----
    for(let i = 0; i < ASSISTANT_LIST.length; i++){

        let key = ASSISTANT_LIST[i].key;

        if(!game.assistants[key]){
            game.assistants[key] = {
                unlocked: false,
                enabled: true
            };
        }

        let a = game.assistants[key];

        // 等级一律清空(长久陪伴只保留解锁状态)
        a.level = 0;

        if(!keepHelpers){
            a.unlocked = false;
            a.enabled = true;
        }

    }

    // ---- 5. 灵感与论文升级 ----
    if(!keepPapers){

        game.inspiration = new Decimal(0);

        for(let i = 0; i < FRONTIER_CONFIG.papers.length; i++)
            game[FRONTIER_CONFIG.papers[i].key + "Unlocked"] = false;

    }else{

        // 保存手稿:保留灵感与其余论文,只清"结论"
        // (每轮研究都要重新写结论才能再次完成研究)
        game.conclusionUnlocked = false;

    }

    // ---- 6. 实验:只重置重复完成次数 ----
    // 首次完成效果(bestEver)与最优操作数(bestOperations)保留;
    // 当前轮的测量记录/操作数要清掉,否则下次完成时
    // operationCount 会从上轮累计值起算,最优操作数永远无法刷新。
    for(let key in game.experiments){

        let e = game.experiments[key];

        if(!e)
            continue;

        e.completions = expStart;

        // 只清"本轮"的操作记录:
        // operationCount 不清的话,下次完成时它会从上轮累计值起算,
        // 最优操作数(bestOperations)就永远刷不新。
        // completed / restarted / bestEver / bestOperations 都是永久资产,保留
        e.operationCount = 0;
        e.measurements = [];
        e.bestResult = null;

    }

    // ---- 7. 理论与想法页面的内容(含知识) ----
    // 知识同样重置;成就"新篇之始"保留 10 知识的规则照旧生效
    // (与研究重置保持同一口径)
    game.knowledge =
    isAchievementUnlocked("stage1")
    ? new Decimal(10)
    : new Decimal(0);

    for(let id in game.theories){

        let t = game.theories[id];

        t.unlocked = false;
        t.level = 0;
        t.power = new Decimal(1);

    }

    game.ideas = 0;
    game.metaPower = new Decimal(0);

    // 理论力量重置为 1(刚解锁与每次完成研究时都从头开始积攒)
    game.ownTheory = new Decimal(1);

    // ---- 8. 退出前沿领域 ----
    // 研究进度整体归零,继续留在领域里没有意义;
    // 领域本身由成就"求知"永久解锁,随时可以再进
    game.frontierActive = false;

    saveGame();

    // ---- 9. 刷新界面 ----
    renderTheories();
    renderIdeaPage();
    renderResearchPage();
    renderFrontierPage();
    renderOriginPage();

    // ---- 10. 结算成就 ----
    // 完成研究本身可能立即达成成就(如「新起点」),不必等下一帧
    if(typeof checkAchievements === "function")
        checkAchievements();

    return true;

}


// ============================================================
// 界面
// ============================================================

// 结构签名(完成次数变化时才重建里程碑列表)
let lastOriginKey = "";


// 顶部导航按钮:解锁后永久显示
function updateOriginNavButton(){

    let btn =
    document.getElementById("originNavBtn");

    if(!btn)
        return;

    let show =
    originUnlocked();

    btn.style.display =
    show ? "" : "none";

    // 首次解锁 → 置位永久标记(此后即使结论被重置也不再隐藏)
    if(show && !game.originUnlocked){
        game.originUnlocked = true;
        // 本轮研究的起算点:首次解锁时开始计时
        // (之后每次完成研究都会在 originReset 里重设)
        if(game.lastOriginResetTime === null
            || game.lastOriginResetTime === undefined)
            game.lastOriginResetTime = game.totalTime || 0;
        saveGame();
    }

}


// 绘制本源页面(数值每帧刷新,里程碑结构变化才重建)
function renderOriginPage(){

    let page =
    document.getElementById("originPage");

    if(!page)
        return;

    // ---- 数值 ----
    let valEl =
    document.getElementById("originVal");

    if(valEl)
        valEl.innerText = format(origin());

    let resEl =
    document.getElementById("originResetsVal");

    if(resEl)
        resEl.innerText = originResets();

    let gainEl =
    document.getElementById("originGainVal");

    if(gainEl)
        gainEl.innerText = format(originGain());

    // ---- 上一次完成研究的统计(用时 / 本源速率) ----
    refreshOriginStats();

    // ---- 完成研究按钮 ----
    let btn =
    document.getElementById("originResetBtn");

    if(btn){

        let ready =
        canOriginReset();

        btn.disabled = !ready;

        btn.innerText =
        ready
        ? "完成研究"
        : "需要论文升级「结论」";

    }

    // ---- 你的理论 / 本源升级 ----
    // 两个子页标签都在第一次完成研究后才出现
    let theoryTab =
    document.getElementById("originTheoryTab");

    if(theoryTab)
        theoryTab.style.display =
        ownTheoryUnlocked() ? "" : "none";

    let upgradeTab =
    document.getElementById("originUpgradeTab");

    if(upgradeTab)
        upgradeTab.style.display =
        ownTheoryUnlocked() ? "" : "none";

    // 数值逐帧刷新(只改 textContent,不进任何重建签名)
    refreshOwnTheoryNumbers();

    // 定理升级卡片(仅购买状态变化时重建)
    renderTheoremUpgrades();

    // 本源升级卡片(仅等级/购买状态变化时重建)
    renderOriginUpgrades();

    // ---- 里程碑(完成次数变化 → 重建) ----
    let box =
    document.getElementById("originMilestones");

    if(!box)
        return;

    let key =
    originResets() + ":" + (originUnlocked() ? 1 : 0);

    if(key === lastOriginKey)
        return;

    lastOriginKey = key;

    box.innerHTML = "";

    for(let i = 0; i < ORIGIN_CONFIG.milestones.length; i++){

        let m =
        ORIGIN_CONFIG.milestones[i];

        let active =
        originMilestoneActive(m.n);

        let div =
        document.createElement("div");

        div.className =
        "milestone" + (active ? " active" : "");

        if(active){

            div.innerHTML =
            "<span class=\"milestone-name\">" + m.name + "</span>" +
            "<span class=\"milestone-val\">" + m.desc + "</span>";

        }else{

            div.innerHTML =
            "<span class=\"milestone-name\">" + m.name + "</span>" +
            "<span class=\"milestone-lock\">🔒 完成 " +
            m.n +
            " 次研究以点亮</span>";

        }

        box.appendChild(div);

    }

}


// ============================================================
// "你的理论"子页渲染
// ============================================================

// 轻量写文本
function originSetText(id, val){

    let el =
    document.getElementById(id);

    if(el)
        el.innerText = val;

}


// 本轮研究的统计(实时,每帧刷新)
//   用时   = 当前游戏时间 - 本轮起算时间
//   速率   = 当前可获得的本源 ÷ 已用时间(分钟)
// 注意:这是"这一轮正在进行中的进度",不是上一次完成研究的结果快照。
function refreshOriginStats(){

    let start =
    game.lastOriginResetTime;

    let elapsed =
    (start === null || start === undefined)
    ? null
    : Math.max(0, (game.totalTime || 0) - start);

    let timeText =
    "—";

    if(elapsed !== null){

        timeText =
        (typeof formatGameTime === "function")
        ? formatGameTime(elapsed)
        : Math.floor(elapsed) + " 秒";

    }

    originSetText("originLastElapsed", timeText);

    let rateText =
    "—";

    if(elapsed !== null && elapsed > 0)
        rateText =
        format(originGain().mul(60).div(elapsed));

    originSetText("originLastRate", rateText);

}


// 刷新"你的理论"的全部实时数值
// p 每帧都在增长,这些值只能走轻量刷新,
// 绝对不能放进任何"签名不变就 return"的重建逻辑里。
function refreshOwnTheoryNumbers(){

    let p =
    ownTheoryPower();

    originSetText("ownTheoryPower", format(p));
    originSetText("ownTheoryRate", format(ownTheoryRate()));
    originSetText("ownTheoryFormula", ownTheorySquared() ? "p^2" : "p");
    originSetText("ownTheoryEffect", format(ownTheoryEffect()));

    originSetText("ownTheoremTotal", theoremTotal());
    originSetText("ownTheoremUnused", theoremUnused());
    originSetText("ownTheoremMult",
        format(Decimal.pow(2, theoremUnused())));

    let t =
    theoremRecord();

    // 下一档门槛 / 当前值
    originSetText("theoremNeedK",
        format(theoremKnowledgeNeed(t.knowledge + 1)));
    originSetText("theoremCurK",
        format(game.knowledge || new Decimal(0)));

    originSetText("theoremNeedAP",
        format(theoremAPNeed(t.ap + 1)));
    originSetText("theoremCurAP",
        format(game.totalResearchPoints || new Decimal(0)));

    originSetText("theoremNeedOrigin",
        format(theoremOriginNeed(t.origin + 1)));
    originSetText("theoremCurOrigin",
        format(game.totalOrigin || new Decimal(0)));

}


// 定理升级卡片
// 结构签名只看"是否已购买";定理数量每帧都可能变,
// 所以"按钮能不能点"靠改 disabled,不重建(否则点击会被替换掉)
let lastTheoremUpgradeKey = "";

function renderTheoremUpgrades(){

    let box =
    document.getElementById("theoremUpgrades");

    if(!box)
        return;

    let key =
    OWN_THEORY_CONFIG.upgrades.map(function(c){
        return (game.theoremUpgrades && game.theoremUpgrades[c.key])
            ? 1 : 0;
    }).join(":");

    if(key !== lastTheoremUpgradeKey){

        lastTheoremUpgradeKey = key;

        box.innerHTML = "";

        for(let i = 0; i < OWN_THEORY_CONFIG.upgrades.length; i++){

            let conf =
            OWN_THEORY_CONFIG.upgrades[i];

            let owned =
            !!(game.theoremUpgrades
                && game.theoremUpgrades[conf.key]);

            let div =
            document.createElement("div");

            div.className =
            "theorem-card" + (owned ? " active" : "");

            div.innerHTML =
            "<div class=\"theorem-head\">" +
            "<span class=\"theorem-name\">" + conf.name + "</span>" +
            "<span class=\"theorem-cost\">" + conf.cost + " 定理</span>" +
            "</div>" +
            "<div class=\"theorem-desc\">" + conf.desc + "</div>" +
            (owned
                ? "<div class=\"theorem-owned\">已完成</div>"
                : "<button class=\"theorem-btn\" data-key=\"" + conf.key + "\">" +
                  "购买(" + conf.cost + " 定理)</button>");

            box.appendChild(div);

            // 绑定购买按钮
            let btn =
            div.querySelector
            ? div.querySelector(".theorem-btn")
            : null;

            if(btn){
                btn.addEventListener("click", function(){
                    buyTheoremUpgrade(
                        this.getAttribute("data-key")
                    );
                });
            }

        }

    }

    // "重置定理升级"按钮:只有消耗过定理时才需要显示
    let resetBtn =
    document.getElementById("resetTheoremBtn");

    if(resetBtn){

        let used =
        theoremUsed();

        resetBtn.style.display =
        used > 0 ? "" : "none";

        resetBtn.innerText =
        "重置定理升级（返还 " + used + " 个定理）";

    }

    // 按钮可用性轻量刷新
    if(!box.children)
        return;

    for(let i = 0; i < box.children.length; i++){

        let card = box.children[i];

        let btn =
        card.querySelector
        ? card.querySelector(".theorem-btn")
        : null;

        if(!btn)
            continue;

        let conf =
        theoremUpgradeConf(btn.getAttribute("data-key"));

        if(conf)
            btn.disabled =
            theoremUnused() < conf.cost;

    }

}


// ============================================================
// 本源升级卡片
// 结构签名只看"等级/购买状态";本源数量每帧都在变,
// 所以按钮能不能点靠改 disabled,不重建
// ============================================================
let lastOriginUpgradeKey = "";

function renderOriginUpgrades(){

    let box =
    document.getElementById("originUpgrades");

    if(!box)
        return;

    let key =
    ORIGIN_UPGRADE_LIST.map(function(c){
        return originUpgradeLevel(c.key);
    }).join(":");

    if(key !== lastOriginUpgradeKey){

        lastOriginUpgradeKey = key;

        box.innerHTML = "";

        for(let i = 0; i < ORIGIN_UPGRADE_LIST.length; i++){

            let conf =
            ORIGIN_UPGRADE_LIST[i];

            let lv =
            originUpgradeLevel(conf.key);

            let isLevel =
            conf.type === "level";

            let done =
            !isLevel && lv > 0;

            let cost =
            originUpgradeCost(conf.key);

            let div =
            document.createElement("div");

            div.className =
            "theorem-card" + (lv > 0 ? " active" : "");

            let costText =
            isLevel
            ? "下一级 " + format(cost) + " 本源"
            : format(cost) + " 本源";

            let extra = "";

            if(isLevel && lv > 0){

                extra =
                "<div class=\"theorem-owned\">等级 " + lv +
                " ｜ 合计:×" + format(deepOriginMult()) +
                "</div>";

            }else if(done){

                extra =
                "<div class=\"theorem-owned\">已购买</div>";

            }

            div.innerHTML =
            "<div class=\"theorem-head\">" +
            "<span class=\"theorem-name\">" + conf.name + "</span>" +
            "<span class=\"theorem-cost\">" + costText + "</span>" +
            "</div>" +
            "<div class=\"theorem-desc\">" + conf.desc + "</div>" +
            extra +
            (done
                ? ""
                : "<button class=\"theorem-btn\" data-key=\"" + conf.key + "\">" +
                  (isLevel ? "升级(" : "购买(") +
                  format(cost) + " 本源)</button>");

            box.appendChild(div);

            let btn =
            div.querySelector
            ? div.querySelector(".theorem-btn")
            : null;

            if(btn){
                btn.addEventListener("click", function(){
                    buyOriginUpgrade(
                        this.getAttribute("data-key")
                    );
                });
            }

        }

    }

    // 按钮可用性轻量刷新(本源每帧变化)
    if(!box.children)
        return;

    for(let i = 0; i < box.children.length; i++){

        let card = box.children[i];

        let btn =
        card.querySelector
        ? card.querySelector(".theorem-btn")
        : null;

        if(!btn)
            continue;

        let conf =
        originUpgradeConf(btn.getAttribute("data-key"));

        if(conf)
            btn.disabled =
            origin().lt(originUpgradeCost(conf.key));

    }

}


// ============================================================
// 本源页子页面切换(里程碑 / 你的理论)
// ============================================================
(function(){

    let subNav =
    document.querySelector(".origin-subnav");

    if(!subNav || !subNav.addEventListener)
        return;

    let subMap = {
        milestone: "originMilestonePage",
        theory: "originTheoryPage",
        upgrade: "originUpgradePage"
    };

    subNav.addEventListener("click", function(e){

        let btn =
        e.target.closest(".origin-tab");

        if(!btn)
            return;

        let sub =
        btn.dataset.sub;

        for(let key in subMap){

            let el =
            document.getElementById(subMap[key]);

            if(!el)
                continue;

            el.style.display =
            (key === sub) ? "block" : "none";

        }

        let tabs =
        subNav.querySelectorAll(".origin-tab");

        for(let i = 0; i < tabs.length; i++){

            let t = tabs[i];

            if(t.dataset.sub === sub)
                t.classList.add("active");
            else
                t.classList.remove("active");

        }

    });

})();
