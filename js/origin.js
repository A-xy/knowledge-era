// ============================================================
// 本源(Origin) —— 第三声望层级
// 论文升级「结论」完成后解锁,此后本源页面永久显示。
// 在这里可以"完成研究"(本源重置):
//   条件:当前持有论文升级「结论」
//   获得:本源 = floor(((本轮累计行动点 + 本次重置可得AP) / 1e80)^(1/40) × 2^(研究阶段-10) × 阶梯倍率)
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
    // 本源数量公式:floor((行动点总量 / apScale)^apExp × 2^(研究阶段 - stageBase) × 阶梯倍率)
    // 行动点总量 = 本轮累计行动点 + 本次研究重置可获得的行动点
    apScale: new Decimal("1e80"),
    apExp: 1 / 40,          // 40 次方根
    stageBase: 10,          // 研究阶段每高出 10 一级,本源翻倍

    // 本源里程碑"无尽阶梯II"(完成 30 次研究):本源 ×(1+完成次数/除数)
    // 完成 staircaseCap 次时封顶(300 → ×11)
    staircaseDivisor: 30,
    staircaseCap: 300,

    // 论文发表员的默认阈值(本源;玩家可在助手页改)
    publisherDefaultThreshold: "1",
    // 论文发表员·时间模式默认秒数(本次本源的游戏时间达到该值 → 自动完成研究)
    publisherDefaultTime: "60",

    // 成就"DDL战士":在这么多秒内完成一次研究(游戏时间,本轮用时)
    fastOriginWindow: 10,

    // 成就"成果斐然":完成研究达到该次数
    manyOriginTimes: 300,

    // 本源升级"知识扩充":每级知识边界 ×该倍率
    knowledgeExpandBase: new Decimal("1e50"),

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
            desc: "本源获取 ×(1+完成研究次数/30),完成 300 次研究时达到上限",
            // 点亮后追加"当前实际倍率"(随完成次数变化)
            detail: function(){
                return " ｜ 当前 ×" + format(originStaircaseBonus());
            }
        }
    ]
};


// ============================================================
// 你的理论(本源层第二子页)
// 理论力量 p 以 baseRate 每秒增长,速率再乘 定理倍率^(未使用定理数)。
// p 不受任何其它系统加成(元-力量 / 研究里程碑 / 论文都不影响它)。
//
// 初始只有知识获取 ×Effect;「推广理论I / II」分别把 Effect 加到
// 元-力量与行动点上(未购买时该项 ×1)。
// Effect 由公式决定(默认 Effect = p;「公式增强」系列依次升级为
//   p*ln(p) → p*sqrt(p) → p^2),购买「时光之力」后再 ×T(t)。
//
// 定理:三种途径各自按门槛自动获得,三者之和即定理总数(只增不减 ——
// 知识被本源重置清空后,已经拿到的定理不会丢)。
//   知识     :第 n 个需要 10^(600n)
//   累计AP   :第 n 个需要 10^(40n)
//   累计本源 :第 n 个需要 2^n
// 每个"未使用"的定理使理论力量获取 ×2(可升级到 ×2.5);
// 购买升级会消耗定理,并把理论力量 p 重置为 1。
// ============================================================
const OWN_THEORY_CONFIG = {
    baseRate: 0.1,       // 理论力量基础获取速率(每秒)
    theoremMult: 2,      // 每个未使用定理使获取速率 ×2
    theoremMultBoost: 2.5, // 升级"倍率增强"后改为 ×2.5
    knowledgeBase: 600,  // 第 n 个定理需要 10^(knowledgeBase*n) 知识
    apBase: 40,          // 第 n 个定理需要 10^(apBase*n) 累计行动点
    originBase: 2,       // 第 n 个定理需要 originBase^n 累计本源

    // 时光之力(T(t),t = 距上次完成研究的秒数)
    timeFastCap: 1000,        // 迅速:T(t) = min(1000, 90000/t)
    timeFastConstant: 90000,

    // 消耗定理的升级(数组顺序即显示顺序)
    //   require        : 前置升级(数组,全部购买后才可买)
    //   exclusive      : 互斥组;同组只能买一个
    //   requireUpgrades: 需要已购买的升级数(不含同组)
    upgrades: [
        {
            key: "propagateI",
            name: "推广理论I",
            desc: "你的理论也加成元-力量获取",
            cost: 2
        },
        {
            key: "propagateII",
            name: "推广理论II",
            desc: "你的理论也加成行动点获取",
            cost: 2,
            require: ["propagateI"]
        },
        {
            key: "formulaI",
            name: "公式增强I",
            desc: "将公式升级为 Effect = p*ln(p)",
            cost: 1
        },
        {
            key: "formulaII",
            name: "公式增强II",
            desc: "将公式升级为 Effect = p*sqrt(p)",
            cost: 3,
            require: ["formulaI"]
        },
        {
            key: "formulaIII",
            name: "公式增强III",
            desc: "将公式升级为 Effect = p^2",
            cost: 4,
            require: ["formulaII"]
        },
        {
            key: "theoremBoost",
            name: "倍率增强",
            desc: "每个未使用的定理对理论力量的加成提升到 2.5 倍",
            cost: 3
        },
        {
            key: "timeFast",
            name: "时光之力·迅速",
            desc: "Effect × T(t)，其中 T(t) = min(1000, 90000/t)，" +
                  "t 为距上次完成研究的秒数。与「时光之力·持久」互斥",
            cost: 4,
            exclusive: "timePower",
            requireUpgrades: 6
        },
        {
            key: "timePersist",
            name: "时光之力·持久",
            desc: "Effect × T(t)，其中 T(t) = t，" +
                  "t 为距上次完成研究的秒数。与「时光之力·迅速」互斥",
            cost: 4,
            exclusive: "timePower",
            requireUpgrades: 6
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
              "研究重置次数 ×floor(√(累计本源+1))",
        activeText: function(){
            return "当前:研究重置次数 ×" +
            format(trueStaircaseMult());
        }
    },
    {
        key: "deepOrigin",
        name: "深入本源",
        type: "level",
        cost: new Decimal(10),
        costGrowth: 10,     // 每级价格 ×10
        desc: "本源获取 ×2;论文发表员的阈值同步 ×2",
        activeText: function(lv){
            return "合计:×" + format(deepOriginMult());
        }
    },
    {
        // 里程碑「跨学科研究」的底数:行动点获取 = 底数^(阶段-1)
        key: "stageBaseBoost",
        name: "底数提升1",
        type: "level",
        cost: new Decimal("1e5"),
        costGrowth: 5,      // 每级价格 ×5
        desc: "里程碑「跨学科研究」的底数 +0.2(初始 2)",
        // 未购买时也显示当前底数(玩家问"现在是多少")
        currentText: function(){
            return "当前底数 " + baseNumberText(stageAPBase());
        },
        activeText: function(lv){
            return "当前底数 " + baseNumberText(stageAPBase());
        }
    },
    {
        // 自动实验助手的升级底数:效率 = 基础 × 底数^等级
        key: "expBaseBoost",
        name: "底数提升2",
        type: "level",
        cost: new Decimal("1e6"),
        costGrowth: 5,
        desc: "每次升级自动实验助手时,速度加成倍数 +0.2(初始 2)",
        // 未购买时也显示当前底数
        currentText: function(){
            return "当前底数 " + baseNumberText(expAssistantBase());
        },
        activeText: function(lv){
            return "当前底数 " + baseNumberText(expAssistantBase());
        }
    },
    {
        key: "knowledgeExpand",
        name: "知识扩充",
        type: "level",
        cost: new Decimal("1e7"),
        costGrowth: 10,
        desc: "知识边界 ×1e50",
        activeText: function(lv){
            return "合计:×" + format(knowledgeExpandMult());
        }
    },
    {
        // 终点标记:买下它代表这个版本已经玩到头了,
        // 实际能力留到下个版本实装(所以这里只置位、不给任何加成)
        key: "selfImprove",
        name: "自我提升",
        type: "once",
        cost: new Decimal("1e28"),
        desc: "解锁能力(暂未实装)。" +
              "买到它就意味着本版本的内容已经走完,后续版本将由此继续",
        activeText: function(){
            return "已解锁能力槽位(暂未实装)";
        }
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

    // 上一次完成研究的快照(旧存档没有 → 显示"—")
    if(game.lastOriginRunTime === undefined)
        game.lastOriginRunTime = null;

    if(game.lastOriginRunGain === undefined
        || game.lastOriginRunGain === null)
        game.lastOriginRunGain = null;
    else if(!(game.lastOriginRunGain instanceof Decimal))
        game.lastOriginRunGain = new Decimal(game.lastOriginRunGain);

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
    // time: 时间模式的秒数(成就"DDL战士"解锁该模式后才会用到)
    if(game.assistants.paperPublisher === undefined){
        game.assistants.paperPublisher = {
            unlocked: false,
            enabled: true,
            threshold: ORIGIN_CONFIG.publisherDefaultThreshold,
            time: ORIGIN_CONFIG.publisherDefaultTime
        };
    }else{

        if(game.assistants.paperPublisher.threshold === undefined)
            game.assistants.paperPublisher.threshold =
            ORIGIN_CONFIG.publisherDefaultThreshold;

        if(game.assistants.paperPublisher.time === undefined)
            game.assistants.paperPublisher.time =
            ORIGIN_CONFIG.publisherDefaultTime;

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

    // 定理升级改版兼容(2026-10-31):
    // 旧版只有一个升级「改写公式」(powerSquared),新版已把它删除。
    // 读到旧存档时自动执行一次"重置定理升级":清空购买记录(定理按配置
    // 自动返还),理论力量重置为 1,让玩家按新表重新分配。
    if(game.theoremUpgradeVersion === undefined)
        game.theoremUpgradeVersion = 1;

    if(game.theoremUpgradeVersion < 2){

        if(game.theoremUpgrades.powerSquared){

            game.theoremUpgrades = {};
            game.ownTheory = new Decimal(1);

        }

        game.theoremUpgradeVersion = 2;

    }

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


// ============================================================
// 本次完成研究可获得的本源
//   floor( ((本轮累计行动点 + 本次研究重置可获得的行动点) / 1e80)^(1/40)
//          × 2^(研究阶段-10) × 无尽阶梯II倍率 × 深入本源倍率 )
// 加上"本次研究重置可获得的行动点":当前已经攒下的知识可以直接计进本源,
// 不必先做一次研究重置把知识兑成行动点。
// 行动点总量不足 1e80 时返回 0(实际上结论本身就要求 1e80)
// ============================================================
function originGain(){

    // 基础值就是 40 次方根那一步;行动点总量不足 1e80 时它 < 1 → 本源为 0
    let base =
    originGainBase();

    if(base.lt(1))
        return new Decimal(0);

    // 取整放在最外层:中间任何一步先取整,后面的倍率就会乘在
    // 被截断的小数上,白白损失收益(阶段倍率与无尽阶梯II 都受影响)
    return base
    .mul(originGainStageMult())
    .mul(originStaircaseBonus())
    // 本源升级"深入本源":×2^等级
    .mul(deepOriginMult())
    .floor();

}


// 本源公式用的行动点总量 = 本轮累计行动点 + 本次研究重置可获得的行动点
function originGainTotalAP(){

    return (game.totalResearchPoints || new Decimal(0))
    .add(originGainPendingAP());

}


// 本源获取的"基础值":只由行动点总量决定(40 次方根前的那一步)
// 统计页把它单独列出来,方便看清倍率都是乘在什么上面
function originGainBase(){

    let base =
    originGainTotalAP()
    .div(ORIGIN_CONFIG.apScale);

    if(base.lt(1))
        return new Decimal(0);

    return base.pow(ORIGIN_CONFIG.apExp);

}


// 研究阶段加成:×2^(研究阶段 - 10);阶段不足 10 时 ×1
function originGainStageMult(){

    return Decimal.pow(
        2,
        Math.max(
            (game.researchStage || 0) - ORIGIN_CONFIG.stageBase,
            0
        )
    );

}


// 本源公式里的"本次研究重置可获得的行动点"
// (即现在立刻做一次研究重置能拿到的 AP;研究层未解锁时按 0 计)
function originGainPendingAP(){

    if(typeof actionPointsGain !== "function")
        return new Decimal(0);

    return actionPointsGain();

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


// 是否购买了某个定理升级
function theoremUpgradeOwned(key){

    return !!(game.theoremUpgrades
        && game.theoremUpgrades[key]);

}


// 每个未使用定理的倍率(「倍率增强」后为 2.5)
function ownTheoryTheoremMult(){

    return theoremUpgradeOwned("theoremBoost")
    ? OWN_THEORY_CONFIG.theoremMultBoost
    : OWN_THEORY_CONFIG.theoremMult;

}


// 理论力量获取速率 = 0.1 × 定理倍率^(未使用定理)
// 不受元-力量 / 研究里程碑 / 论文等任何外部加成影响
function ownTheoryRate(){

    return new Decimal(OWN_THEORY_CONFIG.baseRate)
    .mul(
        Decimal.pow(
            ownTheoryTheoremMult(),
            theoremUnused()
        )
    );

}


// ------------------------------------------------------------
// 公式:Effect 的形状
//   0: p(初始)
//   1: p*ln(p)      「公式增强I」
//   2: p*sqrt(p)    「公式增强II」
//   3: p^2          「公式增强III」
// 三级是递进替换关系,取已购买的最高一级
// ------------------------------------------------------------
function ownTheoryFormulaTier(){

    if(theoremUpgradeOwned("formulaIII"))
        return 3;

    if(theoremUpgradeOwned("formulaII"))
        return 2;

    if(theoremUpgradeOwned("formulaI"))
        return 1;

    return 0;

}


// 公式里不含量纲的那一段(给界面显示用)
function ownTheoryFormulaBaseText(){

    let tier =
    ownTheoryFormulaTier();

    if(tier === 3) return "p^2";
    if(tier === 2) return "p*sqrt(p)";
    if(tier === 1) return "p*ln(p)";

    return "p";

}


// 完整公式文本(买了时光之力后末尾多一项 T(t))
function ownTheoryFormulaText(){

    let text =
    ownTheoryFormulaBaseText();

    if(ownTheoryTimePower())
        text += " * T(t)";

    return text;

}


// 已选择的时光之力:null | "timeFast" | "timePersist"
function ownTheoryTimePower(){

    if(theoremUpgradeOwned("timeFast"))
        return "timeFast";

    if(theoremUpgradeOwned("timePersist"))
        return "timePersist";

    return null;

}


// t = 距上次完成研究的秒数(本源未解锁 / 尚未完成研究时为 0)
function ownTheoryElapsed(){

    let start =
    game.lastOriginResetTime;

    if(start === null || start === undefined)
        return 0;

    return Math.max(0, (game.totalTime || 0) - start);

}


// T(t):未购买时光之力时为 1
//   迅速:T(t) = min(1000, 90000/t)   —— 完成研究后立刻给出高倍率,随后衰减
//   持久:T(t) = t                     —— 需要重新累积时间
function ownTheoryTimeMult(){

    let key =
    ownTheoryTimePower();

    if(!key)
        return new Decimal(1);

    let t =
    ownTheoryElapsed();

    if(key === "timeFast"){

        if(t <= 0)
            return new Decimal(OWN_THEORY_CONFIG.timeFastCap);

        let v =
        new Decimal(OWN_THEORY_CONFIG.timeFastConstant).div(t);

        return v.gt(OWN_THEORY_CONFIG.timeFastCap)
        ? new Decimal(OWN_THEORY_CONFIG.timeFastCap)
        : v;

    }

    return new Decimal(t);

}


// 公式的值(不含 T(t))
function ownTheoryFormulaValue(){

    let p =
    ownTheoryPower();

    let tier =
    ownTheoryFormulaTier();

    if(tier === 1){
        // p = 1 时 ln(p) = 0,会让产出瞬间归零
        // (购买升级与完成研究都会把 p 重置为 1,下一帧就开始增长)
        if(p.lte(1))
            return p;
        return p.mul(p.ln());
    }

    if(tier === 2)
        return p.mul(p.sqrt());

    if(tier === 3)
        return p.pow(2);

    return p;

}


// Effect = 公式值 × T(t)
// 知识始终吃这个倍率;元-力量 / 行动点要买「推广理论I / II」才吃
function ownTheoryEffect(){

    return ownTheoryFormulaValue()
    .mul(ownTheoryTimeMult());

}


// 元-力量获取倍率(未买「推广理论I」时 ×1)
function ownTheoryMetaEffect(){

    return theoremUpgradeOwned("propagateI")
    ? ownTheoryEffect()
    : new Decimal(1);

}


// 行动点获取倍率(未买「推广理论II」时 ×1)
function ownTheoryAPEffect(){

    return theoremUpgradeOwned("propagateII")
    ? ownTheoryEffect()
    : new Decimal(1);

}


// 效果作用范围文本(知识 → 知识/元-力量 → 知识/元-力量/行动点)
function ownTheoryTargetText(){

    let parts = ["知识产出"];

    if(theoremUpgradeOwned("propagateI"))
        parts.push("元-力量产出");

    if(theoremUpgradeOwned("propagateII"))
        parts.push("行动点产出");

    if(parts.length === 1)
        return parts[0];

    return parts.slice(0, -1).join("、") + "与" + parts[parts.length - 1];

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


// 已购买的升级数(exclude 给出互斥组时,不统计该组)
function theoremUpgradeCount(exclude){

    let n = 0;

    for(let i = 0; i < OWN_THEORY_CONFIG.upgrades.length; i++){

        let conf = OWN_THEORY_CONFIG.upgrades[i];

        if(exclude && conf.exclusive === exclude)
            continue;

        if(theoremUpgradeOwned(conf.key))
            n++;

    }

    return n;

}


// 升级的解锁条件:返回 null 表示可以购买,否则返回锁定原因文本
function theoremUpgradeLockReason(key){

    let conf =
    theoremUpgradeConf(key);

    if(!conf)
        return "未知升级";

    if(theoremUpgradeOwned(key))
        return null;

    // 前置升级
    if(conf.require){

        for(let i = 0; i < conf.require.length; i++){

            let req = conf.require[i];

            if(!theoremUpgradeOwned(req)){

                let rconf =
                theoremUpgradeConf(req);

                return "需要先购买「" +
                (rconf ? rconf.name : req) + "」";

            }

        }

    }

    // 互斥组:同组只能买一个
    if(conf.exclusive){

        for(let i = 0; i < OWN_THEORY_CONFIG.upgrades.length; i++){

            let other = OWN_THEORY_CONFIG.upgrades[i];

            if(other.key === key || other.exclusive !== conf.exclusive)
                continue;

            if(theoremUpgradeOwned(other.key))
                return "已选择「" + other.name + "」";

        }

    }

    // 需要已购买的升级总数(不含自身所在的互斥组)
    if(conf.requireUpgrades !== undefined){

        let n =
        theoremUpgradeCount(conf.exclusive);

        if(n < conf.requireUpgrades){

            return "需要已购买 " + conf.requireUpgrades +
            " 个理论升级（当前 " + n + " 个）";

        }

    }

    return null;

}


// 购买定理升级(消耗定理,不可退)
// 购买后理论力量 p 重置为 1(升级是"拿现有的 p 换更陡的曲线")
// 返回 "ok" | "owned"(已购买) | "locked"(前置/互斥未满足)
//      | "noTheorem"(定理不够) | "none"
function buyTheoremUpgrade(key){

    let conf =
    theoremUpgradeConf(key);

    if(!conf)
        return "none";

    if(!game.theoremUpgrades)
        game.theoremUpgrades = {};

    if(game.theoremUpgrades[key])
        return "owned";

    if(theoremUpgradeLockReason(key))
        return "locked";

    if(theoremUnused() < conf.cost)
        return "noTheorem";

    game.theoremUpgrades[key] = true;

    // 消耗定理的代价之外,p 也要从头积攒
    game.ownTheory = new Decimal(1);

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

    // 深入本源:本源获取 ×2 → 论文发表员的阈值也同步 ×2。
    // 否则同样的研究进度会让 originGain() 提前翻倍达标,
    // 自动完成研究变得比买之前更频繁。
    if(key === "deepOrigin")
        syncPublisherThreshold(2);

    saveGame();

    renderOriginPage();

    return "ok";

}


// 阈值写回字符串:小数用普通写法,大数用 "1.5e120"(去掉浮点毛刺)
// 结果必须能被 research.js 的 SETTING_NUMBER_RE 接受
function settingNumberString(v){

    if(!(v instanceof Decimal))
        v = new Decimal(v);

    if(v.lt(1e6))
        return String(Math.round(v.toNumber() * 1000) / 1000);

    let exp =
    v.log10().floor();

    let m =
    Math.round(
        v.div(Decimal.pow(10, exp)).toNumber() * 1000
    ) / 1000;

    // 9.9995 这类进位到 10 的,归一成 1e(n+1)
    if(m >= 10){
        m = m / 10;
        exp = exp.add(1);
    }

    return String(m) + "e" + exp.toString();

}


// 论文发表员的阈值 ×mult(阈值以字符串存储,支持科学计数法)
// 返回是否真的改了(助手不存在时不动)
function syncPublisherThreshold(mult){

    let a =
    game.assistants
    ? game.assistants.paperPublisher
    : null;

    if(!a)
        return false;

    // 非法 / 缺省值按默认阈值处理,顺便把存档里的脏值修正掉
    let cur =
    (typeof parseSettingValue === "function")
    ? parseSettingValue(a.threshold, 1)
    : null;

    if(!cur)
        cur = new Decimal(ORIGIN_CONFIG.publisherDefaultThreshold);

    a.threshold =
    settingNumberString(cur.mul(mult));

    // 助手页的输入框跟着改(强制回写,不受"正在编辑"保护影响)
    if(typeof syncHelperInputs === "function"
        && typeof document !== "undefined"){

        let box =
        document.getElementById("researchHelpers");

        if(box)
            syncHelperInputs(box, true);

    }

    return true;

}


// 深入本源:本源获取倍率 = 2^等级
// ⚠ 必须 round:pow 内部走 exp/ln,2^3 会算成 7.999999999999999,
// 本源公式最后要 floor,不取整就会白掉 1 点本源
function deepOriginMult(){

    return Decimal.pow(
        2,
        originUpgradeLevel("deepOrigin")
    ).round();

}


// 知识扩充:知识边界倍率 = 1e50^等级
function knowledgeExpandMult(){

    return ORIGIN_CONFIG.knowledgeExpandBase.pow(
        originUpgradeLevel("knowledgeExpand")
    );

}


// 底数这类小数的显示(2 → "2",2.2 → "2.2",顺手抹掉浮点毛刺)
function baseNumberText(v){

    let n =
    (v instanceof Decimal) ? v.toNumber() : Number(v);

    if(!isFinite(n))
        return format(v);

    return String(
        Math.round(n * 100) / 100
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

    // 本轮用时要按"清零前"的起算时间算,所以先记录再更新 lastOriginResetTime
    let runStart =
    game.lastOriginResetTime;

    let runTime =
    (runStart === null || runStart === undefined)
    ? null
    : Math.max(0, (game.totalTime || 0) - runStart);

    // 上一次完成研究的快照(完成研究按钮下方的第二行统计)
    game.lastOriginRunTime = runTime;
    game.lastOriginRunGain = gain;

    // 成就"回归基础":本轮从未解锁过理论2~5 → 记下达成标记
    // (理论上解锁过 → 不再判定;随后清零,开始下一轮的记录)
    if(!game.theory25ThisRun)
        game.basicOnlyOriginDone = true;

    game.theory25ThisRun = false;

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
            "<span class=\"milestone-val\">" + m.desc +
            (m.detail ? m.detail() : "") + "</span>";

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

    // ---- 上一次完成研究的快照(静态数据,不随本轮变化)----
    let prevTime =
    game.lastOriginRunTime;

    let prevGain =
    game.lastOriginRunGain;

    let prevTimeText =
    "—";

    let prevRateText =
    "—";

    let prevGainText =
    "—";

    if(prevTime !== null && prevTime !== undefined){

        prevTimeText =
        (typeof formatGameTime === "function")
        ? formatGameTime(prevTime)
        : Math.floor(prevTime) + " 秒";

        if(prevGain !== null && prevGain !== undefined){

            prevGainText = format(prevGain);

            if(prevTime > 0)
                prevRateText =
                format(new Decimal(prevGain).mul(60).div(prevTime));

        }

    }

    originSetText("originPrevElapsed", prevTimeText);
    originSetText("originPrevRate", prevRateText);
    originSetText("originPrevGain", prevGainText);

}


// 刷新"你的理论"的全部实时数值
// p 每帧都在增长,这些值只能走轻量刷新,
// 绝对不能放进任何"签名不变就 return"的重建逻辑里。
function refreshOwnTheoryNumbers(){

    let p =
    ownTheoryPower();

    originSetText("ownTheoryPower", format(p));
    originSetText("ownTheoryRate", format(ownTheoryRate()));
    originSetText("ownTheoryFormula", ownTheoryFormulaText());
    originSetText("ownTheoryTargets", ownTheoryTargetText());
    originSetText("ownTheoryEffect", format(ownTheoryEffect()));

    originSetText("ownTheoremTotal", theoremTotal());
    originSetText("ownTheoremUnused", theoremUnused());
    originSetText("ownTheoremMult",
        format(Decimal.pow(ownTheoryTheoremMult(), theoremUnused())));

    // ---- 时光之力(T(t))----
    // 只有买过才显示这一行;t 每帧都在变,同样走轻量刷新
    let timeKey =
    ownTheoryTimePower();

    let timeRow =
    document.getElementById("ownTheoryTimeRow");

    if(timeRow)
        timeRow.style.display = timeKey ? "" : "none";

    if(timeKey){

        originSetText("ownTheoryTimeName",
            timeKey === "timeFast" ? "迅速" : "持久");

        originSetText("ownTheoryTimeFormula",
            timeKey === "timeFast"
            ? "min(1000, 90000/t)"
            : "t");

        originSetText("ownTheoryTimeValue",
            format(ownTheoryTimeMult()));

        originSetText("ownTheoryElapsed",
            Math.floor(ownTheoryElapsed()));

    }

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
            theoremUpgradeOwned(conf.key);

            // 锁定原因只由"已购买"决定,所以它在重建签名里是稳定的
            let lock =
            owned ? null : theoremUpgradeLockReason(conf.key);

            let div =
            document.createElement("div");

            div.className =
            "theorem-card" + (owned ? " active" : (lock ? " locked" : ""));

            let extra = "";

            if(owned){

                extra =
                "<div class=\"theorem-owned\">已完成</div>";

            }else if(lock){

                extra =
                "<div class=\"theorem-lock\">🔒 " + lock + "</div>";

            }

            div.innerHTML =
            "<div class=\"theorem-head\">" +
            "<span class=\"theorem-name\">" + conf.name + "</span>" +
            "<span class=\"theorem-cost\">" + conf.cost + " 定理</span>" +
            "</div>" +
            "<div class=\"theorem-desc\">" + conf.desc + "</div>" +
            extra +
            (owned
                ? ""
                : "<button class=\"theorem-btn\" data-key=\"" + conf.key + "\"" +
                  (lock ? " data-lock=\"1\" disabled" : "") + ">" +
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

        if(!conf)
            continue;

        // 条件不足(前置 / 互斥 / 升级数量)的按钮保持禁用
        if(btn.getAttribute("data-lock") === "1")
            btn.disabled = true;
        else
            btn.disabled = theoremUnused() < conf.cost;

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

    // 结构签名 = 各升级等级 + "真·无尽阶梯"当前倍率
    // (它的加成倍率随累计本源变化,倍率变了要刷新卡片上的"当前 ×N")
    let key =
    ORIGIN_UPGRADE_LIST.map(function(c){
        return originUpgradeLevel(c.key);
    }).join(":") +
    ":st" + trueStaircaseMult().toString();

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
                "<div class=\"theorem-owned\">等级 " + lv + " ｜ " +
                (conf.activeText ? conf.activeText(lv) : "已购买") +
                "</div>";

            }else if(isLevel && conf.currentText){

                // 还没升级的等级型升级:也把"当前值"写出来
                // (底数提升这类升级,玩家需要知道自己现在的底数)
                extra =
                "<div class=\"theorem-owned\">" +
                conf.currentText(0) +
                "</div>";

            }else if(done){

                extra =
                "<div class=\"theorem-owned\">" +
                (conf.activeText ? conf.activeText(0) : "已购买") +
                "</div>";

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
