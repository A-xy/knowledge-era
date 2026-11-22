// ============================================================
// 能力试炼(本源页第四个子页)
//
// 解锁:购买本源升级「自我提升」(originUpgradeActive("selfImprove"))
// 玩法:每个能力有对应的试炼,试炼是一次"更难的研究":
//   进入 / 退出试炼都会自动进行一次本源重置(applyOriginReset)
//     - 满足本源重置的条件(持有论文「结论」)→ 正常获得本源与完成次数
//     - 不满足 → 只重置进度,不获得本源,也不计入次数
//   在试炼中达到目标行动点即可完成,每完成一次获得 1 点该能力(最多 5 次)
//   能力带来的加成本身在对应的试炼中失效
//
// 目标行动点:ABILITY_CONFIG.targets 按"第几次试炼"分开配置,
//   目前全部为 Infinity(等测试之后再定具体数值)。
// ============================================================

const ABILITY_CONFIG = {

    // 每个能力最多完成 5 次(每次 +1 点该能力)
    maxLevel: 5,

    // 文本试炼的论文升级数量上限 = textPaperBase - 文本能力(至少 0)
    textPaperBase: 4,

    // 文本试炼中不计入数量的论文升级
    //   = 本源升级「多元论文」提到的那三个 + 「结论」
    //     (结论是本源层的入口,不该占试炼的名额)
    freePaperKeys: [
        "experimentOriented",
        "refExp3",
        "refExperiment",
        "conclusion"
    ],

    // 进入文本试炼时不会被清掉的论文升级
    // 「结论」一旦被清空,整个本源层就断了(而且试炼不退还灵感),
    // 所以它既不计入数量,也不参与这次清空
    // 包括不计入数量的升级也不需要清空
    trialKeepKeys: [
	"experimentOriented",
        "refExp3",
        "refExperiment",
        "conclusion"
    ],

    // 完成试炼时是否再额外进行一次本源重置
    // (规则里只写了"进入和退出"会重置,所以完成时默认不再重置)
    completeResets: false,

    // 抗压试炼的时限(游戏时间,秒);0 = 不限时
    compressTimeLimit: 300,

    // 细心试炼:至多可进行的research重置次数 = scale × (offset - 细心)
    carefulResetScale: 3,
    carefulResetOffset: 4,

    // 细心:行动点公式指数 +carefulActionExp × 细心
    carefulActionExp: 0.005,

    // 领导力试炼:升级一个助手后,其它助手效率 ÷(leadershipPenaltyBase + 领导力)
    leadershipPenaltyBase: 2,

    // 综合能力试炼(成就「全能」解锁):
    //   只有理论 1 可用 / 无法升级自动实验助手 / 无法获得灵感
    comprehensiveTheoryLimit: 1,

    // 成就「全能」要求完成的试炼(= 综合能力以外的前 6 个)
    omniKeys: [
        "compress",
        "text",
        "comprehension",
        "creativity",
        "careful",
        "leadership"
    ],

    // 每次试炼的目标行动点(下标 0 = 第 1 次,一共 5 条)
    //   null / undefined / Infinity = 未设定 → 界面显示 ∞(达不到)
    //   可以写普通数字、字符串或 Decimal(例如 "1e660")
    // ⚠ 超过 1e308 的目标必须写成字符串:"1e660" 是合法的,
    //   直接写数字字面量 1e660 会被 JS 先算成 Infinity,等于没设
    targets: {
        compress: ["1e650", "1e2750", "1e3550","1e5150" , "1e45000"],
        text: ["1e650", "1e1850","1e2000" , "1e2000", "1e4800"],
        comprehension: ["1e3500", "1e4900", "1e8900", "1e44000", "1e50000"],
        creativity: ["1e4100", "1e3900", "1e10000", "1e24500", "1e25500"],
        careful: ["1e2600", "1e11000", "1e11000", "1e10500", "1e17000"],
        leadership: ["1e6150", "1e45500", "1e50000", "1e60000", "1e62000"],

        // 综合能力试炼:目标行动点待定(空数组 → 界面显示 ∞)
        comprehensive: ["1e40000",Infinity,Infinity,Infinity,Infinity]
    }

};


// 两个能力的展示文案(数值部分由函数现算,不写死)
const ABILITY_LIST = [
    {
        key: "compress",
        name: "抗压能力",
        effectText: function(lv){
            return "时光之力的效果变为 " + (lv + 1) + " 次方";
        },
        trialTitle: "抗压能力试炼",
        trialText: function(){
            return "论文提交期限将近,你需要在 5 分钟内达到目标," +
            "并且时光之力失效了。";
        }
    },

    {
        key: "text",
        name: "文本能力",
        effectText: function(lv){
            return "你可以精修 " + lv + " 个论文升级";
        },
        trialTitle: "文本能力试炼",
        trialText: function(lv){
            return "你在这篇论文的语言组织上感到困难。" +
            "你只能购买至多 " + trialPaperLimitText(lv) + " 个论文升级," +
            "但多元论文升级中提到的三个升级,以及「结论」不计入数量。" +
            "进入此试炼会重置你的所有论文升级(不计入数量的升级除外)。";
        }
    },

    {
        key: "comprehension",
        name: "理解力",
        effectText: function(lv){
            return "理论1~6的价格膨胀速度 ÷" + abilityDivisorText(lv);
        },
        trialTitle: "理解力试炼",
        trialText: function(){
            return "这个项目相关的理论难以理解。" +
            "解锁和升级所有理论花费的知识变为 3 次方。";
        }
    },

    {
        key: "creativity",
        name: "创造力",
        effectText: function(lv){
            return "想法的价格膨胀速度 ÷" + abilityDivisorText(lv);
        },
        trialTitle: "创造力试炼",
        trialText: function(lv){
            return "和这个项目相关的理论较少,你需要自己发明理论。" +
            "只有理论 1~" + creativityTheoryLimitText(lv) + " 可用。";
        }
    },

    {
        key: "careful",
        name: "细心",
        effectText: function(lv){
            return "行动点获取公式的指数 +" +
            carefulActionExpText(lv);
        },
        trialTitle: "细心试炼",
        trialText: function(lv){
            return "研究样本非常脆弱。行动点获取变为平方根," +
            "并且你最多只能进行 " + carefulResetLimitText(lv) +
            " 次研究重置(超出则无法完成试炼;" +
            "试炼中的重置不计入研究重置次数的加成)。" +
            "进入此试炼会重置你的灵感。";
        }
    },

    {
        key: "leadership",
        name: "领导力",
        effectText: function(lv){
            return "本源升级「底数提升2」的效果 ×" +
            leadershipEffectMultText(lv);
        },
        trialTitle: "领导力试炼",
        trialText: function(lv){
            return "你的实验助手之间关系不和,需要合适的领导。" +
            "升级任意一个实验助手后," +
            "其它所有实验助手的效率 ÷" +
            leadershipPenaltyDivisorText(lv) + ",可叠加。";
        }
    },

    {
        // 第 7 个试炼:前 6 个都完成 5 次(成就「全能」)后解锁
        key: "comprehensive",
        name: "综合能力",
        effectText: function(lv){
            return "每获得一点都会解锁新内容(当前 " + lv +
            " 点,暂未实装)";
        },
        trialTitle: "综合能力试炼",
        trialText: function(){
            return "最难的，也是最后的挑战！" +
            "只有理论 1 可用,并且无法升级自动实验助手。" +
            "进入此试炼会重置你的灵感,并且试炼中无法获取灵感。";
        }
    }

];


// ============================================================
// 旧存档兼容(读档 / 导入存档时各调用一次,见 save.js)
// ============================================================
function ensureAbilityCompat(){

    if(!game.abilities || typeof game.abilities !== "object")
        game.abilities = {};

    for(let i = 0; i < ABILITY_LIST.length; i++){

        let key = ABILITY_LIST[i].key;

        let lv = Number(game.abilities[key]);

        if(!isFinite(lv) || lv < 0)
            lv = 0;

        game.abilities[key] =
        Math.min(Math.floor(lv), ABILITY_CONFIG.maxLevel);

    }

    if(game.abilityTrial === undefined)
        game.abilityTrial = null;

    // 试炼的力量值失效(存档被改坏 / 能力被移除)→ 直接清掉
    if(game.abilityTrial && !abilityConf(game.abilityTrial.key))
        game.abilityTrial = null;

    // 试炼内的计数器(细心:已进行的重置次数 / 领导力:各助手的降效次数)
    if(game.abilityTrial){

        let n =
        Number(game.abilityTrial.resets) || 0;

        game.abilityTrial.resets =
        (n > 0) ? Math.floor(n) : 0;

        if(!game.abilityTrial.penalty
            || typeof game.abilityTrial.penalty !== "object")
            game.abilityTrial.penalty = {};

    }

    if(game.abilityTrialStorySeen === undefined)
        game.abilityTrialStorySeen = false;

}


// ============================================================
// 基础取值
// ============================================================

function abilityConf(key){

    for(let i = 0; i < ABILITY_LIST.length; i++){

        if(ABILITY_LIST[i].key === key)
            return ABILITY_LIST[i];

    }

    return null;

}


// 能力试炼是否已解锁(买过本源升级「自我提升」)
function abilityUnlocked(){

    return (typeof originUpgradeActive === "function")
    && originUpgradeActive("selfImprove");

}


// 能力等级 = 已完成该试炼的次数(0~5)
function abilityLevel(key){

    if(!game.abilities)
        return 0;

    let lv = Number(game.abilities[key]);

    if(!isFinite(lv) || lv < 0)
        return 0;

    return Math.min(Math.floor(lv), ABILITY_CONFIG.maxLevel);

}


function abilityMaxLevel(){
    return ABILITY_CONFIG.maxLevel;
}


// 抗压能力让时光之力的结果取几次方(公式:抗压能力 + 1)
// 未解锁 / 未完成任何试炼时是 1 → 效果不变
function abilityTimeExponent(){

    return abilityLevel("compress") + 1;

}


// 文本能力可精修的论文升级数量
// 文本试炼中该能力本身失效 → 可精修数量为 0
// (「多元论文II」放行的那三个不占名额,仍然可以精修,见 frontier.js)
function abilityRefineCount(){

    if(trialActive("text"))
        return 0;

    return abilityLevel("text");

}


// 价格膨胀的除数文案:1 + 点数×0.2(1 位小数:1.0 / 1.2 / … / 2.0)
function abilityDivisorText(lv){

    return (1 + lv * 0.2).toFixed(1);

}


// 理解力:理论价格里二次项系数 B 的除数(= 1 + 理解力×0.2)
// 理解力试炼中该能力失效 → 1
function comprehensionDivisor(){

    if(trialActive("comprehension"))
        return 1;

    return 1 + abilityLevel("comprehension") * 0.2;

}


// 创造力:想法价格里二次项系数 B 的除数(= 1 + 创造力×0.2)
// 创造力试炼中该能力失效 → 1
function creativityDivisor(){

    if(trialActive("creativity"))
        return 1;

    return 1 + abilityLevel("creativity") * 0.2;

}


// 创造力试炼中可用的理论数量 = 5 - 创造力(至少 1)
function creativityTheoryLimitText(lv){

    return Math.max(1, 5 - lv);

}


function creativityTheoryLimit(){

    return creativityTheoryLimitText(abilityLevel("creativity"));

}


// 创造力试炼中,这个编号的理论是否被禁用
function creativityTheoryBlocked(num){

    if(!trialActive("creativity"))
        return false;

    return num > creativityTheoryLimit();

}


// ============================================================
// 细心:行动点公式指数 / 试炼的重置次数上限
// ============================================================

// 行动点公式指数的加成文案(0.005 × 细心,3 位小数)
function carefulActionExpText(lv){

    return (carefulActionExp(lv)).toFixed(3);

}


function carefulActionExp(lv){

    let n =
    (lv === undefined) ? abilityLevel("careful") : lv;

    return ABILITY_CONFIG.carefulActionExp * n;

}


// 细心对行动点公式指数的加成(细心试炼中该能力失效 → 0)
function carefulActionExpBonus(){

    if(trialActive("careful"))
        return 0;

    return carefulActionExp();

}


// 细心试炼中行动点是否要开平方(所有加成算完之后)
function carefulTrialSqrt(){

    return trialActive("careful");

}


// 细心试炼允许的研究重置次数 = 3 × (4- 细心) ,最少0
function carefulResetLimitText(lv){

    return Math.max(ABILITY_CONFIG.carefulResetScale
    * (ABILITY_CONFIG.carefulResetOffset - lv),0);

}


function carefulResetLimit(){

    return carefulResetLimitText(abilityLevel("careful"));

}


// 试炼中已经进行的研究重置次数
function trialResetCount(){

    if(!game.abilityTrial)
        return 0;

    let n =
    Number(game.abilityTrial.resets) || 0;

    return n > 0 ? Math.floor(n) : 0;

}


// 细心试炼:研究重置次数是否已经"超出"上限
// 不挡重置,只挡完成 —— 次数正好等于上限仍然可以完成,超出 > 上限 则只能退出
// (用 `>` 而不是 `>=`,边界在上限之内)
function carefulResetOverLimit(){

    if(!trialActive("careful"))
        return false;

    return trialResetCount() > carefulResetLimit();

}


// 细心试炼:重置次数提示后缀(超出上限 → 无法完成;正好用完 → 已达上限)
function carefulResetHintText(){

    if(!trialActive("careful"))
        return "";

    if(carefulResetOverLimit())
        return "(已超出上限,无法完成试炼)";

    if(trialResetCount() >= carefulResetLimit())
        return "(已达上限,再重置将无法完成试炼)";

    return "";

}


// 记录一次试炼内的研究重置(由 research.js 的 recordResearchReset 调用)
function recordTrialResearchReset(){

    if(!game.abilityTrial)
        return;

    game.abilityTrial.resets =
    trialResetCount() + 1;

}


// ============================================================
// 领导力:底数提升2 的效果倍率 / 试炼的助手降效
// ============================================================

// 「底数提升2」效果的倍数文案(= 1 + 领导力)
function leadershipEffectMultText(lv){

    return (1 + lv);

}


// 「底数提升2」每级 +0.2 的效果倍数(领导力试炼中该能力失效 → 1)
function leadershipEffectMult(){

    if(trialActive("leadership"))
        return 1;

    return 1 + abilityLevel("leadership");

}


// 领导力试炼的惩罚除数文案(= 2 + 领导力)
function leadershipPenaltyDivisorText(lv){

    return ABILITY_CONFIG.leadershipPenaltyBase + lv;

}


function leadershipPenaltyDivisor(){

    return ABILITY_CONFIG.leadershipPenaltyBase
    + abilityLevel("leadership");

}


// 每个助手被降效的次数(只在领导力试炼中存在)
function leadershipPenaltyMap(){

    if(!trialActive("leadership"))
        return null;

    let t =
    game.abilityTrial;

    if(!t.penalty || typeof t.penalty !== "object")
        t.penalty = {};

    return t.penalty;

}


function leadershipPenaltyCount(key){

    let map =
    leadershipPenaltyMap();

    if(!map)
        return 0;

    let n =
    Number(map[key]) || 0;

    return n > 0 ? Math.floor(n) : 0;

}


// 这个助手因"别人被升级"而受到的效率倍率
//   = (1/(2+领导力))^次数
function leadershipAssistantPenalty(key){

    let n =
    leadershipPenaltyCount(key);

    if(n <= 0)
        return new Decimal(1);

    return Decimal.pow(
        1 / leadershipPenaltyDivisor(),
        n
    );

}


// 升级了 key 之后:其它所有实验助手的降效次数 +1
// (上限 1e6 次,避免自动提拔长期跑动把计数堆成天文数字)
const LEADERSHIP_PENALTY_CAP = 1e6;

function applyLeadershipUpgradePenalty(key){

    let map =
    leadershipPenaltyMap();

    if(!map || typeof ASSISTANT_LIST === "undefined")
        return;

    for(let i = 0; i < ASSISTANT_LIST.length; i++){

        let conf =
        ASSISTANT_LIST[i];

        if(!conf.expKey || conf.key === key)
            continue;

        let n =
        leadershipPenaltyCount(conf.key) + 1;

        map[conf.key] =
        Math.min(n, LEADERSHIP_PENALTY_CAP);

    }

}


// 本次(第 level+1 次)试炼的目标行动点
//   返回 Decimal;未设定时返回 null(界面显示 ∞,永远达不到)
// ⚠ 不能在这里用 isFinite(list[lv]) 判断:目标常常远超 1e308,
//   写数字字面量时已经是 Infinity,必须靠字符串 + Decimal 才能表达
function abilityTarget(key){

    let list =
    (ABILITY_CONFIG.targets && ABILITY_CONFIG.targets[key]) || [];

    let lv =
    abilityLevel(key);

    if(lv >= list.length)
        return null;

    let v =
    list[lv];

    if(v === null || v === undefined || v === "")
        return null;

    let target;

    try{
        target = new Decimal(v);
    }catch(e){
        return null;
    }

    if(!target.isFinite() || target.lte(0))
        return null;

    return target;

}


// 目标文本(未设定的目标显示 ∞)
function abilityTargetText(key){

    let target =
    abilityTarget(key);

    return target
    ? format(target)
    : "∞";

}


// 试炼时限(秒;0 = 不限时)
function abilityTimeLimit(key){

    return (key === "compress")
    ? ABILITY_CONFIG.compressTimeLimit
    : 0;

}


// ============================================================
// 试炼状态
// ============================================================

// 是否在试炼中(传 key 时判断是否在该能力的试炼中)
function trialActive(key){

    let t =
    game.abilityTrial;

    if(!t)
        return false;

    if(key && t.key !== key)
        return false;

    return true;

}


function trialKey(){

    return game.abilityTrial
    ? game.abilityTrial.key
    : null;

}


// 试炼开始时的游戏时间(试炼内按游戏时间计时,与实验2同口径)
function trialElapsed(){

    if(!game.abilityTrial)
        return 0;

    let start =
    Number(game.abilityTrial.startTime) || 0;

    return Math.max(0, (game.totalTime || 0) - start);

}


// 剩余时间(秒);不限时的试炼返回 Infinity
function trialRemain(key){

    let limit =
    abilityTimeLimit(key);

    if(limit <= 0)
        return Infinity;

    return Math.max(0, limit - trialElapsed());

}


function trialTimedOut(key){

    let limit =
    abilityTimeLimit(key);

    return limit > 0 && trialElapsed() >= limit;

}


// 试炼内的行动点进度:用本轮累计行动点(只增不减,花掉也不回退)
// (进入试炼时的本源重置会把它清零,所以这就是"试炼开始后攒了多少")
function trialActionPoints(){

    return game.totalResearchPoints || new Decimal(0);

}


// 是否已达到本次试炼的目标
function trialReached(key){

    let target =
    abilityTarget(key);

    if(!target)
        return false;

    return trialActionPoints().gte(target);

}


// ------------------------------------------------------------
// 试炼解锁:常规能力随「自我提升」解锁;
// 「综合能力」需要成就「全能」(前 6 个试炼各完成 5 次)
// ------------------------------------------------------------
function abilityTrialUnlocked(key){

    if(!abilityUnlocked())
        return false;

    if(key === "comprehensive"){

        return (typeof isAchievementUnlocked === "function")
        && isAchievementUnlocked("omniAbility");

    }

    return true;

}


// ------------------------------------------------------------
// 综合能力试炼的限制
// ------------------------------------------------------------

function comprehensiveTheoryLimit(){

    return ABILITY_CONFIG.comprehensiveTheoryLimit;

}


// 试炼中禁用的理论编号:
//   创造力试炼 → 超出 1~x 的理论
//   综合能力试炼 → 只留理论 1
function trialTheoryBlocked(num){

    if(trialActive("comprehensive"))
        return num > comprehensiveTheoryLimit();

    return creativityTheoryBlocked(num);

}


// 综合能力试炼:无法升级自动实验助手
// (手动升级 / 提拔员的自动升级都会被挡住)
function comprehensiveAssistantBlocked(){

    return trialActive("comprehensive");

}


// 综合能力试炼:无法获得灵感
function comprehensiveInspirationBlocked(){

    return trialActive("comprehensive");

}


// ============================================================
// 文本试炼:论文升级数量限制
// ============================================================

function trialPaperLimitText(lv){

    return Math.max(0, ABILITY_CONFIG.textPaperBase - lv);

}


// 文本试炼中允许购买的论文升级数量(按**当前**文本能力算)
function trialPaperLimit(){

    return trialPaperLimitText(abilityLevel("text"));

}


// 当前已购买、且计入试炼数量的论文升级数
// (多元论文提到的那三个不计入;升级被重置后数量自然也重置)
function trialPaperCount(){

    let n = 0;

    for(let i = 0; i < FRONTIER_CONFIG.papers.length; i++){

        let p =
        FRONTIER_CONFIG.papers[i];

        if(!paperOwned(p.key))
            continue;

        if(ABILITY_CONFIG.freePaperKeys.indexOf(p.key) >= 0)
            continue;

        n++;

    }

    return n;

}


// 文本试炼中:这个论文升级是否已被数量上限挡住
function trialPaperBlocked(key){

    if(!trialActive("text"))
        return false;

    if(ABILITY_CONFIG.freePaperKeys.indexOf(key) >= 0)
        return false;

    return trialPaperCount() >= trialPaperLimit();

}


// ============================================================
// 进入 / 退出 / 完成
// ============================================================

// 试炼触发的本源重置
//   满足条件(持有「结论」)→ 正常结算本源与完成次数
//   不满足 → 只重置进度,不获得本源,也不计入次数
function trialOriginReset(){

    return applyOriginReset(
        canOriginReset()
    );

}


function enterAbilityTrial(key){

    if(!abilityTrialUnlocked(key))
        return false;

    if(trialActive())
        return false;

    if(abilityLevel(key) >= abilityMaxLevel())
        return false;

    game.abilityTrial = {
        key: key,
        startTime: game.totalTime || 0,
        resets: 0,
        penalty: {}
    };

    // 先做本源重置(顺序很重要:持有「结论」时这次重置能正常结算本源),
    // 再补上文本试炼自己的要求 —— 论文升级必须清空(不退还灵感)。
    // 没有里程碑"保存手稿"时,本源重置本身就会清掉论文,这一步是兜底。
    // 「结论」不在清空范围内(它既不计入数量,也是本源层的入口)。
    trialOriginReset();

    if(key === "text")
        clearAllPapers(false, ABILITY_CONFIG.trialKeepKeys);

    // 细心 / 综合能力试炼:灵感一律清零(即使有"保存手稿"也会清)
    if(key === "careful" || key === "comprehensive")
        game.inspiration = new Decimal(0);

    saveGame();
    renderOriginPage();
    renderAbilityPage();

    return true;

}


function exitAbilityTrial(){

    if(!trialActive())
        return false;

    game.abilityTrial = null;

    trialOriginReset();

    saveGame();
    renderOriginPage();
    renderAbilityPage();

    return true;

}


function completeAbilityTrial(){

    if(!trialActive())
        return false;

    let key =
    trialKey();

    if(trialTimedOut(key) || !trialReached(key))
        return false;

    // 细心试炼:研究重置次数超出上限 → 不能完成(等于上限可以)
    if(carefulResetOverLimit())
        return false;

    if(abilityLevel(key) >= abilityMaxLevel())
        return false;

    game.abilities[key] =
    abilityLevel(key) + 1;

    game.abilityTrial = null;

    if(ABILITY_CONFIG.completeResets)
        trialOriginReset();

    saveGame();
    renderOriginPage();
    renderAbilityPage();

    return true;

}


// 卡片按钮:不在试炼中 → 进入;在试炼中 → 达标则完成,否则退出
function abilityTrialClick(key){

    if(trialActive(key)){

        if(!carefulResetOverLimit()
            && !trialTimedOut(key)
            && trialReached(key)
            && abilityLevel(key) < abilityMaxLevel())
            return completeAbilityTrial();

        return exitAbilityTrial();

    }

    return enterAbilityTrial(key);

}


// 按钮当前状态(文案 + 是否可点)
//   mode: "enter" | "exit" | "complete" | "locked"
function abilityButtonState(key){

    if(!abilityUnlocked())
        return { text: "需要「自我提升」", disabled: true, mode: "locked" };

    // 综合能力试炼要先完成前 6 个试炼(成就「全能」)
    if(!abilityTrialUnlocked(key))
        return { text: "需要成就「全能」", disabled: true, mode: "locked" };

    if(abilityLevel(key) >= abilityMaxLevel())
        return { text: "已完成全部试炼", disabled: true, mode: "locked" };

    if(trialActive(key)){

        // 细心试炼:重置次数超出上限后只能退出(等于上限时仍可完成)
        if(carefulResetOverLimit())
            return { text: "退出试炼", disabled: false, mode: "exit" };

        if(!trialTimedOut(key) && trialReached(key))
            return { text: "完成试炼", disabled: false, mode: "complete" };

        return { text: "退出试炼", disabled: false, mode: "exit" };

    }

    // 同一时间只能进行一个试炼
    if(trialActive())
        return { text: "其它试炼进行中", disabled: true, mode: "locked" };

    return { text: "进入试炼", disabled: false, mode: "enter" };

}


// ============================================================
// 界面
// ============================================================

// 结构签名(等级 / 试炼归属变化时才重建卡片)
let lastAbilityKey = "";


// mm:ss(不限时的返回"不限时")
function formatTrialTime(sec){

    if(!isFinite(sec))
        return "不限时";

    let s =
    Math.max(0, Math.ceil(sec));

    let m =
    Math.floor(s / 60);

    let r =
    s % 60;

    return (m < 10 ? "0" : "") + m
    + ":" + (r < 10 ? "0" : "") + r;

}


// 生成两张能力卡片
function buildAbilityCards(){

    let box =
    document.getElementById("abilityCards");

    if(!box)
        return;

    box.innerHTML = "";

    for(let i = 0; i < ABILITY_LIST.length; i++){

        let conf =
        ABILITY_LIST[i];

        let key =
        conf.key;

        // 未解锁的试炼(综合能力)不显示卡片
        if(!abilityTrialUnlocked(key))
            continue;

        let lv =
        abilityLevel(key);

        let div =
        document.createElement("div");

        div.className =
        "ability-card" + (trialActive(key) ? " active" : "");

        div.setAttribute("data-ability", key);

        // 这里是能力的点数,不写"次"
        let btnState =
        abilityButtonState(key);

        div.innerHTML =
        "<div class=\"ability-head\">" +
        "<span class=\"ability-name\">" + conf.name + "</span>" +
        "<span class=\"ability-level\">" +
        lv + " / " + abilityMaxLevel() + "</span>" +
        "</div>" +
        "<div class=\"ability-effect\">效果:" +
        "<span class=\"ability-effect-text\">" +
        conf.effectText(lv) + "</span></div>" +
        "<div class=\"ability-trial\">" +
        "<div class=\"ability-trial-title\">" + conf.trialTitle + "</div>" +
        "<div class=\"ability-trial-text\">" +
        conf.trialText(lv) + "</div>" +
        "<div class=\"ability-target\">达到 " +
        "<span class=\"ability-target-val\">" +
        abilityTargetText(key) + "</span> 行动点以完成该试炼</div>" +
        "<div class=\"ability-status\"></div>" +
        "<button class=\"ability-btn" +
        (btnState.mode === "complete" ? " ok" : "") + "\"" +
        " data-ability-btn=\"" + key + "\"" +
        (btnState.disabled ? " disabled" : "") +
        " onclick=\"abilityTrialClick('" + key + "')\">" +
        btnState.text + "</button>" +
        "</div>";

        box.appendChild(div);

    }

}


// 逐帧轻量刷新:状态行 + 按钮(目标/行动点是实时数值,不能进重建签名)
function refreshAbilityNumbers(){

    let box =
    document.getElementById("abilityCards");

    if(!box || !box.children)
        return;

    for(let i = 0; i < box.children.length; i++){

        let card =
        box.children[i];

        let key =
        card.getAttribute
        ? card.getAttribute("data-ability")
        : null;

        if(!key)
            continue;

        let active =
        trialActive(key);

        let cls =
        "ability-card" + (active ? " active" : "");

        if(card.className !== cls)
            card.className = cls;

        // ---- 状态行 ----
        let status =
        card.querySelector
        ? card.querySelector(".ability-status")
        : null;

        if(status){

            let text = "";

            if(active){

                let ap =
                format(trialActionPoints());

                let target =
                abilityTargetText(key);

                if(key === "compress"){

                    text = "试炼中 | 剩余 " +
                    formatTrialTime(trialRemain(key)) +
                    (trialTimedOut(key) ? "(已超时)" : "") +
                    " | 行动点 " + ap + " / " + target;

                }else if(key === "text"){

                    text = "试炼中 | 已购买论文升级 " +
                    trialPaperCount() + " / " + trialPaperLimit() +
                    " | 行动点 " + ap + " / " + target;

                }else if(key === "creativity"){

                    text = "试炼中 | 可用理论 1~" +
                    creativityTheoryLimit() +
                    " | 行动点 " + ap + " / " + target;

                }else if(key === "careful"){

                    text = "试炼中 | 已进行 " +
                    trialResetCount() + " / " + carefulResetLimit() +
                    " 次研究重置" +
                    carefulResetHintText() +
                    " | 行动点 " + ap + " / " + target;

                }else if(key === "comprehensive"){

                    text = "试炼中 | 可用理论 1 | 灵感 0" +
                    "(试炼中无法获取)" +
                    " | 行动点 " + ap + " / " + target;

                }else{

                    text = "试炼中 | 行动点 " + ap + " / " + target;

                }

            }

            if(status.innerText !== text)
                status.innerText = text;

        }

        // ---- 按钮 ----
        let btn =
        card.querySelector
        ? card.querySelector(".ability-btn")
        : null;

        if(!btn)
            continue;

        let state =
        abilityButtonState(key);

        if(btn.innerText !== state.text)
            btn.innerText = state.text;

        if(btn.disabled !== state.disabled)
            btn.disabled = state.disabled;

        let btnCls =
        "ability-btn" + (state.mode === "complete" ? " ok" : "");

        if(btn.className !== btnCls)
            btn.className = btnCls;

    }

}


// 游戏界面顶部的试炼提示(标签栏上方,"知识纪元"下方,与前沿领域提示同位)
function renderTrialBanner(){

    let el =
    document.getElementById("trialBanner");

    if(!el)
        return;

    if(!trialActive() || !abilityUnlocked()){

        if(el.style.display !== "none")
            el.style.display = "none";

        return;

    }

    let key =
    trialKey();

    // 提示里的名字与试炼本身一致(卡片上的标题)
    let conf =
    abilityConf(key);

    let name =
    conf ? conf.trialTitle : "能力试炼";

    let text;

    if(key === "compress"){

        text = name + ":剩余 " +
        formatTrialTime(trialRemain(key)) +
        (trialTimedOut(key) ? "(已超时)" : "") +
        " | 目标 " + abilityTargetText(key) + " 行动点";

    }else if(key === "text"){

        text = name + ":已购买论文升级 " +
        trialPaperCount() + " / " + trialPaperLimit();

    }else if(key === "creativity"){

        text = name + ":可用理论 1~" +
        creativityTheoryLimit() +
        " | 目标 " + abilityTargetText(key) + " 行动点";

    }else if(key === "careful"){

        text = name + ":已进行 " +
        trialResetCount() + " / " + carefulResetLimit() +
        " 次研究重置" +
        carefulResetHintText() +
        " | 目标 " + abilityTargetText(key) + " 行动点";

    }else if(key === "comprehensive"){

        text = name + ":可用理论 1 | 无法升级自动实验助手 | 无法获取灵感" +
        " | 目标 " + abilityTargetText(key) + " 行动点";

    }else{

        text = name + ":目标 " +
        abilityTargetText(key) + " 行动点";

    }

    if(el.style.display !== "block")
        el.style.display = "block";

    if(el.innerText !== text)
        el.innerText = text;

}


// 绘制能力试炼页(本源页第四子页)
function renderAbilityPage(){

    // 顶部提示(不依赖本源页是否打开)
    renderTrialBanner();

    let page =
    document.getElementById("originAbilityPage");

    if(!page)
        return;

    if(!abilityUnlocked())
        return;

    let key = [
        abilityLevel("compress"),
        abilityLevel("text"),
        abilityLevel("comprehension"),
        abilityLevel("creativity"),
        abilityLevel("careful"),
        abilityLevel("leadership"),
        abilityLevel("comprehensive"),
        // 综合能力试炼要靠成就「全能」解锁:解锁后要把卡片补上
        abilityTrialUnlocked("comprehensive") ? 1 : 0,
        trialKey() || "-"
    ].join(":");

    if(key !== lastAbilityKey){

        lastAbilityKey = key;

        buildAbilityCards();

    }

    refreshAbilityNumbers();

}
