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
            desc: "基于灵感,提高知识边界(知识边界 × sqrt(1+灵感))"
        },
        {
            key: "intro",
            name: "引言",
            row: 2,
            cost: new Decimal("1e50"),
            desc: "解锁新的元-力量效果"
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
            desc: "元-力量的第二个效果提升(取 2 + 0.02·ln(MetaPower+1)² 与原值的较大值)"
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
            desc: "基于实验完成次数总和,提升所有实验助手的速度"
        },
        {
            key: "innovation",
            name: "理论部分-注重创新",
            row: 3,
            cost: new Decimal("1e135"),
            desc: "灵感提升知识获取"
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
            desc: "实验1的首次完成效果变为2倍(其中的额外加成部分 ×2)"
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
            desc: "实验2的首次完成效果变为2倍(其中的额外加成部分 ×2)"
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
            desc: "实验3的首次完成效果变为2倍(其中的额外加成部分 ×2)"
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
            desc: "实验4的首次完成效果变为2倍(其中的额外加成部分 ×2)"
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
            desc: "解锁下一个层级(暂未实装)"
        },
        {
            key: "refLegacyTheory",
            name: "参考文献-引用旧理论",
            row: 6,
            resetRow: true,
            cost: new Decimal("1e580"),
            desc: "理论1~5对知识的加成提高到 1.1 次方"
        },
        {
            key: "refTheory6",
            name: "参考文献-引用理论6",
            row: 6,
            cost: new Decimal("1e580"),
            desc: "理论6对知识的加成提高到 1.3 次方"
        },
        {
            key: "refExperiment",
            name: "参考文献-引用实验成果",
            row: 6,
            cost: new Decimal("1e580"),
            desc: "行动点获取公式的指数由 0.05 提升到 0.06"
        }
    ]
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


// 某个升级是否因"同行已选其它升级"而被锁定
// (自身已购买不算被锁定;同行无选中项也不算)
function paperRowBlocked(p){

    if(!p)
        return false;

    if(paperOwned(p.key))
        return false;

    return rowOwnedPaper(p.row || 1) !== null;

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
        return paperRequireCurrent(r) >= r.value;

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
        return 0;

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


// 灵感获取速率(= 知识获取速率;不在前沿领域时为 0)
function frontierInspirationRate(){

    if(!frontierActive())
        return new Decimal(0);

    return getKnowledgeSpeed();

}


// 每 tick 累计灵感(仅前沿领域中)
function updateFrontier(dt){

    if(!frontierActive())
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
function experimentOrientedBonus(){

    if(!paperOwned("experimentOriented"))
        return new Decimal(1);

    return Decimal.pow(
        new Decimal(1).add(totalExpCompletions()),
        0.2
    );

}


// "注重创新":知识获取 ×(1 + 灵感)^(1/4)
// 灵感取当前值(动态);未购买为 ×1
function innovationBonus(){

    if(!paperOwned("innovation"))
        return new Decimal(1);

    return Decimal.pow(
        new Decimal(1).add(frontierInspiration()),
        1/4
    );

}


// "实验部分-参考实验N"(第4行):该实验"首次完成效果"中的
// 额外加成部分 ×2。未购买返回 1(不放大)。
// 作用点:
//   N=1 元-力量效果1 指数(exp1Exponent)
//   N=2 元-力量随想法加成底数(exp2Base)
//   N=3 想法价格膨胀延后(exp3Effect)
//   N=4 理论价格膨胀延后(exp4Effect)
// 注:多次完成加成不属于"首次完成效果",不受本倍率影响
function refExpMultiplier(n){

    if(typeof paperOwned !== "function")
        return 1;

    return paperOwned("refExp" + n) ? 2 : 1;

}


// ------------------------------------------------------------
// "参考文献"系列(第6行,三选一)
// ------------------------------------------------------------

// "参考文献-引用旧理论":理论1~5 的乘积指数 1 → 1.1
// (知识产量 = base × 各理论乘积,其中理论1~5 的项 ^1.1)
// 作用点:theories.js 的 theoryPowerProduct()
function refLegacyTheoryExponent(){

    if(typeof paperOwned !== "function")
        return 1;

    return paperOwned("refLegacyTheory") ? 1.1 : 1;

}


// "参考文献-引用理论6":理论6 的乘积指数 1 → 1.3
// 作用点:theories.js 的 theoryPowerProduct()
function refTheory6Exponent(){

    if(typeof paperOwned !== "function")
        return 1;

    return paperOwned("refTheory6") ? 1.3 : 1;

}


// "参考文献-引用实验成果":行动点公式指数 0.05 → 0.06
// 作用点:research.js 的 actionPointsGain()
function researchActionExp(){

    if(typeof paperOwned !== "function"
        || !paperOwned("refExperiment"))
        return RESEARCH_CONFIG.actionExp;

    return RESEARCH_CONFIG.actionExpRef;

}


// ============================================================
// 各升级当前提供的加成倍数(卡片内显示,只显示数值不显示公式)
// 这些值随灵感/元-力量/实验次数实时变化,必须走逐帧刷新,不能进结构签名
// ============================================================

function paperMultText(key){

    if(key === "legacyTheory")
        return "当前升级倍率:×" + format(metaUpgradeRate());

    if(key === "experimentOriented")
        return "当前加成:×" + format(experimentOrientedBonus());

    if(key === "innovation")
        return "当前加成:×" + format(innovationBonus());

    // "参考文献-引用旧理论":(Π理论1~5)^1.1 ÷ (Π理论1~5) = (Π理论1~5)^0.1
    if(key === "refLegacyTheory")
        return "当前加成:×" + format(theoryProductLegacy().pow(0.1));

    // "参考文献-引用理论6":(理论6)^1.3 ÷ 理论6 = (理论6)^0.3
    if(key === "refTheory6")
        return "当前加成:×" + format(theoryProduct6().pow(0.3));

    // "参考文献-引用实验成果":指数提升不是倍数,直接显示指数
    if(key === "refExperiment")
        return "当前公式指数:^" + RESEARCH_CONFIG.actionExpRef;

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


// 摘要对知识边界的加成倍率 = sqrt(1 + 灵感);未购买为 ×1
function summaryBoundaryBonus(){

    if(!summaryUnlocked())
        return new Decimal(1);

    return new Decimal(1)
    .add(frontierInspiration())
    .sqrt();

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

    if(frontierInspiration().lt(conf.cost))
        return "noinspiration";

    game.inspiration =
    frontierInspiration().sub(conf.cost);

    game[key + "Unlocked"] = true;

    saveGame();

    renderFrontierPage();

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
function resetPaperRow(row){

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

    }

    if(!any)
        return new Decimal(0);

    game.inspiration =
    frontierInspiration().add(refund);

    saveGame();

    // 与研究重置一致(含前沿领域进出的计入规则)
    frontierReset();

    renderFrontierPage();

    return refund;

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

    let rowBlocked =
    paperRowBlocked(p);

    let reqMet =
    paperRequireMet(p);

    let reqLabel =
    paperRequireLabel(p);

    let html =
    '<div class="paper-card'
    + (owned ? " owned" : " locked")
    + (rowBlocked ? " row-blocked" : "")
    + '" data-paper-card="' + p.key + '">' +
    '<div class="paper-name">' + p.name + '</div>' +
    '<div class="paper-desc">' + p.desc + '</div>' +
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

    }else if(rowBlocked){

        // 同一行只能获取一个:本行已选择其它升级
        html +=
        '<div class="paper-row-lock">本行已选择其它升级,<br>重置本行后可改选</div>' +
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

    // 灵感(不在前沿领域时不增长)
    html +=
    '<div class="fr-res">灵感:<span class="fr-insp">0</span>' +
    (active
        ? '<span class="fr-rate-wrap">(+<span class="fr-rate">0</span>/秒)</span>'
        : '<span class="fr-rate-wrap">(仅在前沿领域中增长)</span>') +
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

    html +=
    '<p class="research-hint paper-hint">' +
    '同一行的升级只能获取一个。此外,一些升级会额外需要一些条件才能获取,' +
    '达到需要的条件即可,不消耗相应资源。重置升级会同样进行一次研究重置。' +
    '</p>';

    let rows =
    paperRows();

    for(let i = 0; i < rows.length; i++)
        html += paperRowHTML(rows[i]);

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
        frontierActive() ? 1 : 0
    ];

    for(let i = 0;
        i < FRONTIER_CONFIG.papers.length;
        i++){

        keyParts.push(
            paperOwned(
                FRONTIER_CONFIG.papers[i].key
            ) ? 1 : 0
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

    }

    // 数值更新
    setFrontierVal(panel, ".fr-insp", format(frontierInspiration()));
    setFrontierVal(panel, ".fr-boundary", format(knowledgeLimit()));

    if(frontierActive())
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
