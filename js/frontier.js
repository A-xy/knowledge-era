// ============================================================
// 前沿领域(Frontier) —— 研究阶段4 解锁的探索模式
// 解锁:成就"求知"(达到研究阶段4),奖励"解锁前沿领域"。
//
// 进入 / 退出前沿领域都会进行一次"研究重置":
//   想法数 ≥ 12 → 与普通研究重置一致:获得行动点、可推进研究阶段,
//                 并计入研究重置次数、刷新最快用时、可触发"高速研究"
//   想法数 < 12 → 只做重置:不获得行动点、不推进阶段,也不计入任何数据
//
// 前沿领域中:
//   理论2~5 被禁用(不显示、无法解锁),仅基础理论有效
//   以与知识获取速率相同的速率获得"灵感"(详见 updateFrontier)
//   灵感不随研究重置清空(长期资源)
//
// 灵感用于编写论文(论文升级,配置见 FRONTIER_CONFIG.papers):
//   摘要 —— 消耗 1e36 灵感解锁;此后知识边界 ×sqrt(1+灵感)
//   引言 —— 消耗 1e50 灵感解锁;解锁新的元-力量效果
//   第3行(理论部分) —— 三选一,可整行重置
//   第4行(实验部分) —— 四选一,可整行重置
//   第5行(结论)     —— 占位,效果待定
//   第6行(参考文献) —— 三选一,可整行重置
//
// 精修(完成文本能力试炼后解锁,见 ability.js):
//   已完成的论文升级可以占用一个"精修名额"换成强化版效果,
//   不消耗任何资源;名额 = 文本能力点数(最多 5 个)。
//   升级被重置 / 清空时,对应的精修标记一起清掉。
//   强化后的文本见各升级的 refinedDesc,数值走 paperRefineActive() 分支。
// ============================================================


// ============================================================
// 配置
// ============================================================

// 论文升级列表(按 row 分行展示,同行内居中排列)
// 购买状态存放于 game.<key>Unlocked(如 game.summaryUnlocked)
// 新增论文只需在此追加一项
//
// 字段说明:
//   key      唯一标识
//   name     名称
//   cost     花费(灵感)
//   desc     效果说明
//   row      所在行(1~6;同行的升级居中排成一行)
//   require  额外条件(可选):
//              可以写单个条件对象,也可以写条件数组(数组时全部满足才可购买)
//              { type:"totalActionPoints", value:Decimal } 需要累计行动点总量
//              { type:"actionPoints", value:Decimal }      需要当前行动点
//              { type:"expCompletions", expKey:"exp1", value:number }
//                    需要实验完成次数:给了 expKey 取该实验,否则取四实验总和
//              { type:"researchStage", value:number }      需要达到的研究阶段
//              { type:"otherRowsComplete" }                除本行外其余行都已编写
//              label 用于显示("需要:xxx(当前 yyy)")
//            条件只是"门槛",达成即可,不消耗对应资源
//   resetRow 该行可重置:重置会退还本行全部升级的花费,并触发一次研究重置
//            (只在每行第一个升级上标记即可,见 rowResettable)
const FRONTIER_CONFIG = {
    papers: [
        {
            key: "summary",
            name: "摘要",
            row: 1,
            cost: new Decimal("1e36"),
            desc: "基于灵感,提高知识边界(知识边界 × sqrt(1+灵感))",
            // 精修后的描述(文本能力试炼解锁;显示为金色)
            refinedDesc: "基于灵感,提高知识边界(知识边界 × (1+灵感)^(2/3))"
        },
        {
            key: "intro",
            name: "引言",
            row: 2,
            cost: new Decimal("1e50"),
            desc: "解锁新的元-力量效果",
            refinedDesc: "解锁更多新的元-力量效果"
        },
        {
            key: "legacyTheory",
            name: "理论部分-关联旧理论",
            row: 3,
            resetRow: true,
            cost: new Decimal("1e70"),
            require: {
                type: "totalActionPoints",
                value: new Decimal("1e16"),
                label: "1e16 累计行动点"
            },
            desc: "元-力量的第二个效果提升(取 2 + 0.02·ln(MetaPower+1)² 与原值的较大值)",
            refinedDesc: "元-力量的第二个效果提升(取 2 + 0.02·ln(MetaPower+1)² 与原值的较大值)," +
            "元-力量的第三个效果也提升(变为 (1+MetaPower)^(1/3))"
        },
        {
            key: "experimentOriented",
            name: "理论部分-实验导向",
            row: 3,
            cost: new Decimal("1e70"),
            require: {
                type: "expCompletions",
                value: 10000,
                label: "10000 实验完成次数总和"
            },
            desc: "基于实验完成次数总和,提升所有实验助手的速度",
            refinedDesc: "基于实验完成次数总和,更多地提升所有实验助手的速度(公式改为 (1+完成总数)^(1/4))"
        },
        {
            key: "innovation",
            name: "理论部分-注重创新",
            row: 3,
            cost: new Decimal("1e135"),
            desc: "灵感提升知识获取",
            refinedDesc: "灵感更多地提升知识获取(公式改为 (1+灵感)^(1/3))"
        },
        {
            key: "refExp1",
            name: "实验部分-参考实验1",
            row: 4,
            resetRow: true,
            cost: new Decimal("1e480"),
            require: {
                type: "expCompletions",
                expKey: "exp1",
                value: 1e13,
                label: "1e13 实验1完成次数"
            },
            desc: "实验1的首次完成效果变为2倍(其中的额外加成部分 ×2)",
            refinedDesc: "实验1的首次完成效果变为2倍(其中的额外加成部分 ×2)," +
            "并且重复完成效果也^2"
        },
        {
            key: "refExp2",
            name: "实验部分-参考实验2",
            row: 4,
            cost: new Decimal("1e400"),
            require: {
                type: "expCompletions",
                expKey: "exp2",
                value: 1e11,
                label: "1e11 实验2完成次数"
            },
            desc: "实验2的首次完成效果变为2倍(其中的额外加成部分 ×2)",
            refinedDesc: "实验2的首次完成效果变为2倍(其中的额外加成部分 ×2)," +
            "并且重复完成效果也×2"
        },
        {
            key: "refExp3",
            name: "实验部分-参考实验3",
            row: 4,
            cost: new Decimal("1e400"),
            require: {
                type: "expCompletions",
                expKey: "exp3",
                value: 1e11,
                label: "1e11 实验3完成次数"
            },
            desc: "实验3的首次完成效果变为2倍(其中的额外加成部分 ×2)",
            refinedDesc: "实验3的首次完成效果变为2倍(其中的额外加成部分 ×2)," +
            "并且重复完成效果也^2"
        },
        {
            key: "refExp4",
            name: "实验部分-参考实验4",
            row: 4,
            cost: new Decimal("1e400"),
            require: {
                type: "expCompletions",
                expKey: "exp4",
                value: 1e11,
                label: "1e11 实验4完成次数"
            },
            desc: "实验4的首次完成效果变为2倍(其中的额外加成部分 ×2)",
            refinedDesc: "实验4的首次完成效果变为2倍(其中的额外加成部分 ×2)," +
            "并且重复完成效果也^2"
        },
        {
            // 承接整篇论文:全部条件达成后才能编写,解锁下一个层级(效果待实装)
            key: "conclusion",
            name: "结论",
            row: 5,
            cost: new Decimal("1e700"),
            require: [
                {
                    type: "totalActionPoints",
                    value: new Decimal("1e80"),
                    label: "1e80 累计行动点"
                },
                {
                    type: "researchStage",
                    value: 10,
                    label: "研究阶段 10"
                },
                {
                    type: "otherRowsComplete",
                    label: "其余各行均已完成"
                }
            ],
            desc: "解锁本源层(里程碑 / 你的理论 / 本源升级)",
            // 结论是本源层的入口,不参与精修(也不占精修名额)
            canRefine: false
        },
        {
            key: "refLegacyTheory",
            name: "参考文献-引用旧理论",
            row: 6,
            resetRow: true,
            cost: new Decimal("1e580"),
            desc: "理论1~5对知识的加成提高到 1.1 次方",
            refinedDesc: "理论1~5对知识的加成提高到 1.2 次方"
        },
        {
            key: "refTheory6",
            name: "参考文献-引用理论6",
            row: 6,
            cost: new Decimal("1e580"),
            desc: "理论6对知识的加成提高到 1.3 次方",
            refinedDesc: "理论6对知识的加成提高到 1.5 次方"
        },
        {
            key: "refExperiment",
            name: "参考文献-引用实验成果",
            row: 6,
            cost: new Decimal("1e580"),
            desc: "行动点获取公式的指数由 0.05 提升到 0.06",
            refinedDesc: "行动点获取公式的指数由 0.05 提升到 0.07"
        }
    ],

    // 精修"参考文献-引用实验成果"后的行动点公式指数
    // (普通购买为 RESEARCH_CONFIG.actionExpRef = 0.06)
    refineActionExp: 0.07
};


// ============================================================
// 旧存档兼容
// 按配置自动补齐前沿领域状态与全部论文升级解锁字段
// (新增论文升级时无需再改 save.js 的兼容代码)
// ============================================================
function ensurePaperCompat(){

    if(game.frontierActive === undefined)
        game.frontierActive = false;

    if(game.inspiration === undefined)
        game.inspiration = new Decimal(0);
    else if(!(game.inspiration instanceof Decimal))
        game.inspiration = new Decimal(game.inspiration);

    for(let i = 0; i < FRONTIER_CONFIG.papers.length; i++){

        let key =
        FRONTIER_CONFIG.papers[i].key + "Unlocked";

        if(game[key] === undefined)
            game[key] = false;

    }

    // 精修标记(老存档没有这个字段)
    paperRefineMap();

    // 已经不在手上的升级不该保留精修(文本试炼清空 / 重置行 / 改存档)
    for(let i = 0; i < FRONTIER_CONFIG.papers.length; i++){

        let key =
        FRONTIER_CONFIG.papers[i].key;

        if(!paperOwned(key))
            delete game.paperRefined[key];

    }

}


// 论文升级所在的行(按配置顺序去重,用于分行渲染)
function paperRows(){

    let rows = [];

    for(let i = 0; i < FRONTIER_CONFIG.papers.length; i++){

        let r =
        FRONTIER_CONFIG.papers[i].row || 1;

        if(rows.indexOf(r) < 0)
            rows.push(r);

    }

    rows.sort(function(a, b){ return a - b; });

    return rows;

}


// 取某一行的论文配置列表
function papersInRow(row){

    let list = [];

    for(let i = 0; i < FRONTIER_CONFIG.papers.length; i++){

        let p =
        FRONTIER_CONFIG.papers[i];

        if((p.row || 1) === row)
            list.push(p);

    }

    return list;

}


// 该行是否可重置(存在标记了 resetRow 的升级)
// 重置会退还该行全部升级的花费,并触发一次研究重置
function rowResettable(row){

    let list =
    papersInRow(row);

    for(let i = 0; i < list.length; i++){

        if(list[i].resetRow)
            return true;

    }

    return false;

}


// ============================================================
// "同一行只能获取一个"的限制
// 第3行是"三选一":玩家在该行选定一个后,同行其余升级不可再购买,
// 必须先重置本行(退还花费)才能改选。
// 一行只有一个升级时(第1、2行)天然满足该限制,不会产生额外影响。
// ============================================================

// 该行已选中的升级(未选返回 null)
function rowOwnedPaper(row){

    let list =
    papersInRow(row);

    for(let i = 0; i < list.length; i++){

        if(paperOwned(list[i].key))
            return list[i];

    }

    return null;

}


// 本源升级"多元论文"放行的升级:与同行的其它升级不再互斥
// (第3行 实验导向 / 第4行 参考实验3 / 第6行 引用实验成果)
const MULTI_PAPER_KEYS = [
    "experimentOriented",
    "refExp3",
    "refExperiment"
];


// 某个升级是否因"同行已选其它升级"而被锁定
// (自身已购买不算被锁定;同行无选中项也不算)
//
// 注意:开启"多元论文"后,同一行可能同时存在多个已购升级,
// 所以这里必须检查**整行**的已购集合,不能用 rowOwnedPaper()
// (那个只返回第一个,会漏判"同行还有一个非放行升级")。
//
// 规则:
//   没有多元论文 → 同行只要已选一个就锁死
//   有多元论文   → 自己要买的在放行列表里 → 直接放行;
//                  否则看已购项,只要有一个不在放行列表里就仍然锁死
function paperRowBlocked(p){

    if(!p)
        return false;

    if(paperOwned(p.key))
        return false;

    let list =
    papersInRow(p.row || 1);

    let owned = [];

    for(let i = 0; i < list.length; i++){

        if(paperOwned(list[i].key))
            owned.push(list[i]);

    }

    if(owned.length === 0)
        return false;

    // 本源升级"包罗万象":整行不再有互斥,谁都能买
    if(originUpgradeActive("allPapers"))
        return false;

    if(!originUpgradeActive("multiPaper"))
        return true;

    // 自己要买的属于"可共存"的三项 → 与同行任何升级都不冲突
    if(MULTI_PAPER_KEYS.indexOf(p.key) >= 0)
        return false;

    // 否则:同行只要还有一个"不可共存"的升级,就仍然锁死
    for(let i = 0; i < owned.length; i++){

        if(MULTI_PAPER_KEYS.indexOf(owned[i].key) < 0)
            return true;

    }

    return false;

}


// 判断某个升级当前是否可购买(展示用;buyPaper 内部是权威判定)
// 返回 { ok, reason },reason: "owned" | "row" | "require" | "noinspiration" | ""
function paperBuyState(p){

    if(!p)
        return { ok: false, reason: "none" };

    if(paperOwned(p.key))
        return { ok: false, reason: "owned" };

    if(paperRowBlocked(p))
        return { ok: false, reason: "row" };

    if(!paperRequireMet(p))
        return { ok: false, reason: "require" };

    // 文本能力试炼:论文升级数量上限
    if(typeof trialPaperBlocked === "function"
        && trialPaperBlocked(p.key))
        return { ok: false, reason: "trialpaper" };

    if(frontierInspiration().lt(p.cost))
        return { ok: false, reason: "noinspiration" };

    return { ok: true, reason: "" };

}


// 额外条件列表:require 可以写单个条件对象,也可以写条件数组
// (数组时全部满足才算达成)
function paperRequireList(p){

    if(!p || !p.require)
        return [];

    return Array.isArray(p.require)
    ? p.require
    : [p.require];

}


// 额外条件是否已达成(无 require 视为已达成)
// 条件只是门槛,达成即可,不消耗对应资源
function paperRequireMet(p){

    let list =
    paperRequireList(p);

    for(let i = 0; i < list.length; i++){

        if(!paperRequireMetOne(list[i], p))
            return false;

    }

    return true;

}


// 单个条件判定
//   type = "totalActionPoints" 累计行动点总量(含已消费,game.totalResearchPoints)
//          "actionPoints"      当前行动点
//          "expCompletions"    实验完成次数(给 expKey 取该实验,否则取四实验总和)
//          "researchStage"     研究阶段
//          "otherRowsComplete" 除本行外,其余每一行都编写了一个升级
function paperRequireMetOne(r, p){

    if(!r)
        return true;

    // 累计行动点总量(含已消费,game.totalResearchPoints)
    if(r.type === "totalActionPoints")
        return new Decimal(
            game.totalResearchPoints || 0
        ).gte(r.value);

    // 当前行动点
    if(r.type === "actionPoints")
        return new Decimal(
            game.actionPoints || 0
        ).gte(r.value);

    if(r.type === "expCompletions")
        return paperRequireCurrent(r).gte(r.value);

    if(r.type === "researchStage")
        return (game.researchStage || 1) >= r.value;

    if(r.type === "otherRowsComplete"){

        let g =
        paperOtherRowsProgress(p);

        return g.done >= g.total;

    }

    return true;

}


// "其余各行是否都编写了升级"的进度(排除本升级所在行)
function paperOtherRowsProgress(p){

    let selfRow =
    (p && p.row) || 1;

    let rows =
    paperRows();

    let done =
    0;

    let total =
    0;

    for(let i = 0; i < rows.length; i++){

        if(rows[i] === selfRow)
            continue;

        total++;

        if(rowOwnedPaper(rows[i]) !== null)
            done++;

    }

    return { done: done, total: total };

}


// 某个实验次数类条件的当前值
//   给了 expKey → 该实验的完成次数;否则 → 四实验完成次数总和
function paperRequireCurrent(r){

    if(!r)
        return new Decimal(0);

    if(r.expKey)
        return expCompletions(r.expKey);

    return totalExpCompletions();

}


// 单个条件的进度文本
function paperRequireTextOne(r, p){

    if(!r)
        return "";

    if(r.type === "totalActionPoints")
        return "需要:" + r.label
        + "(当前 " + format(game.totalResearchPoints || 0) + ")";

    if(r.type === "actionPoints")
        return "需要:" + r.label
        + "(当前 " + format(game.actionPoints || 0) + ")";

    if(r.type === "expCompletions")
        return "需要:" + r.label
        + "(当前 " + format(paperRequireCurrent(r)) + ")";

    if(r.type === "researchStage")
        return "需要:" + r.label
        + "(当前 " + (game.researchStage || 1) + ")";

    if(r.type === "otherRowsComplete"){

        let g =
        paperOtherRowsProgress(p);

        return "需要:" + r.label
        + "(已完成 " + g.done + "/" + g.total + " 行)";

    }

    return "需要:" + (r.label || "");

}


// 额外条件的当前进度文本(用于未达成时提示)
// 多个条件各占一行(.paper-req 用 white-space: pre-line 换行)
function paperRequireText(p){

    let list =
    paperRequireList(p);

    let lines =
    [];

    for(let i = 0; i < list.length; i++)
        lines.push(paperRequireTextOne(list[i], p));

    return lines.join("\n");

}


// 论文升级的条件文本(无 require 时为空)
function paperRequireLabel(p){

    let list =
    paperRequireList(p);

    if(list.length < 1)
        return "";

    return "需要:" + list[0].label;

}


// 按 key 取论文配置(找不到返回 null)
function paperConfig(key){

    for(let i = 0;
        i < FRONTIER_CONFIG.papers.length;
        i++){

        if(FRONTIER_CONFIG.papers[i].key === key)
            return FRONTIER_CONFIG.papers[i];

    }

    return null;

}


// 某篇论文是否已完成(购买状态字段:game.<key>Unlocked)
function paperOwned(key){
    return !!game[key + "Unlocked"];
}


// ============================================================
// 精修(完成文本能力试炼后解锁,名额 = 文本能力点数)
//   状态:game.paperRefined[key] = true
//   精修不消耗资源,只占名额;升级被重置 / 清空时标记一起清掉
// ============================================================

function paperRefineMap(){

    if(!game.paperRefined || typeof game.paperRefined !== "object")
        game.paperRefined = {};

    return game.paperRefined;

}


// 精修是否生效:升级必须在手(存档被改坏时不会凭空生效)
function paperRefineActive(key){

    return paperOwned(key) && !!paperRefineMap()[key];

}


// 精修是否不限数量(本源升级「包罗万象II」)
function paperRefineUnlimited(){

    return (typeof originUpgradeActive === "function")
    && originUpgradeActive("allPapersII");

}


// 精修名额(= 文本能力点数;「包罗万象II」生效时不再限制)
function paperRefineLimit(){

    if(paperRefineUnlimited())
        return Infinity;

    return (typeof abilityRefineCount === "function")
    ? abilityRefineCount()
    : 0;

}


// 这个升级的精修是否不占用名额(「多元论文II」放行那三个)
function paperRefineFree(key){

    if(!originUpgradeActive("multiPaperII"))
        return false;

    return MULTI_PAPER_KEYS.indexOf(key) >= 0;

}


// 已占用的精修名额
// (「多元论文II」生效时,放行的那三个精修了也不算名额)
function paperRefinedCount(){

    let n = 0;

    for(let i = 0; i < FRONTIER_CONFIG.papers.length; i++){

        let key =
        FRONTIER_CONFIG.papers[i].key;

        if(!paperRefineActive(key))
            continue;

        if(paperRefineFree(key))
            continue;

        n++;

    }

    return n;

}


// 不占名额的精修数量(多元论文II 生效时才可能 > 0;界面提示用)
function paperRefinedFreeCount(){

    let n = 0;

    for(let i = 0; i < FRONTIER_CONFIG.papers.length; i++){

        let key =
        FRONTIER_CONFIG.papers[i].key;

        if(paperRefineActive(key) && paperRefineFree(key))
            n++;

    }

    return n;

}


// 这个升级能否精修(结论是本源层的入口,不参与精修)
function paperCanRefine(key){

    let conf =
    paperConfig(key);

    return !!conf && conf.canRefine !== false;

}


// 精修:占一个名额,效果换成强化版(refinedDesc)
// 返回 "ok" | "owned"(已精修) | "notowned" | "norefine"(不可精修)
//      | "full"(名额已用满)
function refinePaper(key){

    if(!paperOwned(key))
        return "notowned";

    if(!paperCanRefine(key))
        return "norefine";

    if(paperRefineActive(key))
        return "owned";

    // 名额判定:不占名额的(「多元论文II」放行的那三个)不看名额,
    // 否则先精修别的把名额用满,这三个就再也点不动了
    if(!paperRefineFree(key)
        && paperRefinedCount() >= paperRefineLimit())
        return "full";

    paperRefineMap()[key] = true;

    saveGame();
    renderFrontierPage();

    return "ok";

}


// 取消精修(把名额还回来;精修不消耗资源,所以可以自由改)
// 取消精修等于改动手稿 → 与"重置本行"同口径,进行一次研究重置
// (想法数 ≥ 12 时正常结算,否则只重置、不计入任何数据)
function unrefinePaper(key){

    if(!paperRefineActive(key))
        return false;

    delete paperRefineMap()[key];

    saveGame();

    frontierReset();

    renderFrontierPage();

    return true;

}


// 前沿领域是否已解锁(成就"求知":达到研究阶段4)
function frontierUnlocked(){
    return isAchievementUnlocked("stage4");
}


// 当前是否处于前沿领域中
function frontierActive(){
    return !!game.frontierActive;
}


// 灵感(Decimal;兼容旧存档)
function frontierInspiration(){

    if(game.inspiration === undefined
        || game.inspiration === null)
        game.inspiration = new Decimal(0);

    return game.inspiration;

}


// 本源升级「思如泉涌」:不在前沿领域中也能获得灵感
function ideaSpringActive(){

    return (typeof originUpgradeActive === "function")
    && originUpgradeActive("ideaSpring");

}


// 灵感获取速率
//   前沿领域中 : 与知识获取速率相同
//   不在领域中 : 「思如泉涌」生效时为 知识获取速率^(2/3),否则 0
//   综合能力试炼中:恒为 0(试炼期间无法获得灵感)
function frontierInspirationRate(){

    if(typeof comprehensiveInspirationBlocked === "function"
        && comprehensiveInspirationBlocked())
        return new Decimal(0);

    if(!frontierActive()){

        if(!ideaSpringActive() || !frontierUnlocked())
            return new Decimal(0);

        return Decimal.pow(getKnowledgeSpeed(), 2 / 3);

    }

    return getKnowledgeSpeed();

}


// 每 tick 累计灵感(前沿领域中,或「思如泉涌」生效时)
function updateFrontier(dt){

    if(!frontierActive()
        && !ideaSpringActive())
        return;

    let rate =
    frontierInspirationRate();

    if(rate.lte(0))
        return;

    game.inspiration =
    frontierInspiration().add(
        rate.mul(dt)
    );

}


// ============================================================
// 论文升级的效果(界面只显示结果值,公式统一在这里)
// ============================================================

// 注:实验完成次数总和统一用 stats.js 的 totalExpCompletions()
// (原 stats.js 已有该函数,这里不再重复定义,避免同名覆盖)


// "实验导向":实验助手速度 ×(1 + 实验完成次数总和)^0.2
//   精修后指数提升为 1/4
function experimentOrientedBonus(){

    if(!paperOwned("experimentOriented"))
        return new Decimal(1);

    let expo =
    paperRefineActive("experimentOriented") ? 1/4 : 0.2;

    return Decimal.pow(
        new Decimal(1).add(totalExpCompletions()),
        expo
    );

}


// "注重创新":知识获取 ×(1 + 灵感)^(1/4)
//   精修后指数提升为 1/3;灵感取当前值(动态);未购买为 ×1
function innovationBonus(){

    if(!paperOwned("innovation"))
        return new Decimal(1);

    let expo =
    paperRefineActive("innovation") ? 1/3 : 1/4;

    return Decimal.pow(
        new Decimal(1).add(frontierInspiration()),
        expo
    );

}


// "实验部分-参考实验N"(第4行):该实验"首次完成效果"中的
// 额外加成部分 ×2。未购买返回 1(不放大)。
// 作用点:
//   N=1 元-力量效果1 指数(exp1Exponent)
//   N=2 元-力量随想法加成底数(exp2Base)
//   N=3 想法价格膨胀延后(exp3Effect)
//   N=4 理论价格膨胀延后(exp4Effect)
// 注:多次完成加成不属于"首次完成效果",不受本倍率影响;
//    精修"参考实验N"后,多次完成效果会另行放大(见 experiment.js 的
//    exp1CompletionBonus / exp2CompletionBonus / exp3CompletionDivisor /
//    exp4CompletionBonus)
function refExpMultiplier(n){

    if(typeof paperOwned !== "function")
        return 1;

    return paperOwned("refExp" + n) ? 2 : 1;

}


// ------------------------------------------------------------
// "参考文献"系列(第6行,三选一)
// ------------------------------------------------------------

// "参考文献-引用旧理论":理论1~5 的乘积指数 1 → 1.1
// 精修后 → 1.2
// 作用点:theories.js 的 theoryPowerProduct()
function refLegacyTheoryExponent(){

    if(typeof paperOwned !== "function"
        || !paperOwned("refLegacyTheory"))
        return 1;

    return paperRefineActive("refLegacyTheory") ? 1.2 : 1.1;

}


// "参考文献-引用理论6":理论6 的乘积指数 1 → 1.3
// 精修后 → 1.5
// 作用点:theories.js 的 theoryPowerProduct()
function refTheory6Exponent(){

    if(typeof paperOwned !== "function"
        || !paperOwned("refTheory6"))
        return 1;

    return paperRefineActive("refTheory6") ? 1.5 : 1.3;

}


// "参考文献-引用实验成果":行动点公式指数 0.05 → 0.06
// 精修后 → 0.07
// 能力「细心」:再 +0.005×细心(细心试炼中失效)
// 作用点:research.js 的 actionPointsGain()
function researchActionExp(){

    let exp =
    RESEARCH_CONFIG.actionExp;

    if(typeof paperOwned === "function"
        && paperOwned("refExperiment"))
        exp = paperRefineActive("refExperiment")
        ? FRONTIER_CONFIG.refineActionExp
        : RESEARCH_CONFIG.actionExpRef;

    // 0.05 + 0.005×n 的浮点尾巴(0.060000000000000005)要去掉,
    // 这个值会直接显示在论文卡片上
    let bonus =
    ((typeof carefulActionExpBonus === "function")
        ? carefulActionExpBonus()
        : 0);

    return Math.round((exp + bonus) * 1e9) / 1e9;

}


// ============================================================
// 各升级当前提供的加成倍数(卡片内显示,只显示数值不显示公式)
// 这些值随灵感/元-力量/实验次数实时变化,必须走逐帧刷新,不能进结构签名
// ============================================================

function paperMultText(key){

    if(key === "legacyTheory"){

        let text =
        "当前升级倍率:×" + format(metaUpgradeRate());

        // 精修后额外提升元-力量效果3(获取速度)
        if(paperRefineActive("legacyTheory")
            && isEffectUnlocked("metaGain"))
            text += " ｜ 元-力量获取:×" + format(metaGainBonus());

        return text;

    }

    if(key === "experimentOriented")
        return "当前加成:×" + format(experimentOrientedBonus());

    if(key === "innovation")
        return "当前加成:×" + format(innovationBonus());

    // "参考文献-引用旧理论":(Π理论1~5)^n ÷ (Π理论1~5) = (Π理论1~5)^(n-1)
    // (n 普通 1.1 / 精修 1.2)
    if(key === "refLegacyTheory")
        return "当前加成:×" +
        format(theoryProductLegacy().pow(refLegacyTheoryExponent() - 1));

    // "参考文献-引用理论6":(理论6)^n ÷ 理论6 = (理论6)^(n-1)
    if(key === "refTheory6")
        return "当前加成:×" +
        format(theoryProduct6().pow(refTheory6Exponent() - 1));

    // "参考文献-引用实验成果":指数提升不是倍数,直接显示指数
    if(key === "refExperiment")
        return "当前公式指数:^" + researchActionExp();

    return "";

}


// ============================================================
// 知识边界(受论文升级"摘要"影响)
// ============================================================

// 摘要是否已购买
function summaryUnlocked(){
    return paperOwned("summary");
}


// 引言是否已购买(解锁新的元-力量效果)
function introUnlocked(){
    return paperOwned("intro");
}


// 摘要对知识边界的加成倍率;未购买为 ×1
//   普通:sqrt(1 + 灵感) = (1+灵感)^(1/2)
//   精修: (1+灵感)^(2/3)
function summaryBoundaryBonus(){

    if(!summaryUnlocked())
        return new Decimal(1);

    let expo =
    paperRefineActive("summary") ? 2/3 : 1/2;

    return Decimal.pow(
        new Decimal(1).add(frontierInspiration()),
        expo
    );

}


// 当前知识边界 = 基础 1.79e308 × 摘要加成 × 效果7(引言·知识边界提升)
// 注意:成就"无限"仍以基础边界 1.79e308 判定
function knowledgeLimit(){

    return KNOWLEDGE_LIMIT
    .mul(
        summaryBoundaryBonus()
    )
    .mul(
        metaBoundaryBonus()
    )
    // 本源升级"知识扩充":×1e50^等级(未购买 ×1)
    .mul(
        typeof knowledgeExpandMult === "function"
        ? knowledgeExpandMult()
        : 1
    );

}


// ============================================================
// 进入 / 退出
// ============================================================

// 前沿领域进出的研究重置
//   想法数 ≥ 12(正常研究重置条件) → 视为一次正常重置:
//       正常结算(获得AP、可推进阶段),并计入次数 / 最快用时 / 高速研究
//   想法数 < 12 → 只做重置:不获得AP、不推进阶段,也不计入任何数据
function frontierReset(){

    let normal =
    game.ideas >= researchNeedIdeas();

    applyResearchResetCore(normal, normal);

    if(normal)
        recordResearchReset();

    saveGame();

    renderTheories();
    renderIdeaPage();
    renderResearchPage();

}


// 进入前沿领域(会触发研究重置)
function enterFrontier(){

    if(!frontierUnlocked() || frontierActive())
        return;

    game.frontierActive = true;

    // 成就「并无区别」:在综合能力试炼中进入前沿领域
    if(typeof trialActive === "function"
        && trialActive("comprehensive"))
        game.compTrialFrontierDone = true;

    frontierReset();

    saveGame();

}


// 退出前沿领域(会触发研究重置)
function exitFrontier(){

    if(!frontierActive())
        return;

    game.frontierActive = false;

    frontierReset();

    saveGame();

}


// 页面按钮:进入 / 退出切换
function toggleFrontier(){

    if(frontierActive())
        exitFrontier();
    else
        enterFrontier();

}


// ============================================================
// 论文升级
// ============================================================

// 购买一篇论文
// 返回: "ok"            | "owned"(已完成) | "noinspiration"(灵感不足)
//     | "require"(额外条件未达成)      | "row"(同行已选其它升级,需先重置该行)
//     | "none"(无此论文)
function buyPaper(key){

    let conf =
    paperConfig(key);

    if(!conf)
        return "none";

    if(paperOwned(key))
        return "owned";

    // 同一行只能获取一个:同行已选定其它升级 → 必须先重置该行
    if(paperRowBlocked(conf))
        return "row";

    // 额外条件只是门槛:达成即可,不消耗对应资源
    if(!paperRequireMet(conf))
        return "require";

    // 文本能力试炼的数量上限(购买时是权威判定)
    if(typeof trialPaperBlocked === "function"
        && trialPaperBlocked(key))
        return "trialpaper";

    if(frontierInspiration().lt(conf.cost))
        return "noinspiration";

    game.inspiration =
    frontierInspiration().sub(conf.cost);

    game[key + "Unlocked"] = true;

    saveGame();

    renderFrontierPage();

    // 首次编写"结论":播放本源层剧情(此后本源页面永久显示)
    if(key === "conclusion" && !game.conclusionStorySeen){

        game.conclusionStorySeen = true;

        saveGame();

        showConclusionStory();

    }

    return "ok";

}


// 购买"摘要"
function buySummary(){
    return buyPaper("summary");
}


// 购买"引言"
function buyIntro(){
    return buyPaper("intro");
}


// ============================================================
// 整行重置(退还该行全部升级的灵感,并触发一次研究重置)
// ============================================================

// 重置某一行升级
//   退还该行已购买升级的花费总和
//   之后进行一次研究重置,算法与进入/退出前沿领域一致:
//     想法数 ≥ 12 → 正常结算(获得行动点、可推进阶段)并计入统计
//     想法数 < 12 → 只重置,不计入任何数据
// 返回退还的灵感(Decimal),该行无升级时返回 0
// 清空某一行已购买的升级并退还灵感(不触发研究重置)
// 返回退还的灵感(Decimal);该行没有已购升级时返回 0
// (导入论文升级时先用它把所有可重置行清空,最后统一重置一次)
function clearPaperRow(row){

    let list =
    papersInRow(row);

    let refund =
    new Decimal(0);

    let any =
    false;

    for(let i = 0; i < list.length; i++){

        let p =
        list[i];

        if(!paperOwned(p.key))
            continue;

        any = true;

        refund = refund.add(p.cost);

        game[p.key + "Unlocked"] = false;

        // 升级没了,精修也就不成立了(名额随之释放)
        delete paperRefineMap()[p.key];

    }

    if(!any)
        return new Decimal(0);

    game.inspiration =
    frontierInspiration().add(refund);

    return refund;

}


function resetPaperRow(row){

    let refund =
    clearPaperRow(row);

    if(refund.lte(0))
        return new Decimal(0);

    saveGame();

    // 与研究重置一致(含前沿领域进出的计入规则)
    frontierReset();

    renderFrontierPage();

    return refund;

}


// ============================================================
// 全部重置(退还所有已购买升级的灵感,并触发一次研究重置)
//   refund   = false 时只清空、不退还(文本能力试炼进入时用)
//   skipKeys = 不参与清空的升级(文本试炼保留「结论」)
// 返回退还的灵感(refund=false 时返回 0)
// ============================================================
function clearAllPapers(refund, skipKeys){

    let total =
    new Decimal(0);

    for(let i = 0; i < FRONTIER_CONFIG.papers.length; i++){

        let p =
        FRONTIER_CONFIG.papers[i];

        if(skipKeys && skipKeys.indexOf(p.key) >= 0)
            continue;

        if(!paperOwned(p.key))
            continue;

        game[p.key + "Unlocked"] = false;

        // 升级没了,精修也就不成立了(名额随之释放)
        delete paperRefineMap()[p.key];

        total = total.add(p.cost);

    }

    if(!refund || total.lte(0))
        return new Decimal(0);

    game.inspiration =
    frontierInspiration().add(total);

    return total;

}


// 是否还有任何已购买的论文升级
function anyPaperOwned(){

    for(let i = 0; i < FRONTIER_CONFIG.papers.length; i++){

        if(paperOwned(FRONTIER_CONFIG.papers[i].key))
            return true;

    }

    return false;

}


// 论文升级页的"重置所有论文升级"按钮
// 与"重置本行"同一口径:退还灵感 + 进行一次研究重置
function resetAllPapers(){

    if(!anyPaperOwned())
        return new Decimal(0);

    if(typeof confirm === "function"
        && !confirm("重置所有论文升级?将退还全部升级花费的灵感," +
            "并进行一次研究重置。"))
        return new Decimal(0);

    let refund =
    clearAllPapers(true);

    if(refund.lte(0))
        return new Decimal(0);

    saveGame();

    frontierReset();

    renderFrontierPage();

    return refund;

}


// ============================================================
// 论文升级的导出 / 导入
// 导出格式:{xy,xy,...}
//   x = 第几行,y = 该行内的第几个升级(配置顺序,从 1 开始)
//   例:{11,21,31,41,51} = 每行都选了第一个
// 导入:先清空所有"可重置的行"(退还灵感),再按行顺序购买导入的升级,
//       最后统一进行一次研究重置(与"重置本行"的代价一致)。
// 只影响升级状态,不改存档格式。
// ============================================================

// 导入窗口的展开状态与输入内容
// (面板重建时 textarea 的内容会丢,所以另存一份;也用于把输入框恢复原样)
let paperImportOpen = false;
let paperImportText = "";

// 导入/导出的提示文本(面板重建后靠它恢复)
let paperIoMessage = "";


// 把提示写到按钮右侧
function setPaperIoMessage(text){

    paperIoMessage = text;

    let el =
    document.getElementById("paperIoMsg");

    if(el)
        el.innerText = text;

}


// 某个升级在其所在行内的列号(从 1 开始;找不到返回 0)
function paperColumn(key){

    let conf =
    paperConfig(key);

    if(!conf)
        return 0;

    let list =
    papersInRow(conf.row || 1);

    for(let i = 0; i < list.length; i++){

        if(list[i].key === key)
            return i + 1;

    }

    return 0;

}


// 当前已购买的论文升级 → "{11,21,31,41,51,61}"
// 已精修的升级在末尾加 *:例 {11*,21,31}
function paperExportCode(){

    let parts = [];

    let rows =
    paperRows();

    for(let i = 0; i < rows.length; i++){

        let list =
        papersInRow(rows[i]);

        for(let j = 0; j < list.length; j++){

            if(paperOwned(list[j].key))
                parts.push(
                    "" + rows[i] + (j + 1)
                    + (paperRefineActive(list[j].key) ? "*" : "")
                );

        }

    }

    return "{" + parts.join(",") + "}";

}


// 复制文本到剪贴板(clipboard API 不可用时回退到 textarea + execCommand)
// 结果通过回调告知(true = 成功)
function copyTextToClipboard(text, cb){

    let fallback =
    function(){

        let ok = false;

        try{

            let ta =
            document.createElement("textarea");

            ta.value = text;
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            ta.style.opacity = "0";

            document.body.appendChild(ta);
            ta.select();

            ok = document.execCommand("copy");

            document.body.removeChild(ta);

        }catch(e){
            ok = false;
        }

        cb(ok);

    };

    if(typeof navigator !== "undefined"
        && navigator.clipboard
        && navigator.clipboard.writeText){

        try{

            navigator.clipboard.writeText(text).then(
                function(){ cb(true); },
                function(){ fallback(); }
            );

            return;

        }catch(e){
            // 落到回退方案
        }

    }

    fallback();

}


// 页面按钮:导出到剪贴板
function exportPapers(){

    let code =
    paperExportCode();

    copyTextToClipboard(code, function(ok){

        setPaperIoMessage(
            ok
            ? "已导出到剪贴板:" + code
            : "复制失败,请手动复制:" + code
        );

    });

}


// 解析导入文本 → { keys: [...], refined: [...], bad: [...] }
// 容忍空格/换行/大括号/中文逗号;每项必须是两位数字(行 + 列)
// 末尾带 * 的项表示该升级已精修(例:11*)
function parsePaperCode(text){

    let keys = [];
    let refined = [];
    let bad = [];

    let raw =
    String(text || "")
    .replace(/[{}｛｝]/g, "")
    .replace(/，/g, ",");

    let parts =
    raw.split(",");

    for(let i = 0; i < parts.length; i++){

        let rawTok =
        parts[i].replace(/\s/g, "");

        if(rawTok === "")
            continue;

        let star =
        rawTok.charAt(rawTok.length - 1) === "*";

        let tok =
        star ? rawTok.slice(0, -1) : rawTok;

        if(!/^[0-9]{2}$/.test(tok)){
            bad.push(rawTok);
            continue;
        }

        let row =
        Number(tok.charAt(0));

        let col =
        Number(tok.charAt(1));

        let list =
        papersInRow(row);

        if(list.length === 0 || col < 1 || col > list.length){
            bad.push(rawTok);
            continue;
        }

        let key =
        list[col - 1].key;

        if(keys.indexOf(key) < 0)
            keys.push(key);

        // 结论不参与精修(导入时也按不可精修处理)
        if(star
            && paperCanRefine(key)
            && refined.indexOf(key) < 0)
            refined.push(key);

    }

    return { keys: keys, refined: refined, bad: bad };

}


// 购买失败原因 → 提示文本
function paperImportFailText(r){

    if(r === "noinspiration")
        return "灵感不足";

    if(r === "require")
        return "条件未达成";

    if(r === "row")
        return "本行已选其它升级";

    if(r === "none")
        return "配置中不存在";

    return "无法购买";

}


// 页面按钮:打开 / 关闭导入窗口
function togglePaperImport(){

    paperImportOpen = !paperImportOpen;

    // 第一次打开时,把当前的升级情况预填进去(方便照着改)
    if(paperImportOpen && !paperImportText)
        paperImportText = paperExportCode();

    // 展开状态进了结构签名,重建会把窗口显示/隐藏掉
    renderFrontierPage();

}


// 页面按钮:执行导入
function importPapers(){

    let input =
    document.getElementById("paperImportInput");

    let text =
    input
    ? input.value
    : paperImportText;

    let parsed =
    parsePaperCode(text);

    if(parsed.keys.length === 0 && parsed.bad.length === 0){

        setPaperIoMessage("没有可导入的内容");
        return;

    }

    // ---- 1. 清空所有可重置的行(退还灵感)----
    let rows =
    paperRows();

    let refunded =
    new Decimal(0);

    for(let i = 0; i < rows.length; i++){

        if(rowResettable(rows[i]))
            refunded = refunded.add(clearPaperRow(rows[i]));

    }

    // ---- 2. 按"行优先"的顺序购买 ----
    // (结论要求"其余各行均已完成",所以必须从前往后买)
    parsed.keys.sort(function(a, b){

        let ra = paperConfig(a).row || 1;
        let rb = paperConfig(b).row || 1;

        if(ra !== rb)
            return ra - rb;

        return paperColumn(a) - paperColumn(b);

    });

    // 购买两轮:第一轮失败的再试一次 —— 结论排在参考文献之前,
    // 而结论要求"其余各行已完成",一轮买下来必然差最后一行。
    let pending = [];
    let done = 0;
    let fail = [];

    for(let i = 0; i < parsed.keys.length; i++)
        pending.push({ key: parsed.keys[i], reason: "" });

    for(let round = 0; round < 2 && pending.length > 0; round++){

        let retry = [];

        for(let i = 0; i < pending.length; i++){

            let item =
            pending[i];

            let r =
            buyPaper(item.key);

            if(r === "ok" || r === "owned"){

                done++;
                continue;

            }

            if(round === 0)
                retry.push({ key: item.key, reason: r });
            else
                fail.push({ key: item.key, reason: r });

        }

        pending = retry;

    }

    for(let i = 0; i < fail.length; i++){

        let conf =
        paperConfig(fail[i].key);

        fail[i] =
        (conf ? conf.name : fail[i].key) +
        "(" + paperImportFailText(fail[i].reason) + ")";

    }

    // ---- 2.5 精修(按导入项末尾的 * 标记;名额不够的跳过)----
    let refinedDone = 0;
    let refinedFail = [];

    if(parsed.refined && parsed.refined.length > 0){

        for(let i = 0; i < parsed.refined.length; i++){

            let key =
            parsed.refined[i];

            // 购买失败的升级不精修
            if(!paperOwned(key))
                continue;

            if(paperRefineActive(key)){
                refinedDone++;
                continue;
            }

            if(paperRefinedCount() >= paperRefineLimit()){

                let conf =
                paperConfig(key);

                refinedFail.push(conf ? conf.name : key);
                continue;

            }

            paperRefineMap()[key] = true;
            refinedDone++;

        }

    }

    // ---- 3. 有行被清空过 → 统一做一次研究重置 ----
    if(refunded.gt(0)){

        saveGame();

        frontierReset();

    }

    // ---- 4. 结果提示 + 收起窗口 ----
    let msg =
    "已导入 " + done + " 项";

    if(refinedDone > 0)
        msg += ";已精修 " + refinedDone + " 项";

    if(refinedFail.length > 0)
        msg += ";精修名额不足:" + refinedFail.join("、");

    if(parsed.bad.length > 0)
        msg += ";无法识别:" + parsed.bad.join(",");

    if(fail.length > 0)
        msg += ";失败:" + fail.join("、");

    paperImportOpen = false;

    setPaperIoMessage(msg);

    renderFrontierPage();

}


// ============================================================
// 界面渲染
// ============================================================

// 结构签名:解锁/激活/论文 状态变化时才重建 DOM(数值每 tick 更新)
let lastFrontierKey = "";


// 生成某个论文升级"方块"的 HTML(升级内容 + 花费 + 条件)
// 已购买 → "已完成";同行已选其它升级 → 灰掉并提示"本行已选择其它升级"
// 其余情况可点击"编写"
function paperCardHTML(p){

    let owned =
    paperOwned(p.key);

    let refined =
    paperRefineActive(p.key);

    let rowBlocked =
    paperRowBlocked(p);

    let reqMet =
    paperRequireMet(p);

    let reqLabel =
    paperRequireLabel(p);

    // 精修后描述换成强化版,并改成金色
    let descText =
    (refined && p.refinedDesc)
    ? p.refinedDesc
    : p.desc;

    let html =
    '<div class="paper-card'
    + (owned ? " owned" : " locked")
    + (refined ? " refined" : "")
    + (rowBlocked ? " row-blocked" : "")
    + '" data-paper-card="' + p.key + '">' +
    '<div class="paper-name">' + p.name + '</div>' +
    '<div class="paper-desc' + (refined ? " refined" : "") + '">' +
    descText + '</div>' +
    '<div class="paper-cost">花费:' + format(p.cost) + ' 灵感</div>';

    if(reqLabel){
        html +=
        '<div class="paper-req' + (reqMet ? " met" : "") + '"' +
        ' data-paper-req="' + p.key + '">' +
        paperRequireText(p) + (reqMet ? "(已满足)" : "") +
        '</div>';
    }

    if(owned){

        // 升级提供的加成倍数(实时数值 → 逐帧刷新,不能只在重建时写一次)
        let mult =
        paperMultText(p.key);

        if(mult)
            html +=
            '<div class="paper-mult" data-paper-mult="' + p.key + '">' +
            mult +
            '</div>';

        html +=
        '<div class="paper-state">已完成</div>';

        // ---- 精修(金色;结论不参与)----
        if(p.canRefine !== false){

            if(refined){

                html +=
                '<div class="paper-refine-row">' +
                '<span class="paper-refine-done">已精修</span>' +
                '<button class="paper-refine-cancel"' +
                ' onclick="unrefinePaper(\'' + p.key + '\')">取消</button>' +
                '</div>';

            }else{

                // 不占名额的精修(多元论文II)在名额用满后也能点
                let canRefine =
                paperRefineFree(p.key)
                || paperRefinedCount() < paperRefineLimit();

                html +=
                '<div class="paper-refine-row">' +
                '<button class="paper-refine-btn"' +
                (canRefine ? '' : ' disabled') +
                ' title="完成文本能力试炼后可精修,名额等于文本能力点数"' +
                ' onclick="refinePaper(\'' + p.key + '\')">精修</button>' +
                '</div>';

            }

        }

    }else if(rowBlocked){

        // 同一行只能获取一个:本行已选择其它升级
        html +=
        '<div class="paper-row-lock">本行已选择其它升级,<br>重置本行后可改选</div>' +
        '<button class="assistant-btn paper-buy" disabled>编写</button>';

    }else if(typeof trialPaperBlocked === "function"
        && trialPaperBlocked(p.key)){

        // 文本能力试炼:论文升级数量已用满
        html +=
        '<div class="paper-trial-lock">' +
        '文本试炼中,论文升级数量已用满' +
        '</div>' +
        '<button class="assistant-btn paper-buy" disabled>编写</button>';

    }else{

        html +=
        '<button class="assistant-btn paper-buy"' +
        ' data-paper="' + p.key + '"' +
        ' onclick="buyPaper(\'' + p.key + '\')">' +
        '编写' +
        '</button>';

    }

    html += '</div>';

    return html;

}


// 生成一行论文升级的 HTML(同行居中排列;行内可带重置按钮)
// data-paper-row 供 CSS 针对不同行微调(如第4行方块较多需更窄)
function paperRowHTML(row){

    let list =
    papersInRow(row);

    let html =
    '<div class="paper-row" data-paper-row="' + row + '">';

    // 升级方块(同行居中)
    html +=
    '<div class="paper-row-items">';

    for(let i = 0; i < list.length; i++)
        html += paperCardHTML(list[i]);

    html += '</div>';

    // 行重置按钮(右侧):退还本行花费的灵感并触发研究重置
    if(rowResettable(row)){

        let any =
        false;

        for(let i = 0; i < list.length; i++){

            if(paperOwned(list[i].key))
                any = true;

        }

        html +=
        '<div class="paper-row-reset">' +
        '<button class="paper-reset-btn"' +
        ' data-paper-reset="' + row + '"' +
        (any ? '' : ' disabled') +
        ' onclick="resetPaperRow(' + row + ')">' +
        '重置本行' +
        '</button>' +
        '<div class="paper-reset-hint">退还本行升级花费的灵感,<br>并进行一次研究重置</div>' +
        '</div>';

    }

    html += '</div>';

    return html;

}


// 生成前沿领域面板 HTML
function buildFrontierHTML(){

    if(!frontierUnlocked())
        return "";

    let active =
    frontierActive();

    let html = "";

    html +=
    '<p class="research-hint">' +
    '在前沿领域中,大部分理论不再适用,但你能获得和知识等量的灵感。' +
    '灵感可用于编写论文,换取各种加成。' +
    '</p>';

    // 灵感(不在前沿领域时不增长;「思如泉涌」生效时照常增长)
    // 综合能力试炼中无法获得灵感 → 直接说明原因
    let inspBlocked =
    (typeof comprehensiveInspirationBlocked === "function")
    && comprehensiveInspirationBlocked();

    html +=
    '<div class="fr-res">灵感:<span class="fr-insp">0</span>' +
    (inspBlocked
        ? '<span class="fr-rate-wrap">(试炼中无法获得灵感)</span>'
        : ((active || ideaSpringActive())
            ? '<span class="fr-rate-wrap">(+<span class="fr-rate">0</span>/秒)</span>'
            : '<span class="fr-rate-wrap">(仅在前沿领域中增长)</span>')) +
    '</div>';

    // 知识边界
    html +=
    '<div class="fr-res">知识边界:<span class="fr-boundary">0</span> /s' +
    (summaryUnlocked()
        ? '<span class="fr-rate-wrap">(摘要 ×<span class="fr-boundary-mult">1</span>)</span>'
        : '') +
    '</div>';

    if(active){
        html +=
        '<p class="fr-warn">' +
        '理论2~5 在此失效,只有基础理论有效。' +
        '</p>';
    }

    // 进入 / 退出按钮
    html +=
    '<button class="fr-toggle-btn' + (active ? " active" : "") +
    '" onclick="toggleFrontier()">' +
    (active ? "退出前沿领域" : "进入前沿领域") +
    '</button>';

    html +=
    '<p class="research-hint">' +
    '进入与退出都会进行一次研究重置;想法不足 12 时只重置,不获得行动点,' +
    '也不计入研究重置次数与最快重置用时。' +
    '</p>';

    // 论文升级(按行渲染,同行居中;第3行带重置按钮)
    html +=
    '<h3>论文升级</h3>';

    // 精修进度(完成过一次文本能力试炼后才显示)
    if(typeof abilityRefineCount === "function"
        && abilityRefineCount() > 0){

        html +=
        '<div class="paper-refine-count">你已精修了 ' +
        paperRefinedCount() +
        (paperRefineUnlimited()
            ? ' 个论文升级(不限数量)'
            : ' / ' + paperRefineLimit() + ' 个论文升级') +
        '</div>';

        // 取消精修的代价(紧跟精修进度之后)
        html +=
        '<div class="paper-refine-hint">' +
        '取消精修会自动进行一次研究重置' +
        '</div>';

        // 「多元论文II」:那三个精修不占名额,数量上会对不上,单独说明
        if(paperRefinedFreeCount() > 0){

            html +=
            '<div class="paper-refine-hint">' +
            '其中 ' + paperRefinedFreeCount() +
            ' 个(多元论文提到的三个)不占用名额' +
            '</div>';

        }

    }

    // 导出 / 导入(方便调整升级组合)
    html +=
    '<div class="paper-io">' +
    '<button class="paper-io-btn" onclick="exportPapers()">导出</button>' +
    '<button class="paper-io-btn" onclick="togglePaperImport()">导入</button>' +
    '<span class="paper-io-msg" id="paperIoMsg"></span>' +
    '</div>';

    if(paperImportOpen){

        html +=
        '<div class="paper-import-box">' +
        '<div class="paper-import-hint">' +
        '格式:{xy,xy,...},x = 行,y = 该行的第几个升级(如 {11,21,31,41,51} = 每行都选第一个)。<br>' +
        '已精修的升级在末尾加 * (如 11*);精修名额不够时会跳过。<br>' +
        '导入会先重置所有可重置的行(退还灵感),再购买导入的升级,最后进行一次研究重置。' +
        '</div>' +
        '<textarea id="paperImportInput" rows="3" spellcheck="false"' +
        ' oninput="paperImportText=this.value"></textarea>' +
        '<div class="paper-import-actions">' +
        '<button class="paper-io-btn primary" onclick="importPapers()">确认导入</button>' +
        '<button class="paper-io-btn" onclick="togglePaperImport()">取消</button>' +
        '</div>' +
        '</div>';

    }

    html +=
    '<p class="research-hint paper-hint">' +
    (originUpgradeActive("allPapers")
        ? '本源升级「包罗万象」生效中:同一行的升级不再互斥。'
        : '同一行的升级只能获取一个。') +
    '此外,一些升级会额外需要一些条件才能获取,' +
    '达到需要的条件即可,不消耗相应资源。重置升级会同样进行一次研究重置。' +
    (paperRefineUnlimited()
        ? '已完成的升级可以精修,精修不消耗资源,且不再有数量限制。'
        : '已完成的升级可以精修,精修不消耗资源,只占用精修名额(由文本能力提供)。') +
    '</p>';

    // 文本能力试炼:论文升级数量上限提示
    if(typeof trialActive === "function"
        && trialActive("text")){

        html +=
        '<p class="paper-trial-hint">' +
        '文本能力试炼中:最多购买 ' + trialPaperLimit() +
        ' 个论文升级(已购买 ' + trialPaperCount() +
        ' 个),多元论文提到的三个升级与「结论」不计入数量。' +
        '</p>';

    }

    let rows =
    paperRows();

    for(let i = 0; i < rows.length; i++)
        html += paperRowHTML(rows[i]);

    // 全部重置(包括没有"重置本行"按钮的行)
    html +=
    '<div class="paper-reset-all">' +
    '<button class="paper-reset-btn" id="paperResetAllBtn"' +
    ' onclick="resetAllPapers()">重置所有论文升级</button>' +
    '<div class="paper-reset-hint">' +
    '退还全部升级花费的灵感,<br>并进行一次研究重置' +
    '</div>' +
    '</div>';

    return html;

}


// 更新面板内某个数值文本
function setFrontierVal(panel, sel, val){

    if(!panel || !panel.querySelector)
        return;

    let el =
    panel.querySelector(sel);

    if(el && el.innerText !== String(val))
        el.innerText = String(val);

}


// 绘制前沿领域(子页面标签 / 顶部提示 / 面板)
function renderFrontierPage(){

    // 子页面标签:解锁后才出现
    let tab =
    document.getElementById("frontierNavTab");

    if(tab)
        tab.style.display =
        frontierUnlocked() ? "" : "none";

    // 标题下方的"正在前沿领域中"提示
    let banner =
    document.getElementById("frontierBanner");

    if(banner)
        banner.style.display =
        frontierActive() ? "block" : "none";

    let panel =
    document.getElementById("frontierPanel");

    if(!panel)
        return;

    // 结构签名:解锁 / 激活 / 各升级完成状态
    // 注意:不能放入灵感、行动点、实验次数等实时数值,否则会每帧重建
    let keyParts = [
        frontierUnlocked() ? 1 : 0,
        frontierActive() ? 1 : 0,
        // 导入窗口的展开状态(打开/关闭需要重建 DOM)
        paperImportOpen ? 1 : 0,
        // 文本能力试炼的论文数量上限(变了要重建卡片上的提示)
        (typeof trialActive === "function"
            && trialActive("text"))
            ? trialPaperLimit() : -1,
        // 精修名额(文本能力点数;变了要重建精修按钮的可用状态)
        paperRefineLimit(),
        // 影响"互斥 / 精修名额"规则的本源升级
        // (在本源页买完后必须重建,否则卡片上的锁定状态与说明会留在旧样子)
        (typeof originUpgradeActive === "function"
            && originUpgradeActive("multiPaper")) ? 1 : 0,
        (typeof originUpgradeActive === "function"
            && originUpgradeActive("allPapers")) ? 1 : 0,
        (typeof originUpgradeActive === "function"
            && originUpgradeActive("multiPaperII")) ? 1 : 0,
        // 「包罗万象II」:精修不再限数量(要重建按钮与进度文案)
        (typeof originUpgradeActive === "function"
            && originUpgradeActive("allPapersII")) ? 1 : 0,
        // 「思如泉涌」:不在前沿领域也产灵感(要重建灵感那一行)
        (typeof originUpgradeActive === "function"
            && originUpgradeActive("ideaSpring")) ? 1 : 0,
        // 综合能力试炼:灵感停止增长(要重建灵感那一行)
        (typeof comprehensiveInspirationBlocked === "function"
            && comprehensiveInspirationBlocked()) ? 1 : 0
    ];

    for(let i = 0;
        i < FRONTIER_CONFIG.papers.length;
        i++){

        // 1 = 已完成,2 = 已精修(精修会换描述,必须重建)
        keyParts.push(
            (paperOwned(FRONTIER_CONFIG.papers[i].key) ? 1 : 0)
            + (paperRefineActive(FRONTIER_CONFIG.papers[i].key) ? 2 : 0)
        );

    }

    let key =
    keyParts.join(":");

    // 结构变化 → 重建(按钮用 onclick 内联,无需重新绑定)
    if(key !== lastFrontierKey){

        lastFrontierKey = key;

        let html =
        buildFrontierHTML();

        if(panel.innerHTML !== html)
            panel.innerHTML = html;

        // 重建后把导入窗口的输入内容与提示文本补回去
        // (textarea 的值不能写进 HTML,否则会被当成标签解析)
        let importInput =
        panel.querySelector
        ? panel.querySelector("#paperImportInput")
        : null;

        if(importInput)
            importInput.value = paperImportText;

        let ioMsg =
        panel.querySelector
        ? panel.querySelector("#paperIoMsg")
        : null;

        if(ioMsg)
            ioMsg.innerText = paperIoMessage;

    }

    // 数值更新
    setFrontierVal(panel, ".fr-insp", format(frontierInspiration()));
    setFrontierVal(panel, ".fr-boundary", format(knowledgeLimit()));

    if(frontierActive() || ideaSpringActive())
        setFrontierVal(panel, ".fr-rate", format(frontierInspirationRate()));

    if(summaryUnlocked())
        setFrontierVal(panel, ".fr-boundary-mult", format(summaryBoundaryBonus()));

    // 按钮状态:灵感不足 / 条件未达成 → 禁用
    // (灵感/行动点/实验次数都是实时数值,所以在这里逐帧刷新而不是重建 DOM)
    if(panel.querySelectorAll){

        let btns =
        panel.querySelectorAll(".paper-buy");

        for(let i = 0; i < btns.length; i++){

            let btn =
            btns[i];

            let pkey =
            (btn.dataset && btn.dataset.paper)
            ? btn.dataset.paper
            : null;

            if(!pkey)
                continue;

            let conf =
            paperConfig(pkey);

            if(conf)
                btn.disabled =
                !paperBuyState(conf).ok;

        }

        // 行重置按钮:该行有已购买升级时才可点
        let resets =
        panel.querySelectorAll(".paper-reset-btn");

        for(let i = 0; i < resets.length; i++){

            let btn =
            resets[i];

            let row =
            Number(btn.dataset.paperReset);

            let list =
            papersInRow(row);

            let any =
            false;

            for(let j = 0; j < list.length; j++){

                if(paperOwned(list[j].key))
                    any = true;

            }

            btn.disabled = !any;

        }

        // 全部重置按钮:有任何已购买升级时才可点
        let allBtn =
        panel.querySelector("#paperResetAllBtn");

        if(allBtn)
            allBtn.disabled = !anyPaperOwned();

        // 条件进度文本(行动点 / 实验次数会实时变化)
        let reqs =
        panel.querySelectorAll(".paper-req");

        for(let i = 0; i < reqs.length; i++){

            let el =
            reqs[i];

            let pkey =
            (el.dataset && el.dataset.paperReq)
            ? el.dataset.paperReq
            : null;

            if(!pkey)
                continue;

            let conf =
            paperConfig(pkey);

            if(!conf || !conf.require)
                continue;

            let met =
            paperRequireMet(conf);

            el.className =
            "paper-req" + (met ? " met" : "");

            el.innerText =
            paperRequireText(conf) + (met ? "(已满足)" : "");

        }

        // 升级提供的加成倍数(灵感 / 元-力量 / 实验次数都是实时数值)
        let mults =
        panel.querySelectorAll(".paper-mult");

        for(let i = 0; i < mults.length; i++){

            let el =
            mults[i];

            let pkey =
            (el.dataset && el.dataset.paperMult)
            ? el.dataset.paperMult
            : null;

            if(!pkey)
                continue;

            let txt =
            paperMultText(pkey);

            if(el.innerText !== txt)
                el.innerText = txt;

        }

    }

}
