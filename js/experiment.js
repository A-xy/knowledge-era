// ============================================================
// 实验系统(Experiments)
// 特色玩法:消耗行动点进行交互。
// 实验1:非线性元件测量
//   目标元件的伏安特性函数 I=f(U) 单调递增(玩家未知):
//     f(U) = a*U + b*U^2 + c*(e^U - 1),a,b,c ∈ [0.3,1]
//     U 单位 V,I 单位 mA
//   目标:找到 I=1mA 时对应的电压 U_0(0~1V 内)
//   提交结果的偏差 < 0.005V 后完成实验。
//   测量值带有高斯误差;可通过升级设备降低误差。
//   加成:按最佳提交偏差,把元-力量对理论力量的加成指数化。
//   "无"档(含未提交)提供 ^1.1 保底指数。
// 实验2:信号周期测量(实验1 完成后解锁)
//   一个周期未知的正弦波信号 s(t)=A*sin(2πt/T+φ),参数玩家未知:
//     A ∈ [1,2],φ ∈ [0,2π],T ∈ [60,120] 秒
//   目标:通过测量不同时刻 t 的信号值,得到周期 T。
//   提交结果的偏差 < 0.5s 后完成实验。
//   t 为解锁实验2以来的游戏时间(不可选择),测量值带高斯误差。
//   本实验的测量/提交/升级 AP 消耗均为实验1 的 5 倍。
//   加成:按最佳提交偏差,把元-力量获取的底数从 2 提升为 Base
//     (0.1 * Base^(想法数-1)),Base ∈ [2.2, 3.0]。
// ============================================================


// ============================================================
// 实验1 配置
// ============================================================
const EXPERIMENT1 = {
    name: "非线性元件测量",
    targetI: 1,             // 目标电流 I=1mA
    // 设备精度
    initErr: 0.05,          // 初始相对误差 5%
    minErr: 0.001,          // 最低相对误差 0.1%
    upgradeCostBase: 5,     // 初始升级价格(行动点)
    upgradeCostMul: 2,      // 每次升级价格翻倍
    maxUpgrades: 6,         // 最多升级次数
    // 完成判定
    completeThreshold: 0.005 // 偏差 < 0.005V 完成
};


// ============================================================
// 实验2 配置
// ============================================================
const EXPERIMENT2 = {
    name: "信号周期测量",
    // 正弦波参数范围(生成时随机)
    ampMin: 1,              // 振幅下限
    ampMax: 2,              // 振幅上限
    phaseMin: 0,            // 相位下限
    phaseMax: 2 * Math.PI,  // 相位上限
    periodMin: 60,          // 周期下限(秒)
    periodMax: 120,         // 周期上限(秒)
    // 设备精度(机制同实验1)
    initErr: 0.05,          // 初始相对误差 5%
    minErr: 0.001,          // 最低相对误差 0.1%
    upgradeCostBase: 25,    // 初始升级价格(行动点,实验1 的 5 倍)
    upgradeCostMul: 2,      // 每次升级价格翻倍
    maxUpgrades: 6,         // 最多升级次数
    // AP 消耗(实验1 的 5 倍)
    measureAP: 5,           // 测量消耗
    submitAP: 5,            // 提交消耗
    // 完成判定
    completeThreshold: 0.5  // 偏差 < 0.5s 完成
};


// ============================================================
// 实验3 配置
// ============================================================
const EXPERIMENT3 = {
    name: "深度学习算法",
    // 损失函数 L(x,y) = c1*(x-a)^2 + c2*(y-b)^2 + c3*(x-a)*(y-b)
    // 最小值点在 (a,b);系数保证海森矩阵正定(唯一最小值)
    // c1,c2 ∈ [cMin,cMax],c3 ∈ [-c3Max,c3Max]
    // 正定条件:4*c1*c2 - c3^2 > 0(取 c1,c2 ≥ 0.5,|c3| ≤ 0.8 恒成立)
    cMin: 0.5,
    cMax: 1.5,
    c3Max: 0.8,
    lossAP: 1000,           // 每次查询损失函数消耗行动点
    // 完成判定
    completeThreshold: 0.01 // 到答案的欧氏距离 < 0.01 完成
};


// 生成实验3(实验2 完成后首次进入实验页时调用,并存档)
function initExperiment3(){

    // 前置条件:实验2 已完成(实验3 由研究阶段2 解锁)
    if(!game.experiments || !game.experiments.exp2)
        return;

    if(!game.experiments.exp2.completed)
        return;

    // 已有则跳过
    if(game.experiments.exp3)
        return;

    // 随机最小值位置 a,b ∈ [0.2, 0.8](避免太靠边,玩家容易找到)
    let a = 0.2 + Math.random() * 0.6;
    let b = 0.2 + Math.random() * 0.6;

    // 随机系数(保证正定:4*c1*c2 - c3^2 > 0)
    let c1 = EXPERIMENT3.cMin + Math.random() * (EXPERIMENT3.cMax - EXPERIMENT3.cMin);
    let c2 = EXPERIMENT3.cMin + Math.random() * (EXPERIMENT3.cMax - EXPERIMENT3.cMin);
    let c3 = (Math.random() * 2 - 1) * EXPERIMENT3.c3Max;

    game.experiments.exp3 = {
        a: a,               // 答案 x(玩家未知)
        b: b,               // 答案 y(玩家未知)
        c1: c1,             // 损失函数系数(玩家未知)
        c2: c2,
        c3: c3,
        completed: false,
        measurements: [],   // [{x, y, loss}]
        bestResult: null,   // {x, y, distance}
        bestEver: null,     // 历史最佳(重新开始不重置)
        operationCount: 0,  // 本次实验操作数(查询)
        completions: 0,     // 完成次数
        bestOperations: null,// 最少操作次数
        restarted: false    // 是否重新开始过
    };

    saveGame();

}


// 兼容旧存档:实验3 若缺少系数(旧版无 c1/c2/c3),补默认(退化为圆对称二次型)
function ensureExp3Coeffs(){

    let e =
    game.experiments.exp3;

    if(!e)
        return;

    if(e.c1 === undefined)
        e.c1 = 1;

    if(e.c2 === undefined)
        e.c2 = 1;

    if(e.c3 === undefined)
        e.c3 = 0;

}


// 损失函数 L(x,y) = c1*(x-a)^2 + c2*(y-b)^2 + c3*(x-a)*(y-b)
// 无误差,直接返回真实值
function exp3Loss(x, y){

    let e =
    game.experiments.exp3;

    let dx = x - e.a;
    let dy = y - e.b;

    return e.c1 * dx * dx
    + e.c2 * dy * dy
    + e.c3 * dx * dy;

}


// ============================================================
// 实验4 配置
// ============================================================
const EXPERIMENT4 = {
    name: "DNA测序",
    seqLen: 10,             // 序列长度
    bases: ["A","T","C","G"],
    initFragLen: 2,         // 初始测得片段长度
    measureAP: 1e5,         // 测序消耗
    submitAP: 1e5,          // 提交消耗
    upgradeBase: 5e5,       // 升级基础价格(AP)
    upgradeMul: 2,          // 每次升级价格翻倍
    maxFragLen: 6,          // 片段长度上限(升级到6封顶)
    fragBonus: 1            // 每升级一次片段长度 +1
};


// 生成实验4(实验3 完成后首次进入实验页时调用,并存档)
function initExperiment4(){

    // 前置条件:实验3 已完成
    if(!game.experiments || !game.experiments.exp3)
        return;

    if(!game.experiments.exp3.completed)
        return;

    // 已有则跳过
    if(game.experiments.exp4)
        return;

    // 随机生成 10 位 DNA 序列
    let seq = "";

    for(let i = 0; i < EXPERIMENT4.seqLen; i++){

        seq += EXPERIMENT4.bases[
            Math.floor(Math.random() * EXPERIMENT4.bases.length)
        ];

    }

    game.experiments.exp4 = {
        seq: seq,               // 答案序列(玩家未知)
        completed: false,
        upgrades: 0,            // 设备升级次数
        measuredFrags: [],      // 已测片段记录 [{frag, len}]
        bestLength: 0,          // 复原的最长连续片段长度
        bestFragment: "",       // 复原的最长连续片段内容
        bestEver: null,         // 历史最佳 {length, fragment}(重新开始不重置)
        operationCount: 0,      // 本次实验操作数(测序+提交)
        completions: 0,         // 完成次数
        bestOperations: null,   // 最少操作次数
        restarted: false        // 是否重新开始过
    };

    saveGame();

}


// 当前片段长度(初始2,每次升级 +1,最大10)
function exp4FragLen(){

    let e =
    game.experiments.exp4;

    return Math.min(
        EXPERIMENT4.initFragLen
        + e.upgrades * EXPERIMENT4.fragBonus,
        EXPERIMENT4.maxFragLen
    );

}


// 当前升级价格(每次翻倍;满级返回 null)
function exp4UpgradeCost(){

    let e =
    game.experiments.exp4;

    if(exp4FragLen() >= EXPERIMENT4.maxFragLen)
        return null;

    return EXPERIMENT4.upgradeBase
    * Math.pow(
        EXPERIMENT4.upgradeMul,
        e.upgrades
    );

}


// 测序:随机取一个位置的连续片段(位置未知,只显示内容)
// 保底机制:优先选取与之前测得的不重复的片段(如果有)
// 消耗 measureAP
function exp4Measure(){

    let e =
    game.experiments.exp4;

    if(!e)
        return "notUnlocked";

    // 行动点校验
    if(game.actionPoints.lt(EXPERIMENT4.measureAP))
        return "noAP";

    game.actionPoints =
    game.actionPoints.sub(
        EXPERIMENT4.measureAP
    );

    let len =
    exp4FragLen();

    // 收集所有长度为 len 的连续片段(带位置)
    let allFrags = [];

    for(let i = 0; i <= e.seq.length - len; i++){

        allFrags.push({
            pos: i,
            frag: e.seq.substr(i, len)
        });

    }

    // 已测过的片段内容集合
    let seenSet = {};

    for(let i = 0; i < e.measuredFrags.length; i++){
        seenSet[e.measuredFrags[i].frag] = true;
    }

    // 未测过的片段
    let unseen = [];

    for(let i = 0; i < allFrags.length; i++){

        if(!seenSet[allFrags[i].frag])
            unseen.push(allFrags[i]);

    }

    // 保底:优先从未测过的中选;没有则随机全部
    let pool =
    unseen.length > 0 ? unseen : allFrags;

    let pick =
    pool[Math.floor(Math.random() * pool.length)];

    // 记录
    e.measuredFrags.push({
        frag: pick.frag,
        len: len
    });

    // 只保留最近 100 条
    if(e.measuredFrags.length > 100)
        e.measuredFrags.shift();

    // 操作统计(测序计一次)
    expAddOperation("exp4");

    saveGame();

    renderExperimentPage();

    return pick.frag;

}


// 升级实验设备(片段长度 +1)
function exp4Upgrade(){

    let e =
    game.experiments.exp4;

    let cost =
    exp4UpgradeCost();

    if(cost === null)
        return "maxed";

    if(game.actionPoints.lt(cost))
        return "noAP";

    game.actionPoints =
    game.actionPoints.sub(cost);

    e.upgrades++;

    saveGame();

    renderExperimentPage();

    return "ok";

}


// 提交答案(ATCG 序列)
// 必须是 S 的连续片段才有效;提交完整 S 完成实验
// 只要是 ATCG 组成的提交都会消耗 submitAP(非连续片段也扣,防止试错)
function exp4Submit(input){

    let e =
    game.experiments.exp4;

    if(!e)
        return "notUnlocked";

    // 输入校验:非空且只含 ATCG(格式非法不消耗 AP)
    if(typeof input !== "string" || input.length === 0)
        return "invalid";

    if(!/^[ATCG]+$/.test(input))
        return "invalid";

    // 提交消耗 AP(合法 ATCG 提交无论是否连续都扣)
    if(game.actionPoints.lt(EXPERIMENT4.submitAP))
        return "noAP";

    game.actionPoints =
    game.actionPoints.sub(
        EXPERIMENT4.submitAP
    );

    // 是否 S 的连续片段
    let isFrag =
    e.seq.indexOf(input) !== -1;

    if(!isFrag)
        return "notFrag";

    // 更新最长复原片段
    if(input.length > e.bestLength){

        e.bestLength = input.length;
        e.bestFragment = input;

    }

    // 历史最佳(重新开始不重置,效果保持)
    if(!e.bestEver || input.length > e.bestEver.length){

        e.bestEver = {
            length: input.length,
            fragment: input
        };

    }

    // 操作统计(提交计一次,完成前计数)
    expAddOperation("exp4");

    // 完成判定:复原完整 S
    if(input === e.seq){
        if(!e.completed)
            expOnComplete("exp4");
        e.completed = true;
    }

    saveGame();

    renderExperimentPage();

    return "ok";

}


// 按最长复原片段长度返回 Exp4Effect
// 基于历史最佳(重新开始不重置);未解锁或未有效提交 = 0 无加成
function exp4Effect(){

    if(!game.experiments || !game.experiments.exp4)
        return 0;

    let e =
    game.experiments.exp4;

    // 历史最佳优先(重新开始后仍保留效果)
    let len =
    e.bestEver ? e.bestEver.length : e.bestLength;

    // 未进行过有效提交:无加成
    if(len <= 0)
        return 0;

    // 首次完成效果(按最长复原片段分级)
    let raw =
    len >= 10 ? 5
    : len >= 8 ? 4
    : len >= 6 ? 3
    : len >= 3 ? 2
    : 1;

    // 论文"实验部分-参考实验4":额外加成部分 ×2(最高 5×2 = 10)
    return raw * refExpMultiplier(4);

}


// 提交(x,y)作为答案:消耗 lossAP,返回 loss 值
// 无测量误差;同时记录最佳结果与完成判定
function exp3Submit(x, y){

    let e =
    game.experiments.exp3;

    if(!e)
        return "notUnlocked";

    // 输入校验
    if(isNaN(x) || isNaN(y) || x < 0 || x > 1 || y < 0 || y > 1)
        return "invalid";

    // 行动点校验
    if(game.actionPoints.lt(EXPERIMENT3.lossAP))
        return "noAP";

    game.actionPoints =
    game.actionPoints.sub(
        EXPERIMENT3.lossAP
    );

    // 计算损失(无误差)
    let loss =
    exp3Loss(x, y);

    // 到答案的欧氏距离
    let distance =
    Math.sqrt(loss);

    // 记录测量历史
    e.measurements.push({
        x: x,
        y: y,
        loss: loss
    });

    if(e.measurements.length > 50)
        e.measurements.shift();

    // 记录最佳
    if(!e.bestResult || distance < e.bestResult.distance){
        e.bestResult = {
            x: x,
            y: y,
            distance: distance
        };
    }

    // 历史最佳(重新开始不重置,效果保持)
    if(!e.bestEver || distance < e.bestEver.distance){
        e.bestEver = {
            x: x,
            y: y,
            distance: distance
        };
    }

    // 操作统计(查询即一次操作,完成前计数)
    expAddOperation("exp3");

    // 完成判定
    if(distance < EXPERIMENT3.completeThreshold){
        if(!e.completed)
            expOnComplete("exp3");
        e.completed = true;
    }

    saveGame();

    renderExperimentPage();

    return loss;

}


// 按欧氏距离返回准确度评价与 Exp3Effect
// 返回 {label, effect}
function exp3Accuracy(distance){

    if(distance < 0.01)
        return { label: "极高", effect: 5 };

    if(distance < 0.03)
        return { label: "高", effect: 4 };

    if(distance < 0.1)
        return { label: "中等", effect: 3 };

    if(distance < 0.2)
        return { label: "低", effect: 2 };

    return { label: "无", effect: 1 };

}


// 当前 Exp3Effect(基于历史最佳提交,重新开始不重置;未提交 = 0 无加成)
// 想法价格膨胀起始点 N = 10 + Exp3Effect
function exp3Effect(){

    if(!game.experiments || !game.experiments.exp3)
        return 0;

    let e =
    game.experiments.exp3;

    // 历史最佳优先(重新开始后仍保留效果)
    let src =
    e.bestEver || e.bestResult;

    if(!src)
        return 0;

    // 首次完成效果(按偏差分级);论文"实验部分-参考实验3"使额外部分 ×2
    // (基础 0 + 最高 5×2 = 10)
    return exp3Accuracy(src.distance).effect
    * refExpMultiplier(3);

}


// 生成实验1(首次进入时调用,并存档)
function initExperiment1(){

    // 已有则跳过
    if(game.experiments.exp1)
        return;

    // 随机系数 a,b,c ∈ [0.3,1]
    let a = 0.3 + Math.random() * 0.7;
    let b = 0.3 + Math.random() * 0.7;
    let c = 0.3 + Math.random() * 0.7;

    // 求 U_0:f(U)=1 在 [0,1] 内的解(二分法)
    let u0 = solveF1(a, b, c);

    game.experiments.exp1 = {
        a: a,
        b: b,
        c: c,
        u0: u0,
        completed: false,
        upgrades: 0,
        measurements: [],    // [{U, I}]
        bestResult: null,    // {U, deviation}
        bestEver: null,      // 历史最佳(重新开始不重置)
        operationCount: 0,   // 本次实验操作数(测量+提交)
        completions: 0,      // 完成次数
        bestOperations: null,// 最少操作次数
        restarted: false     // 是否重新开始过
    };

    saveGame();

}


// 伏安函数 I = f(U)
function exp1F(U, a, b, c){
    return a * U + b * U * U + c * (Math.exp(U) - 1);
}


// 二分法求 f(U)=1 的解(0~1V 内,单调递增保证唯一解)
function solveF1(a, b, c){

    let lo = 0;
    let hi = 1;

    // f(0)=0, f(1)>=0.3+0.3+0.3*(e-1)≈1.12>1,故解在(0,1)内
    for(let i = 0; i < 60; i++){

        let mid = (lo + hi) / 2;

        if(exp1F(mid, a, b, c) < EXPERIMENT1.targetI)
            lo = mid;
        else
            hi = mid;

    }

    return (lo + hi) / 2;

}


// 标准正态分布(Box-Muller)
function gaussRandom(){

    let u = 0, v = 0;

    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();

    return Math.sqrt(-2 * Math.log(u))
    * Math.cos(2 * Math.PI * v);

}


// 当前测量相对误差(设备升级后减半,最低 0.1%)
function exp1RelErr(){

    let err =
    EXPERIMENT1.initErr
    / Math.pow(2, game.experiments.exp1.upgrades);

    return Math.max(err, EXPERIMENT1.minErr);

}


// 当前升级价格(每次翻倍;满级返回 null)
function exp1UpgradeCost(){

    let e = game.experiments.exp1;

    if(e.upgrades >= EXPERIMENT1.maxUpgrades)
        return null;

    return EXPERIMENT1.upgradeCostBase
    * Math.pow(
        EXPERIMENT1.upgradeCostMul,
        e.upgrades
    );

}


// 测量一个 U 对应的 I
// 有效输入:U ∈ [0,1]V;消耗 1 行动点
// I 加上高斯相对误差;记录到历史
function exp1Measure(U){

    let e = game.experiments.exp1;

    // 输入校验
    if(isNaN(U) || U < 0 || U > 1)
        return "invalid";

    // 行动点校验
    if(game.actionPoints.lt(1))
        return "noAP";

    game.actionPoints =
    game.actionPoints.sub(1);

    // 真实值 + 高斯相对误差
    let trueI = exp1F(U, e.a, e.b, e.c);

    let noise =
    1 + gaussRandom() * exp1RelErr();

    let I = trueI * noise;

    // 记录
    e.measurements.push({
        U: U,
        I: I
    });

    // 只保留最近 50 条
    if(e.measurements.length > 50)
        e.measurements.shift();

    // 操作统计
    expAddOperation("exp1");

    saveGame();

    renderExperimentPage();

    return I;

}


// 升级实验设备
function exp1Upgrade(){

    let e = game.experiments.exp1;

    let cost = exp1UpgradeCost();

    if(cost === null)
        return "maxed";

    if(game.actionPoints.lt(cost))
        return "noAP";

    game.actionPoints =
    game.actionPoints.sub(cost);

    e.upgrades++;

    saveGame();

    renderExperimentPage();

    return "ok";

}


// 提交结果(输入猜测的 U_0)
// 消耗 1 行动点;可多次提交;记录最佳结果
function exp1Submit(U){

    let e = game.experiments.exp1;

    // 输入校验
    if(isNaN(U) || U < 0 || U > 1)
        return "invalid";

    // 行动点校验
    if(game.actionPoints.lt(1))
        return "noAP";

    game.actionPoints =
    game.actionPoints.sub(1);

    // 偏差
    let deviation =
    Math.abs(U - e.u0);

    // 记录最佳
    if(!e.bestResult || deviation < e.bestResult.deviation){
        e.bestResult = {
            U: U,
            deviation: deviation
        };
    }

    // 历史最佳(重新开始不重置,效果保持)
    if(!e.bestEver || deviation < e.bestEver.deviation){
        e.bestEver = {
            U: U,
            deviation: deviation
        };
    }

    // 操作统计(完成前计数,以便首次完成计入 bestOperations)
    expAddOperation("exp1");

    // 完成判定
    if(deviation < EXPERIMENT1.completeThreshold){
        if(!e.completed)
            expOnComplete("exp1");
        e.completed = true;
    }

    saveGame();

    renderExperimentPage();

    return "ok";

}


// 按偏差返回准确度评价与指数
// 返回 {label, exponent}
// 未提交(deviation 为 null)= 无加成 ^1.0;"无"档(已提交但差)保底 ^1.1
function exp1Accuracy(deviation){

    if(deviation === null || deviation === undefined)
        return { label: "无", exponent: 1.0 };

    if(deviation < 0.005)
        return { label: "极高", exponent: 1.5 };

    if(deviation < 0.01)
        return { label: "高", exponent: 1.4 };

    if(deviation < 0.03)
        return { label: "中等", exponent: 1.3 };

    if(deviation < 0.1)
        return { label: "低", exponent: 1.2 };

    return { label: "无", exponent: 1.1 };

}


// 当前加成指数(基于历史最佳提交,重新开始不重置;
// 未解锁或从未提交 = 1.0 无加成)
function exp1Exponent(){

    if(!game.experiments || !game.experiments.exp1)
        return 1.0;

    let e = game.experiments.exp1;

    // 历史最佳优先(重新开始后仍保留效果)
    let src = e.bestEver || e.bestResult;

    if(!src)
        return 1.0;

    // 首次完成效果 = 基础指数 1.0 + 额外部分(exponent - 1.0)
    // 论文"实验部分-参考实验1"使额外部分 ×2(最高 1.0 + 0.5×2 = 2.0)
    let acc =
    exp1Accuracy(src.deviation);

    return 1.0
    + (acc.exponent - 1.0) * refExpMultiplier(1);

}


// ============================================================
// 实验2:信号周期测量
// ============================================================

// 生成实验2(实验1 完成后首次进入实验页时调用,并存档)
function initExperiment2(){

    // 前置条件:实验1 已完成
    if(!game.experiments || !game.experiments.exp1)
        return;

    if(!game.experiments.exp1.completed)
        return;

    // 已有则跳过
    if(game.experiments.exp2)
        return;

    // 随机正弦波参数
    let A =
    EXPERIMENT2.ampMin
    + Math.random()
    * (EXPERIMENT2.ampMax - EXPERIMENT2.ampMin);

    let phi =
    EXPERIMENT2.phaseMin
    + Math.random()
    * (EXPERIMENT2.phaseMax - EXPERIMENT2.phaseMin);

    let T =
    EXPERIMENT2.periodMin
    + Math.random()
    * (EXPERIMENT2.periodMax - EXPERIMENT2.periodMin);

    game.experiments.exp2 = {
        A: A,               // 振幅(玩家未知)
        phi: phi,           // 相位(玩家未知)
        T: T,               // 周期答案,秒(玩家未知)
        completed: false,
        upgrades: 0,
        elapsed: 0,         // 解锁以来的游戏时间(秒),随时间推进
        measurements: [],   // [{t, signal}]
        bestResult: null,   // {T, deviation}
        bestEver: null,     // 历史最佳(重新开始不重置)
        operationCount: 0,  // 本次实验操作数(测量+提交)
        completions: 0,     // 完成次数
        bestOperations: null,// 最少操作次数
        restarted: false    // 是否重新开始过
    };

    saveGame();

}


// 信号真实值:s(t) = A * sin(2πt/T + φ)
function exp2Signal(t){

    let e =
    game.experiments.exp2;

    return e.A * Math.sin(
        2 * Math.PI * t / e.T + e.phi
    );

}


// 当前测量相对误差(设备升级后减半,最低 0.1%,同实验1)
function exp2RelErr(){

    let err =
    EXPERIMENT2.initErr
    / Math.pow(2, game.experiments.exp2.upgrades);

    return Math.max(err, EXPERIMENT2.minErr);

}


// 当前升级价格(每次翻倍;满级返回 null)
function exp2UpgradeCost(){

    let e =
    game.experiments.exp2;

    if(e.upgrades >= EXPERIMENT2.maxUpgrades)
        return null;

    return EXPERIMENT2.upgradeCostBase
    * Math.pow(
        EXPERIMENT2.upgradeCostMul,
        e.upgrades
    );

}


// 测量当前时刻的信号值
// 不需要输入:t 固定为解锁以来的游戏时间;消耗 5 行动点
// 信号值加上高斯相对误差;记录到历史
function exp2Measure(){

    let e =
    game.experiments.exp2;

    if(!e)
        return "notUnlocked";

    // 行动点校验
    if(game.actionPoints.lt(EXPERIMENT2.measureAP))
        return "noAP";

    game.actionPoints =
    game.actionPoints.sub(
        EXPERIMENT2.measureAP
    );

    let t = e.elapsed;

    // 真实值 + 高斯相对误差
    let trueSignal =
    exp2Signal(t);

    let noise =
    1 + gaussRandom() * exp2RelErr();

    let signal =
    trueSignal * noise;

    // 记录
    e.measurements.push({
        t: t,
        signal: signal
    });

    // 只保留最近 50 条
    if(e.measurements.length > 50)
        e.measurements.shift();

    // 操作统计
    expAddOperation("exp2");

    saveGame();

    renderExperimentPage();

    return signal;

}


// 升级实验设备
function exp2Upgrade(){

    let e =
    game.experiments.exp2;

    let cost =
    exp2UpgradeCost();

    if(cost === null)
        return "maxed";

    if(game.actionPoints.lt(cost))
        return "noAP";

    game.actionPoints =
    game.actionPoints.sub(cost);

    e.upgrades++;

    saveGame();

    renderExperimentPage();

    return "ok";

}


// 提交结果(输入猜测的周期 T,秒)
// 消耗 5 行动点;可多次提交;记录最佳结果
function exp2Submit(T){

    let e =
    game.experiments.exp2;

    if(!e)
        return "notUnlocked";

    // 输入校验
    if(isNaN(T) || T <= 0 || T > 1e4)
        return "invalid";

    // 行动点校验
    if(game.actionPoints.lt(EXPERIMENT2.submitAP))
        return "noAP";

    game.actionPoints =
    game.actionPoints.sub(
        EXPERIMENT2.submitAP
    );

    // 偏差(秒)
    let deviation =
    Math.abs(T - e.T);

    // 记录最佳
    if(!e.bestResult || deviation < e.bestResult.deviation){
        e.bestResult = {
            T: T,
            deviation: deviation
        };
    }

    // 历史最佳(重新开始不重置,效果保持)
    if(!e.bestEver || deviation < e.bestEver.deviation){
        e.bestEver = {
            T: T,
            deviation: deviation
        };
    }

    // 操作统计(完成前计数,以便首次完成计入 bestOperations)
    expAddOperation("exp2");

    // 完成判定
    if(deviation < EXPERIMENT2.completeThreshold){
        if(!e.completed)
            expOnComplete("exp2");
        e.completed = true;
    }

    saveGame();

    renderExperimentPage();

    return "ok";

}


// 按偏差返回准确度评价与加成底数
// 返回 {label, base};区间:>10s 无(2.2),3~10s 低(2.4),
// 1~3s 中等(2.6),0.5~1s 高(2.8),<0.5s 极高(3.0)
function exp2Accuracy(deviation){

    if(deviation < 0.5)
        return { label: "极高", base: 2.5 };

    if(deviation < 1)
        return { label: "高", base: 2.4 };

    if(deviation < 3)
        return { label: "中等", base: 2.3 };

    if(deviation <= 10)
        return { label: "低", base: 2.2 };

    return { label: "无", base: 2.1 };

}


// 当前元-力量加成底数(基于最佳提交;未提交 = 2 无加成)
// 底数用于 metaPowerGain:0.1 * Base^(想法数-1)
function exp2Base(){

    if(!game.experiments || !game.experiments.exp2)
        return 2;

    let e =
    game.experiments.exp2;

    // 历史最佳优先(重新开始后仍保留效果)
    let src =
    e.bestEver || e.bestResult;

    if(!src)
        return 2;

    // 首次完成效果 = 基础底数 2 + 额外部分(accuracy.base - 2)
    // 论文"实验部分-参考实验2"使额外部分 ×2(最高 2 + 0.5×2 = 3.0)
    // 注:多次完成加成不属于首次完成效果,不放大
    let first =
    exp2Accuracy(src.deviation).base;

    return 2
    + (first - 2) * refExpMultiplier(2)
    + exp2CompletionBonus();

}


// 推进实验2 的信号时间(每 tick 调用)
// dt 为游戏时间步长(受调试倍速影响),与知识等一致
// elapsed 是普通 number(时间用不到大数库,避免 Decimal 序列化/运算坑)
// 完成实验后仍继续累加:信号一直在产生,重新打开游戏后计时器应恢复走动
function updateExperiment2Time(dt){

    if(!game.experiments || !game.experiments.exp2)
        return;

    let e =
    game.experiments.exp2;

    e.elapsed += dt;

}


// ============================================================
// 实验卡片展开/收起
// 收起后只显示实验名 + 完成状态(头部)
// ============================================================

// 切换实验卡片展开/收起
function toggleExpCard(cardId){

    let card =
    document.getElementById(
        cardId
    );

    if(!card)
        return;

    let btn =
    card.querySelector(".exp-toggle");

    // 收起:隐藏除头部外的内容
    if(card.classList.contains("collapsed")){

        card.classList.remove("collapsed");

        if(btn)
            btn.innerText = "收起";

    }else{

        card.classList.add("collapsed");

        if(btn)
            btn.innerText = "展开";

    }

}


// ============================================================
// 渲染
// ============================================================

// 绘制实验页面(增量更新)
function renderExperimentPage(){

    // 首次进入时生成实验数据
    if(!game.experiments.exp1)
        return;

    let e = game.experiments.exp1;

    // 实验1 完成后初始化实验2
    if(e.completed && !game.experiments.exp2)
        initExperiment2();

    // 实验2 完成后初始化实验3
    if(game.experiments.exp2
        && game.experiments.exp2.completed
        && !game.experiments.exp3)
        initExperiment3();

    // 兼容旧存档:实验3 缺少系数时补齐
    ensureExp3Coeffs();

    // 实验3 完成后初始化实验4
    if(game.experiments.exp3
        && game.experiments.exp3.completed
        && !game.experiments.exp4)
        initExperiment4();

    // 兼容:确保各实验统计字段存在(操作数/完成次数)
    for(let k in game.experiments){
        ensureExpStats(game.experiments[k]);
    }

    // 状态:进行中/已完成
    let status =
    document.getElementById(
        "exp1Status"
    );

    if(status)
        status.innerHTML =
        expStatusHTML("exp1", e);

    // 设备精度
    let errEl =
    document.getElementById(
        "exp1Err"
    );

    if(errEl)
        errEl.innerText =
        (exp1RelErr() * 100).toFixed(2) + "";

    // 升级按钮
    let upBtn =
    document.getElementById(
        "exp1UpgradeBtn"
    );

    if(upBtn){

        let cost = exp1UpgradeCost();

        if(cost === null){

            upBtn.disabled = true;
            upBtn.innerText = "已满级";

        }else{

            upBtn.disabled =
            game.actionPoints.lt(cost);

            upBtn.innerText =
            "升级设备(" + cost + " AP):"
            + (exp1RelErr() * 100).toFixed(2)
            + "%→"
            + (Math.max(
                EXPERIMENT1.initErr
                / Math.pow(2, e.upgrades + 1),
                EXPERIMENT1.minErr
            ) * 100).toFixed(2)
            + "%";

        }

    }

    // 测量按钮
    let meBtn =
    document.getElementById(
        "exp1MeasureBtn"
    );

    if(meBtn)
        meBtn.disabled =
        game.actionPoints.lt(1);

    // 提交按钮
    let subBtn =
    document.getElementById(
        "exp1SubmitBtn"
    );

    if(subBtn)
        subBtn.disabled =
        game.actionPoints.lt(1);

    // 最佳结果与加成
    renderExp1Result();

    // 测量历史
    renderExp1History();

    // 实验2 部分(未解锁时隐藏)
    renderExp2Section();

    // 实验3/4 部分(研究阶段2 后显示)
    renderExp3Section();
    renderExp4Section();

    // 各实验统计与重新开始(研究阶段3 解锁额外信息)
    // 首次完成效果 = 实验完成(准确度最高,即历史最佳)时的实际效果
    renderExpStats("exp1", "exp1Stats",
        "元-力量对理论力量的加成指数提升到 ^" + exp1Exponent().toFixed(1) +
        "(基础 ^1.0)");
    // exp2 首次效果:基于历史最佳的准确度底数(不含多次完成加成)
    let exp2Src =
    game.experiments.exp2
    ? (game.experiments.exp2.bestEver || game.experiments.exp2.bestResult)
    : null;

    let exp2FirstBase =
    exp2Src ? exp2Accuracy(exp2Src.deviation).base : 2;

    renderExpStats("exp2", "exp2Stats",
        "元-力量加成底数提升到 " + exp2FirstBase.toFixed(1) + "(基础 2)");
    renderExpStats("exp3", "exp3Stats",
        "想法价格膨胀起始点延后 N+" + exp3Effect() + "(基础 N=10)");
    renderExpStats("exp4", "exp4Stats",
        "理论升级价格膨胀起始点延后 N+" + exp4Effect() + "(基础 N=5)");

}


// 多次完成效果的具体值(根据完成次数计算)
// 仅当 completions>=2 时被调用
// 数值统一走 format(超过 1e6 显示为科学计数法)
function expMultiEffectText(key, c){

    if(key === "exp1")
        return "元-力量生产 ×" + format(c);

    if(key === "exp2")
        return "元-力量底数额外 +" + format(0.1 * Math.log(c));

    if(key === "exp3")
        return "想法花费 ÷"
        + format(new Decimal(c).pow(10).round())
        + "(=完成次数^10)";

    if(key === "exp4")
        return "所有理论力量生产 ×"
        + format(c * c) + "(=完成次数²)";

    return "";

}


// 渲染实验统计与重新开始按钮(增量渲染:内容没变化不重建,避免按钮点击竞态)
let lastStatsHTML = {};

function renderExpStats(key, boxId, firstEffectDesc){

    let box =
    document.getElementById(
        boxId
    );

    if(!box)
        return;

    let e =
    game.experiments[key];

    if(!e){

        if(box.innerHTML !== "")
            box.innerHTML = "";

        return;

    }

    ensureExpStats(e);

    let html = "";

    // 已最优化标记:研究阶段3 解锁 + 最少操作次数 ≤ 最优化操作次数
    if(expOptimized(key)){

        html +=
        "<p class=\"exp-hint\">已最优化</p>";

    }

    // 操作统计(始终显示)
    html +=
    "<p class=\"exp-hint\">你在本次实验中使用了 <b>" +
    e.operationCount +
    "</b> 次操作(测量与提交次数总和)</p>";

    // 里程碑3 且至少重新开始过一次:额外信息
    if(isMilestoneActive("stage3") && e.restarted){

        html +=
        "<p class=\"exp-hint\">此实验中,你使用操作最少的一次使用了 <b>" +
        (e.bestOperations === null ? "-" : e.bestOperations) +
        "</b> 次操作</p>";

        html +=
        "<p class=\"exp-hint\">首次完成此实验使得:" +
        firstEffectDesc +
        "</p>";

        // 多次完成效果:仅 completions>=2 时显示具体值(避免 completions=1 显示无意义公式)
        // 取整显示(自动助手可产生小数完成次数)
        let comp = expCompletions(key);

        if(comp >= 2){

            html +=
            "<p class=\"exp-hint\">你已完成了 <b>" +
            format(comp) +
            "</b> 次此实验,使得:" +
            expMultiEffectText(key, comp) +
            "</p>";

        }

    }

    // 重新开始按钮(里程碑3 + 已完成时显示)
    if(isMilestoneActive("stage3") && e.completed){

        html +=
        "<div class=\"exp-action\">" +
        "<button onclick=\"restartExpClick('" + key + "')\">重新开始实验</button>" +
        "</div>";

    }

    // 增量渲染:内容没变化时不重建 DOM(保持按钮稳定,避免点击丢失)
    if(box.innerHTML !== html)
        box.innerHTML = html;

}


// 重新开始按钮点击
function restartExpClick(key){

    let r =
    restartExp(key);

    let msg =
    document.getElementById(
        key === "exp1" ? "exp1Msg"
        : key === "exp2" ? "exp2Msg"
        : key === "exp3" ? "exp3Msg"
        : "exp4Msg"
    );

    if(!msg)
        return;

    if(r === "ok")
        msg.innerText = "实验已重新开始!答案已重新生成,测量记录已清空(升级状态保留)。";
    else if(r === "locked")
        msg.innerText = "需要研究阶段3(自动化研究)才能重新开始。";
    else if(r === "notUnlocked")
        msg.innerText = "实验尚未解锁。";

    renderExperimentPage();

}


// 显示提交结果与加成
function renderExp1Result(){

    let box =
    document.getElementById(
        "exp1Result"
    );

    if(!box)
        return;

    let e = game.experiments.exp1;

    if(!e.bestResult){

        box.innerHTML =
        "<p class=\"exp-hint\">尚未提交结果。提交后,此处会显示你提交结果的准确度。</p>";

        return;

    }

    let acc =
    exp1Accuracy(e.bestResult.deviation);

    // 不显示"与答案最接近的是 XX":防止玩家靠反馈试答案而不做测量
    box.innerHTML =
    "<p>你提交的结果准确度 <b>" + acc.label +
    "</b>。</p>";

    // 未重新开始过:显示效果句;重新开始后只显示准确度
    if(!e.restarted){

        box.innerHTML +=
        "<p>元-力量对理论力量的加成指数:<b>^" +
        acc.exponent.toFixed(1) +
        "</b>((1+MetaPower)^" + acc.exponent.toFixed(1) + ")</p>";

    }

}


// 显示测量历史(最近若干条)
function renderExp1History(){

    let box =
    document.getElementById(
        "exp1History"
    );

    if(!box)
        return;

    let e = game.experiments.exp1;

    if(e.measurements.length === 0){

        box.innerHTML =
        "<p class=\"exp-hint\">尚无测量数据。</p>";

        return;

    }

    // 显示最近 10 条
    let rows = e.measurements.slice(-10).reverse();

    let html =
    "<table class=\"exp-table\"><tr><th>U (V)</th><th>I (mA)</th></tr>";

    for(let i = 0; i < rows.length; i++){

        // 防御:旧存档可能出现非数字字段,用 Number() 兜底
        let u = Number(rows[i].U);
        let im = Number(rows[i].I);

        html +=
        "<tr><td>" + (isNaN(u) ? "-" : u.toFixed(4)) +
        "</td><td>" + (isNaN(im) ? "-" : im.toFixed(4)) +
        "</td></tr>";

    }

    html += "</table>";

    box.innerHTML = html;

}


// 输入框读取(返回数字,非法返回 NaN)
function readExpU(id){

    let el =
    document.getElementById(id);

    if(!el)
        return NaN;

    return parseFloat(el.value);

}


// 测量按钮点击
function exp1MeasureClick(){

    let U =
    readExpU("exp1MeasureU");

    let result =
    exp1Measure(U);

    let msg =
    document.getElementById(
        "exp1Msg"
    );

    if(!msg)
        return;

    if(result === "invalid")
        msg.innerText = "输入无效:U 需在 0~1 V 范围内。";
    else if(result === "noAP")
        msg.innerText = "行动点不足(测量需 1 AP)。";
    else
        msg.innerText =
        "测量完成:U=" + U.toFixed(4) +
        " V,I=" + result.toFixed(4) + " mA(-1 AP)";

}


// 升级按钮点击
function exp1UpgradeClick(){

    let result =
    exp1Upgrade();

    let msg =
    document.getElementById(
        "exp1Msg"
    );

    if(!msg)
        return;

    if(result === "maxed")
        msg.innerText = "设备已满级。";
    else if(result === "noAP")
        msg.innerText = "行动点不足。";
    else
        msg.innerText = "设备已升级,相对误差降低。";

}


// 提交按钮点击
function exp1SubmitClick(){

    let U =
    readExpU("exp1SubmitU");

    let result =
    exp1Submit(U);

    let msg =
    document.getElementById(
        "exp1Msg"
    );

    if(!msg)
        return;

    if(result === "invalid")
        msg.innerText = "输入无效:U 需在 0~1 V 范围内。";
    else if(result === "noAP")
        msg.innerText = "行动点不足(提交需 1 AP)。";
    else
        msg.innerText = "已提交:U=" + U.toFixed(4) + " V(-1 AP)";

    renderExperimentPage();

}


// ============================================================
// 实验2 渲染与交互
// ============================================================

// 绘制实验2 区域(未解锁时隐藏卡片)
function renderExp2Section(){

    let card =
    document.getElementById(
        "exp2Card"
    );

    if(!card)
        return;

    let e =
    game.experiments.exp2;

    if(!e){
        card.style.display = "none";
        return;
    }

    card.style.display = "block";

    // 状态
    let status =
    document.getElementById(
        "exp2Status"
    );

    if(status)
        status.innerHTML =
        expStatusHTML("exp2", e);

    // 当前信号时间 t(单位 s 在 HTML 中)
    let timeEl =
    document.getElementById(
        "exp2Time"
    );

    if(timeEl)
        timeEl.innerText =
        e.elapsed.toFixed(1);

    // 设备精度
    let errEl =
    document.getElementById(
        "exp2Err"
    );

    if(errEl)
        errEl.innerText =
        (exp2RelErr() * 100).toFixed(2) + "";

    // 升级按钮
    let upBtn =
    document.getElementById(
        "exp2UpgradeBtn"
    );

    if(upBtn){

        let cost =
        exp2UpgradeCost();

        if(cost === null){

            upBtn.disabled = true;
            upBtn.innerText = "已满级";

        }else{

            upBtn.disabled =
            game.actionPoints.lt(cost);

            upBtn.innerText =
            "升级设备(" + cost + " AP):"
            + (exp2RelErr() * 100).toFixed(2)
            + "%→"
            + (Math.max(
                EXPERIMENT2.initErr
                / Math.pow(2, e.upgrades + 1),
                EXPERIMENT2.minErr
            ) * 100).toFixed(2)
            + "%";

        }

    }

    // 测量按钮
    let meBtn =
    document.getElementById(
        "exp2MeasureBtn"
    );

    if(meBtn)
        meBtn.disabled =
        game.actionPoints.lt(
            EXPERIMENT2.measureAP
        );

    // 提交按钮
    let subBtn =
    document.getElementById(
        "exp2SubmitBtn"
    );

    if(subBtn)
        subBtn.disabled =
        game.actionPoints.lt(
            EXPERIMENT2.submitAP
        );

    // 结果与历史
    renderExp2Result();
    renderExp2History();

}


// 显示实验2 提交结果与加成
function renderExp2Result(){

    let box =
    document.getElementById(
        "exp2Result"
    );

    if(!box)
        return;

    let e =
    game.experiments.exp2;

    if(!e.bestResult){

        box.innerHTML =
        "<p class=\"exp-hint\">尚未提交结果。提交后,此处会显示你提交结果的准确度。</p>";

        return;

    }

    let acc =
    exp2Accuracy(e.bestResult.deviation);

    // 不显示"与答案最接近的是 XX":防止玩家靠反馈试答案而不做测量
    box.innerHTML =
    "<p>你提交的结果准确度 <b>" + acc.label +
    "</b>。</p>";

    // 未重新开始过:显示效果句;重新开始后只显示准确度
    if(!e.restarted){

        box.innerHTML +=
        "<p>元-力量加成底数:<b>" +
        acc.base.toFixed(1) +
        "</b>(元-力量速度 = 0.1 × " +
        acc.base.toFixed(1) +
        "^(想法数-1)/秒)</p>";

    }

}


// 显示实验2 测量历史(最近若干条)
function renderExp2History(){

    let box =
    document.getElementById(
        "exp2History"
    );

    if(!box)
        return;

    let e =
    game.experiments.exp2;

    if(e.measurements.length === 0){

        box.innerHTML =
        "<p class=\"exp-hint\">尚无测量数据。</p>";

        return;

    }

    // 显示最近 10 条
    let rows =
    e.measurements.slice(-10).reverse();

    let html =
    "<table class=\"exp-table\"><tr><th>t (s)</th><th>信号值</th></tr>";

    for(let i = 0; i < rows.length; i++){

        // 防御:旧存档可能出现非数字/Decimal 字段,用 Number() 兜底
        let t = Number(rows[i].t);
        let s = Number(rows[i].signal);

        html +=
        "<tr><td>" + (isNaN(t) ? "-" : t.toFixed(1)) +
        "</td><td>" + (isNaN(s) ? "-" : s.toFixed(4)) +
        "</td></tr>";

    }

    html += "</table>";

    box.innerHTML = html;

}


// 测量按钮点击
function exp2MeasureClick(){

    let result =
    exp2Measure();

    let msg =
    document.getElementById(
        "exp2Msg"
    );

    if(!msg)
        return;

    if(result === "notUnlocked")
        msg.innerText = "实验尚未解锁。";
    else if(result === "noAP")
        msg.innerText = "行动点不足(测量需 " +
        EXPERIMENT2.measureAP + " AP)。";
    else{

        let e =
        game.experiments.exp2;

        msg.innerText =
        "测量完成:t=" + e.elapsed.toFixed(1) +
        " s,信号值=" + result.toFixed(4) +
        "(-" + EXPERIMENT2.measureAP + " AP)";

    }

}


// 升级按钮点击
function exp2UpgradeClick(){

    let result =
    exp2Upgrade();

    let msg =
    document.getElementById(
        "exp2Msg"
    );

    if(!msg)
        return;

    if(result === "maxed")
        msg.innerText = "设备已满级。";
    else if(result === "noAP")
        msg.innerText = "行动点不足。";
    else
        msg.innerText = "设备已升级,相对误差降低。";

}


// 提交按钮点击
function exp2SubmitClick(){

    let el =
    document.getElementById(
        "exp2SubmitT"
    );

    let T =
    el ? parseFloat(el.value) : NaN;

    let result =
    exp2Submit(T);

    let msg =
    document.getElementById(
        "exp2Msg"
    );

    if(!msg)
        return;

    if(result === "notUnlocked")
        msg.innerText = "实验尚未解锁。";
    else if(result === "invalid")
        msg.innerText = "输入无效:周期 T 需大于 0 秒。";
    else if(result === "noAP")
        msg.innerText = "行动点不足(提交需 " +
        EXPERIMENT2.submitAP + " AP)。";
    else
        msg.innerText = "已提交:T=" + T.toFixed(2) + " s(-" +
        EXPERIMENT2.submitAP + " AP)";

    renderExperimentPage();

}


// ============================================================
// 实验3/4(研究阶段2 解锁,内容待定,先做显示与锁定)
// 研究阶段 >= 2 才显示;若实验2 未完成则锁定,提示需先完成实验2
// ============================================================

// ============================================================
// 实验3:深度学习算法(研究阶段2 解锁,需先完成实验2)
// ============================================================

// 绘制实验3 区域(研究阶段2 后显示;实验2 未完成则锁定)
function renderExp3Section(){

    let card =
    document.getElementById(
        "exp3Card"
    );

    if(!card)
        return;

    // 研究阶段 < 2:隐藏
    if(game.researchStage < 2){
        card.style.display = "none";
        return;
    }

    card.style.display = "block";

    let status =
    document.getElementById(
        "exp3Status"
    );

    let body =
    document.getElementById(
        "exp3Body"
    );

    // 实验2 未完成且未重启过:锁定状态
    // (已重启说明之前曾完成过,后续实验仍可用,不应锁回"未解锁")
    let exp2Done =
    game.experiments
    && game.experiments.exp2
    && (game.experiments.exp2.completed
        || game.experiments.exp2.restarted
        || game.experiments.exp2.bestEver);

    if(!exp2Done){

        if(status)
            status.innerText = "锁定";

        if(body)
            body.innerHTML =
            "<p class=\"exp-hint\">需要完成实验2(信号周期测量)来解锁。</p>";

        return;

    }

    // 实验2 已完成:真实内容
    let e =
    game.experiments.exp3;

    if(status)
        status.innerHTML =
        expStatusHTML("exp3", e, "待解锁");

    if(!body)
        return;

    // 提交按钮状态
    let btn =
    document.getElementById(
        "exp3SubmitBtn"
    );

    if(btn)
        btn.disabled =
        game.actionPoints.lt(EXPERIMENT3.lossAP);

    // 最佳结果与效果
    if(!e || !e.bestResult){

        body.innerHTML =
        "<p class=\"exp-hint\">输入 (x, y) 查询损失函数值(同时作为答案提交)。</p>";

    }else{

        let acc =
        exp3Accuracy(e.bestResult.distance);

        // 不显示"最接近答案的是 x,y":防止玩家靠反馈试答案而不做测量
        body.innerHTML =
        "<p>你提交的结果准确度 <b>" + acc.label +
        "</b>。</p>";

        // 未重新开始过:显示效果句;重新开始后只显示准确度
        if(!e.restarted){

            let n =
            IDEA_PRICE.N + exp3Effect();

            body.innerHTML +=
            "<p>使得想法的价格膨胀起始点延后到 <b>N=" + n + "</b>(基础 10 + Exp3Effect " +
            exp3Effect() + ")。</p>";

        }

    }

    // 测量历史(最近若干条)
    let hist =
    document.getElementById(
        "exp3History"
    );

    if(!e || e.measurements.length === 0){

        if(hist)
            hist.innerHTML =
            "<p class=\"exp-hint\">尚无查询数据。</p>";

        return;

    }

    if(hist){

        let rows = e.measurements.slice(-10).reverse();

        let html =
        "<h4>查询历史</h4>" +
        "<table class=\"exp-table\"><tr><th>x</th><th>y</th><th>loss</th></tr>";

        for(let i = 0; i < rows.length; i++){

            // 防御:旧存档可能出现非数字字段
            let x = Number(rows[i].x);
            let y = Number(rows[i].y);
            let loss = Number(rows[i].loss);

            html +=
            "<tr><td>" + (isNaN(x) ? "-" : x.toFixed(4)) +
            "</td><td>" + (isNaN(y) ? "-" : y.toFixed(4)) +
            "</td><td>" + (isNaN(loss) ? "-" : loss.toFixed(6)) +
            "</td></tr>";

        }

        html += "</table>";

        hist.innerHTML = html;

    }

}


// 实验3 提交按钮点击
function exp3SubmitClick(){

    let x =
    Number(
        document.getElementById(
            "exp3X"
        ).value
    );

    let y =
    Number(
        document.getElementById(
            "exp3Y"
        ).value
    );

    let result =
    exp3Submit(x, y);

    let msg =
    document.getElementById(
        "exp3Msg"
    );

    if(!msg)
        return;

    if(result === "notUnlocked")
        msg.innerText = "实验尚未解锁。";
    else if(result === "invalid")
        msg.innerText = "输入无效:x、y 需在 0~1 范围内。";
    else if(result === "noAP")
        msg.innerText = "行动点不足(查询需 " +
        EXPERIMENT3.lossAP + " AP)。";
    else
        msg.innerText = "查询完成:loss=" + result.toFixed(6) +
        "(-" + EXPERIMENT3.lossAP + " AP)";

    renderExperimentPage();

}


// 绘制实验4 区域(研究阶段2 后显示;需先完成实验3)
function renderExp4Section(){

    let card =
    document.getElementById(
        "exp4Card"
    );

    if(!card)
        return;

    // 研究阶段 < 2:隐藏
    if(game.researchStage < 2){
        card.style.display = "none";
        return;
    }

    card.style.display = "block";

    let status =
    document.getElementById(
        "exp4Status"
    );

    let body =
    document.getElementById(
        "exp4Body"
    );

    // 实验3 未完成且未重启过:隐藏(实验4 需完成实验3 才解锁;
    // 已重启说明曾完成过,仍显示避免锁回"未解锁")
    let exp3Done =
    game.experiments
    && game.experiments.exp3
    && (game.experiments.exp3.completed
        || game.experiments.exp3.restarted
        || game.experiments.exp3.bestEver);

    if(!exp3Done){

        card.style.display = "none";

        return;

    }

    // 实验3 已完成:真实内容
    let e =
    game.experiments.exp4;

    if(status)
        status.innerHTML =
        expStatusHTML("exp4", e, "待解锁");

    if(!body)
        return;

    // 片段长度与升级按钮
    let lenEl =
    document.getElementById(
        "exp4Len"
    );

    if(lenEl)
        lenEl.innerText = exp4FragLen();

    let upBtn =
    document.getElementById(
        "exp4UpgradeBtn"
    );

    if(upBtn){

        let cost = exp4UpgradeCost();

        if(cost === null){

            upBtn.disabled = true;
            upBtn.innerText = "已满级";

        }else{

            upBtn.disabled =
            game.actionPoints.lt(cost);

            upBtn.innerText =
            "升级设备(" + format(cost) + " AP):片段长度 " +
            exp4FragLen() + "→" + (exp4FragLen() + 1);

        }

    }

    // 测序按钮
    let meBtn =
    document.getElementById(
        "exp4MeasureBtn"
    );

    if(meBtn)
        meBtn.disabled =
        game.actionPoints.lt(EXPERIMENT4.measureAP);

    // 提交按钮
    let subBtn =
    document.getElementById(
        "exp4SubmitBtn"
    );

    if(subBtn)
        subBtn.disabled =
        game.actionPoints.lt(EXPERIMENT4.submitAP);

    // 最佳结果与效果
    if(!e || e.bestLength === 0){

        body.innerHTML =
        "<p class=\"exp-hint\">尚未提交有效片段。</p>";

    }else{

        body.innerHTML =
        "<p>你复原的最长连续片段是 <b>" +
        e.bestFragment +
        "</b>,长度为 <b>" + e.bestLength +
        "</b>。</p>";

        // 未重新开始过:显示效果句;重新开始后只显示答案
        if(!e.restarted){

            let effect = exp4Effect();

            body.innerHTML +=
            "<p>因此所有理论升级的价格膨胀延后 <b>Exp4Effect=" +
            effect + "</b>。</p>";

        }

    }

    // 测序历史
    let hist =
    document.getElementById(
        "exp4History"
    );

    if(!e || e.measuredFrags.length === 0){

        if(hist)
            hist.innerHTML =
            "<p class=\"exp-hint\">尚无测序数据。</p>";

        return;

    }

    if(hist){

        let rows = e.measuredFrags.slice(-10).reverse();

        let html =
        "<h4>测序历史</h4>" +
        "<table class=\"exp-table\"><tr><th>片段</th><th>长度</th></tr>";

        for(let i = 0; i < rows.length; i++){

            html +=
            "<tr><td>" + rows[i].frag +
            "</td><td>" + rows[i].len +
            "</td></tr>";

        }

        html += "</table>";

        hist.innerHTML = html;

    }

}


// 实验4 测序按钮点击
function exp4MeasureClick(){

    let result =
    exp4Measure();

    let msg =
    document.getElementById(
        "exp4Msg"
    );

    if(!msg)
        return;

    if(result === "notUnlocked")
        msg.innerText = "实验尚未解锁。";
    else if(result === "noAP")
        msg.innerText = "行动点不足(测序需 " +
        format(EXPERIMENT4.measureAP) + " AP)。";
    else
        msg.innerText = "测得片段:" + result +
        "(-" + format(EXPERIMENT4.measureAP) + " AP)";

}


// 实验4 升级按钮点击
function exp4UpgradeClick(){

    let result =
    exp4Upgrade();

    let msg =
    document.getElementById(
        "exp4Msg"
    );

    if(!msg)
        return;

    if(result === "maxed")
        msg.innerText = "设备已满级。";
    else if(result === "noAP")
        msg.innerText = "行动点不足。";
    else
        msg.innerText = "设备已升级,片段长度 +1。";

}


// 实验4 提交按钮点击
function exp4SubmitClick(){

    let input =
    document.getElementById(
        "exp4Input"
    );

    if(!input)
        return;

    let result =
    exp4Submit(input.value.trim().toUpperCase());

    let msg =
    document.getElementById(
        "exp4Msg"
    );

    if(!msg)
        return;

    if(result === "notUnlocked")
        msg.innerText = "实验尚未解锁。";
    else if(result === "invalid")
        msg.innerText = "输入无效:请提交由 ATCG 组成的序列。";
    else if(result === "notFrag")
        msg.innerText = "提交无效:该序列不是 S 中的连续片段。";
    else if(result === "noAP")
        msg.innerText = "行动点不足(提交需 " +
        format(EXPERIMENT4.submitAP) + " AP)。";
    else
        msg.innerText = "提交成功!复原长度 " +
        game.experiments.exp4.bestLength +
        "(-" + format(EXPERIMENT4.submitAP) + " AP)";

    renderExperimentPage();

}


// ============================================================
// 重复完成实验系统(研究阶段3 里程碑"自动化研究"解锁)
// - 操作统计:每次测量/提交成功计数(operationCount)
// - 重新开始:重生成答案、重置完成状态与测量记录,保留升级
// - 完成次数:completions;最少操作次数 bestOperations
// 多次完成效果(实验已解锁且 completions>=2 时生效):
//   exp1: 元-力量生产 ×completions
//   exp2: 元-力量底数额外 +0.1*ln(completions)
//   exp3: 想法花费 ÷completions^10
//   exp4: 所有理论力量生产 ×completions^2
// ============================================================

// 实验对象初始化时统一补齐统计字段(兼容旧存档)
function ensureExpStats(e){

    if(!e)
        return;

    if(e.operationCount === undefined)
        e.operationCount = 0;

    if(e.completions === undefined)
        e.completions = 0;

    if(e.bestOperations === undefined)
        e.bestOperations = null;

    if(e.restarted === undefined)
        e.restarted = false;

    // 历史最佳提交(重新开始不重置,实验效果基于此保持)
    if(e.bestEver === undefined)
        e.bestEver = null;

}


// 记录一次操作(测量或提交成功时调用)
function expAddOperation(key){

    let e =
    game.experiments[key];

    if(!e)
        return;

    ensureExpStats(e);

    e.operationCount++;

}


// 成就"意义何在"的阈值:
// 某个实验的完成次数达到该值后,再手动完成一次该实验即可达成
// (完成次数主要由自动实验助手累加,故该成就要求"手动"再完成一次)
const MANUAL_EXP_ACHIEVEMENT_THRESHOLD = 1e10;


// 实验完成时调用:完成次数+1,记录最少操作次数
// 注:本函数只由玩家手动提交答案触发;自动实验助手在 research.js 中
//     直接累加 e.completions,不经过这里
function expOnComplete(key){

    let e =
    game.experiments[key];

    if(!e)
        return;

    ensureExpStats(e);

    // 成就"意义何在":该实验的完成次数已达到阈值(此时再手动完成一次)
    if(e.completions >= MANUAL_EXP_ACHIEVEMENT_THRESHOLD)
        game.manualExpAfterE10 = true;

    e.completions++;

    if(e.bestOperations === null
        || e.operationCount < e.bestOperations)
        e.bestOperations = e.operationCount;

}


// 某个实验的完成次数(显示与计算效果时向下取整;
// 底层可存小数——自动实验助手会累加小数完成次数)
function expCompletions(key){

    let e =
    game.experiments[key];

    if(!e)
        return 0;

    ensureExpStats(e);

    return Math.floor(e.completions);

}


// 该实验的最优化操作次数(自动实验助手配置;无配置返回 null)
function expOptimalOps(key){

    if(typeof ASSISTANT_LIST === "undefined")
        return null;

    for(let i = 0; i < ASSISTANT_LIST.length; i++){

        let conf =
        ASSISTANT_LIST[i];

        if(conf.expKey === key)
            return conf.optimalOps;

    }

    return null;

}


// 该实验是否"已最优化"
// 需研究阶段3(自动化研究)解锁后才显示/生效:
//   最少操作次数 ≤ 该实验的最优化操作次数
function expOptimized(key){

    if(!isMilestoneActive("stage3"))
        return false;

    let e =
    game.experiments[key];

    if(!e)
        return false;

    let opt =
    expOptimalOps(key);

    if(opt === null || opt === undefined)
        return false;

    if(e.bestOperations === null
        || e.bestOperations === undefined)
        return false;

    return e.bestOperations <= opt;

}


// 实验状态文本(HTML):状态 + "已最优化"标记(金色)
// 已最优化:研究阶段3 解锁后,最少操作次数 ≤ 该实验的最优化操作次数
function expStatusHTML(key, e, lockedLabel){

    if(!e)
        return lockedLabel || "待解锁";

    let s =
    e.completed ? "已完成" : "进行中";

    if(expOptimized(key)){

        s +=
        " <span class=\"assistant-opt\">已最优化</span>";

    }

    return s;

}


// 是否可以重新开始某实验(阶段3 里程碑 + 实验已解锁)
function canRestartExp(key){

    if(!isMilestoneActive("stage3"))
        return false;

    let e =
    game.experiments[key];

    return !!e;

}


// 重新开始某实验:重生成答案、重置完成状态/记录/统计,保留升级
function restartExp(key){

    let e =
    game.experiments[key];

    if(!e)
        return "notUnlocked";

    if(!canRestartExp(key))
        return "locked";

    ensureExpStats(e);

    // 重新生成答案(各实验独立)
    regenerateExpAnswer(key);

    // 重置完成状态与记录
    e.completed = false;
    e.measurements = [];
    e.bestResult = null;
    e.operationCount = 0;
    e.restarted = true;

    // 实验4 额外重置最长复原片段 + 测序历史
    if(key === "exp4"){
        e.bestLength = 0;
        e.bestFragment = "";
        e.measuredFrags = [];
    }

    saveGame();

    renderExperimentPage();

    return "ok";

}


// 重新生成实验答案(保留 upgrades 等升级状态)
function regenerateExpAnswer(key){

    if(key === "exp1"){

        let e = game.experiments.exp1;

        let a = 0.3 + Math.random() * 0.7;
        let b = 0.3 + Math.random() * 0.7;
        let c = 0.3 + Math.random() * 0.7;

        e.a = a;
        e.b = b;
        e.c = c;
        e.u0 = solveF1(a, b, c);

    }else if(key === "exp2"){

        let e = game.experiments.exp2;

        e.A =
        EXPERIMENT2.ampMin
        + Math.random()
        * (EXPERIMENT2.ampMax - EXPERIMENT2.ampMin);

        e.phi =
        EXPERIMENT2.phaseMin
        + Math.random()
        * (EXPERIMENT2.phaseMax - EXPERIMENT2.phaseMin);

        e.T =
        EXPERIMENT2.periodMin
        + Math.random()
        * (EXPERIMENT2.periodMax - EXPERIMENT2.periodMin);

        e.elapsed = 0;

    }else if(key === "exp3"){

        let e = game.experiments.exp3;

        let a = 0.2 + Math.random() * 0.6;
        let b = 0.2 + Math.random() * 0.6;
        let c1 = EXPERIMENT3.cMin + Math.random() * (EXPERIMENT3.cMax - EXPERIMENT3.cMin);
        let c2 = EXPERIMENT3.cMin + Math.random() * (EXPERIMENT3.cMax - EXPERIMENT3.cMin);
        let c3 = (Math.random() * 2 - 1) * EXPERIMENT3.c3Max;

        e.a = a;
        e.b = b;
        e.c1 = c1;
        e.c2 = c2;
        e.c3 = c3;

    }else if(key === "exp4"){

        let e = game.experiments.exp4;

        let seq = "";

        for(let i = 0; i < EXPERIMENT4.seqLen; i++){

            seq += EXPERIMENT4.bases[
                Math.floor(Math.random() * EXPERIMENT4.bases.length)
            ];

        }

        e.seq = seq;

    }

}


// ============================================================
// 多次完成效果(实验已解锁且 completions>=2 时生效)
// ============================================================

// exp1: 元-力量生产 × completions
function exp1CompletionBonus(){

    if(!game.experiments || !game.experiments.exp1)
        return new Decimal(1);

    let c = expCompletions("exp1");

    if(c < 2)
        return new Decimal(1);

    return new Decimal(c);

}


// exp2: 元-力量底数额外 +0.1*ln(completions)(与实验2 原效果同向)
function exp2CompletionBonus(){

    if(!game.experiments || !game.experiments.exp2)
        return 0;

    let c = expCompletions("exp2");

    if(c < 2)
        return 0;

    return 0.1 * Math.log(c);

}


// exp3: 想法花费 ÷ completions^10
function exp3CompletionDivisor(){

    if(!game.experiments || !game.experiments.exp3)
        return new Decimal(1);

    let c = expCompletions("exp3");

    // 无效果(未重复完成)
    if(c < 2)
        return new Decimal(1);

    // 想法花费 ÷ Exp3Completions^10
    // round() 修正 break_eternity 的浮点尾巴(如 3^10=59048.999…)
    return new Decimal(c).pow(10).round();

}


// exp4: 所有理论力量生产 × completions^2
function exp4CompletionBonus(){

    if(!game.experiments || !game.experiments.exp4)
        return new Decimal(1);

    let c = expCompletions("exp4");

    if(c < 2)
        return new Decimal(1);

    return new Decimal(c).pow(2);

}
