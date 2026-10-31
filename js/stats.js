// ============================================================
// 展示面板(Stats)
// 显示知识产出/理论力量/元-力量产出的加成分解,
// 帮助玩家发现主要提升来源(哪个乘区是瓶颈)。
//
// 注意:后续引入新加成时,记得在这里同步补充对应条目。
// 所有数值直接复用现有的公式函数,不重复计算。
// ============================================================


// 结构签名:解锁理论数/里程碑/效果解锁变化时重建 DOM
// (数值变化只更新文本,不重建,保持 details 展开状态)
let lastStatsKey = "";


// ---- 折叠状态保持 ----
// 结构签名一变(例如完成研究把研究阶段清零,里程碑行跟着增减)就会重建
// innerHTML,重建后所有 <details> 都会回到默认的收起状态,玩家正看着的
// 条目会"自己合上"。这里在重建前记下哪些分组是展开的,重建后补回来。
// 用 summary 的标签文本(冒号前的部分)当键 —— 冒号后是实时数值,不能用。
function statsDetailsKey(summary){

    if(!summary)
        return "";

    let t =
    summary.textContent || "";

    let i =
    t.indexOf(":");

    if(i < 0)
        i = t.indexOf("：");

    return (i > 0 ? t.slice(0, i) : t).trim();

}


// 记录展开的分组
function captureStatsOpen(box){

    let open = {};

    if(!box || !box.querySelectorAll)
        return open;

    let list =
    box.querySelectorAll("details");

    for(let i = 0; i < list.length; i++){

        if(!list[i].open)
            continue;

        let k =
        statsDetailsKey(
            list[i].querySelector
            ? list[i].querySelector("summary")
            : null);

        if(k)
            open[k] = true;

    }

    return open;

}


// 恢复展开的分组
function restoreStatsOpen(box, open){

    if(!box || !open || !box.querySelectorAll)
        return;

    let list =
    box.querySelectorAll("details");

    for(let i = 0; i < list.length; i++){

        let k =
        statsDetailsKey(
            list[i].querySelector
            ? list[i].querySelector("summary")
            : null);

        if(k && open[k])
            list[i].open = true;

    }

}

function statsKey(){

    let unlocked = 0;

    for(let id in game.theories){
        if(game.theories[id].unlocked)
            unlocked++;
    }

    return [
        unlocked,
        isMilestoneActive("stage1") ? 1 : 0,
        isMilestoneActive("stage2") ? 1 : 0,   // 跨学科研究:行动点获取新增一行
        isMilestoneActive("stage4") ? 1 : 0,   // 前沿研究:知识产出新增一行
        isMilestoneActive("stage9") ? 1 : 0,   // 无尽阶梯:助手速率新增一行
        summaryUnlocked() ? 1 : 0,             // 摘要:知识边界倍率行
        introEffectsEnabled() ? 1 : 0,         // 引言:效果5(助手速率)/效果6(行动点)/效果7(知识边界)
        paperOwned("innovation") ? 1 : 0,      // 注重创新:知识产出新增一行
        paperOwned("experimentOriented") ? 1 : 0, // 实验导向:助手速率新增一行
        paperOwned("refLegacyTheory") ? 1 : 0,    // 引用旧理论:知识产出新增一行
        paperOwned("refTheory6") ? 1 : 0,         // 引用理论6:知识产出新增一行
        paperOwned("refExperiment") ? 1 : 0,      // 引用实验成果:行动点获取新增一行
        isEffectUnlocked("metaGain") ? 1 : 0,
        game.ideas >= 4 ? 1 : 0,  // 升级倍率效果影响理论力量分解
        (game.theories.theory6 && game.theories.theory6.unlocked) ? 1 : 0,  // 拓展理论:新增一行
        ownTheoryUnlocked() ? 1 : 0,           // 你的理论:知识产出新增一行
        theoremUpgradeOwned("propagateI") ? 1 : 0,  // 推广理论I:元-力量产出新增一行
        theoremUpgradeOwned("propagateII") ? 1 : 0, // 推广理论II:行动点获取新增一行
        ownTheoryTimePower() ? 1 : 0,          // 时光之力:T(t) 行
        originUpgradeActive("knowledgeExpand") ? 1 : 0,  // 知识扩充:知识边界新增一行
        originUpgradeActive("expBaseBoost") ? 1 : 0,     // 底数提升2:助手速率新增一行
        originUnlocked() ? 1 : 0,                        // 本源获取:整个分组
        originMilestoneActive(30) ? 1 : 0,               // 无尽阶梯II:本源获取新增一行
        originUpgradeActive("deepOrigin") ? 1 : 0        // 深入本源:本源获取新增一行
    ].join(":");

}


// 绘制展示面板(增量更新)
function renderStatsPage(){

    let panel =
    document.getElementById(
        "statsPanel"
    );

    if(!panel)
        return;

    let key = statsKey();

    if(key !== lastStatsKey){

        lastStatsKey = key;

        // 重建会收起所有分组,先把展开状态抓下来
        let open =
        captureStatsOpen(panel);

        panel.innerHTML =
        buildStatsHTML();

        restoreStatsOpen(panel, open);

    }

    updateStatVals();

}


// 生成面板 HTML(折叠结构,默认不展开)
function buildStatsHTML(){

    let html = "";

    // ---------- 知识产出 ----------
    html +=
    '<details class="stat-group">' +
    '<summary>知识产出:<span class="stat-val" data-key="kps"></span>/s</summary>' +
    '<div class="stat-line">基础值:1/s</div>';

    for(let id in game.theories){

        let t =
        game.theories[id];

        if(!t.unlocked)
            continue;

        html +=
        '<div class="stat-line">' +
        id.replace("theory", "理论") +
        '力量:×<span class="stat-val" data-key="tp_' + id + '"></span></div>';

    }

    if(isMilestoneActive("stage1")){
        html +=
        '<div class="stat-line">研究加成(阶段1):×<span class="stat-val" data-key="resKnow"></span></div>';
    }

    // 里程碑 stage4(前沿研究):知识获取 ×(1+累计行动点)
    // (公式细节不在此展示,面板只显示结果值)
    if(isMilestoneActive("stage4")){
        html +=
        '<div class="stat-line">研究加成(阶段4·前沿研究):×<span class="stat-val" data-key="resKnow4"></span></div>';
    }

    // 知识边界(软上限):显示知识生产被除以的倍数(= 原始速度 / 受限后速度)
    html +=
    '<div class="stat-line">知识边界:÷<span class="stat-val" data-key="knowledgeCap"></span></div>';

    // 论文升级"摘要":知识边界倍率与当前边界值(未购买时 ×1 / 基础值)
    html +=
    '<div class="stat-line">知识边界倍率(摘要):×<span class="stat-val" data-key="summaryMult"></span></div>';

    // 元-力量效果7(引言):知识边界 ×sqrt(1+MetaPower)
    if(introEffectsEnabled()){
        html +=
        '<div class="stat-line">元-力量效果7(知识边界):×<span class="stat-val" data-key="metaEff7"></span></div>';
    }

    // 本源升级"知识扩充":知识边界 ×1e50^等级
    if(originUpgradeActive("knowledgeExpand")){
        html +=
        '<div class="stat-line">本源·知识扩充:×<span class="stat-val" data-key="expandMult"></span></div>';
    }

    html +=
    '<div class="stat-line">当前知识边界:<span class="stat-val" data-key="limitVal"></span>/s</div>';

    // 论文升级"注重创新":灵感提升知识获取(未购买时 ×1)
    if(paperOwned("innovation")){
        html +=
        '<div class="stat-line">论文·注重创新:×<span class="stat-val" data-key="innovBonus"></span></div>';
    }

    // 本源层"你的理论":知识获取 ×Effect(完成过研究后才生效)
    if(ownTheoryUnlocked()){
        html +=
        '<div class="stat-line">你的理论:×<span class="stat-val" data-key="ownTheoryK"></span></div>';
    }

    // 你的理论·时光之力:Effect 再 ×T(t)
    if(ownTheoryTimePower()){
        html +=
        '<div class="stat-line">你的理论·时光之力 T(t):×<span class="stat-val" data-key="ownTheoryT"></span></div>';
    }

    // 论文"参考文献"系列(第6行):提高理论乘积的指数
    // 只显示"相对于原指数"的额外倍率(原指数为 1,故 = 乘积^0.1 / 乘积^0.3)
    if(paperOwned("refLegacyTheory")){
        html +=
        '<div class="stat-line">论文·引用旧理论(理论1~5^1.1):×<span class="stat-val" data-key="refLegacyMult"></span></div>';
    }

    if(paperOwned("refTheory6")){
        html +=
        '<div class="stat-line">论文·引用理论6(理论6^1.3):×<span class="stat-val" data-key="refT6Mult"></span></div>';
    }

    html += '</details>';

    // ---------- 理论力量 ----------
    html +=
    '<details class="stat-group">' +
    '<summary>理论力量</summary>';

    for(let id in game.theories){

        let t =
        game.theories[id];

        if(!t.unlocked)
            continue;

        html +=
        '<details class="stat-sub">' +
        '<summary>' +
        id.replace("theory", "理论") +
        '力量产出:<span class="stat-val" data-key="tg_' + id + '"></span>/s</summary>' +
        '<div class="stat-line">基础值:0.1/s</div>' +
        '<div class="stat-line">理论升级:×<span class="stat-val" data-key="rateNum_' + id + '"></span>^<span class="stat-val" data-key="levelNum_' + id + '"></span> = <span class="stat-val" data-key="rate_' + id + '"></span></div>' +
        '<div class="stat-line">元-力量:×(1+<span class="stat-val" data-key="mpNum_' + id + '"></span>)^<span class="stat-val" data-key="exp1Num_' + id + '"></span> = <span class="stat-val" data-key="meta_' + id + '"></span></div>';

        // 重复完成实验4:理论力量 ×completions²(融入各理论力量)
        html +=
        '<div class="stat-line">重复实验4加成:×<span class="stat-val" data-key="exp4Mult"></span>(完成 <span class="stat-val" data-key="exp4C"></span> 次)</div>';

        if(isMilestoneActive("stage1")){
            html +=
            '<div class="stat-line">研究加成(阶段1):×<span class="stat-val" data-key="res_' + id + '"></span></div>';
        }

        html += '</details>';

    }

    html += '</details>';

    // ---------- 元-力量产出 ----------
    html +=
    '<details class="stat-group">' +
    '<summary>元-力量产出:<span class="stat-val" data-key="mpg"></span>/s</summary>' +
    '<div class="stat-line">基础值:0.1/s</div>' +
    '<div class="stat-line">想法:×<span class="stat-val" data-key="mpBaseNum"></span>^(<span class="stat-val" data-key="mpIdeasNum"></span>-1) = <span class="stat-val" data-key="mpbase"></span></div>';

    // 重复完成实验2:底数额外 +0.1ln(融入想法/底数)
    html +=
    '<div class="stat-line">重复实验2加成:底数额外 +<span class="stat-val" data-key="exp2Add"></span>(完成 <span class="stat-val" data-key="exp2C"></span> 次)</div>';

    if(isEffectUnlocked("metaGain")){
        html +=
        '<div class="stat-line">元-力量效果3:×<span class="stat-val" data-key="mpgain"></span></div>';
    }

    // 重复完成实验1:元-力量生产 ×completions(融入元-力量产出)
    html +=
    '<div class="stat-line">重复实验1加成:×<span class="stat-val" data-key="exp1Mult"></span>(完成 <span class="stat-val" data-key="exp1C"></span> 次)</div>';

    // 本源层"你的理论":买了「推广理论I」后,元-力量获取 ×Effect
    if(theoremUpgradeOwned("propagateI")){
        html +=
        '<div class="stat-line">你的理论(推广理论I):×<span class="stat-val" data-key="ownTheoryMP"></span></div>';
    }

    html += '</details>';

    // ---------- 想法价格(实验3 效果:价格膨胀起始点延后) ----------
    html +=
    '<details class="stat-group">' +
    '<summary>想法价格</summary>' +
    '<div class="stat-line">下个想法价格:<span class="stat-val" data-key="ideaCostVal"></span></div>' +
    '<div class="stat-line">价格膨胀起始点 N:<span class="stat-val" data-key="ideaN"></span>(基础 10 + 实验3效果 <span class="stat-val" data-key="exp3EffectVal"></span>)</div>' +
    // 重复完成实验3:想法花费 ÷completions^10(融入想法价格)
    '<div class="stat-line">重复实验3加成:想法花费 ÷<span class="stat-val" data-key="exp3Div"></span>(完成 <span class="stat-val" data-key="exp3C"></span> 次)</div>' +
    '</details>';

    // ---------- 理论升级价格(实验4 效果:膨胀起始点延后) ----------
    // N 取理论1 的实际配置(getTheoryPrice),非全局默认值
    let t1N = getTheoryPrice("theory1").N;
    html +=
    '<details class="stat-group">' +
    '<summary>理论升级价格</summary>' +
    '<div class="stat-line">理论1升级价格:<span class="stat-val" data-key="tUpCost1"></span></div>' +
    '<div class="stat-line">理论1价格膨胀起始等级 N:<span class="stat-val" data-key="tUpN"></span>(基础 ' + t1N + ' + 实验4效果 <span class="stat-val" data-key="exp4EffectVal"></span>)</div>' +
    '</details>';

    // ---------- 行动点获取 ----------
    // 基础值只由知识决定;再乘里程碑 stage2 与元-力量效果6
    html +=
    '<details class="stat-group">' +
    '<summary>行动点获取:<span class="stat-val" data-key="apGain"></span>/次</summary>' +
    '<div class="stat-line">基础值:<span class="stat-val" data-key="apBase"></span>(由知识计算)</div>';

    // 元-力量效果6(引言):行动点获取 ×(1+MetaPower)^0.1
    if(introEffectsEnabled()){
        html +=
        '<div class="stat-line">元-力量效果6:×<span class="stat-val" data-key="metaEff6"></span></div>';
    }

    // 研究里程碑 stage2(跨学科研究):行动点获取 ×2^(研究阶段-1)
    if(isMilestoneActive("stage2")){
        html +=
        '<div class="stat-line">研究阶段2里程碑:×<span class="stat-val" data-key="apStage2"></span>' +
        '(研究阶段 <span class="stat-val" data-key="apStageNum"></span>)</div>';
    }

    // 论文"参考文献-引用实验成果":公式指数 0.05 → 0.06
    if(paperOwned("refExperiment")){
        html +=
        '<div class="stat-line">获取公式指数:<span class="stat-val" data-key="apExp"></span>' +
        '(基础 <span class="stat-val" data-key="apExpBase"></span> + 论文·引用实验成果)</div>';
    }

    // 本源层"你的理论":买了「推广理论II」后,行动点获取 ×Effect
    if(theoremUpgradeOwned("propagateII")){
        html +=
        '<div class="stat-line">你的理论(推广理论II):×<span class="stat-val" data-key="ownTheoryAP"></span></div>';
    }

    html += '</details>';

    // ---------- 本源获取 ----------
    // 公式:((累计行动点 + 本次研究重置可获得行动点)/1e80)^(1/40)
    //       × 研究阶段加成 × 无尽阶梯II × 深入本源,最后取整
    // 未解锁本源层的存档行动点总量远小于 1e80(恒为 0),整个分组不显示
    if(originUnlocked()){

        html +=
        '<details class="stat-group">' +
        '<summary>本源获取:<span class="stat-val" data-key="originGainVal"></span>/次</summary>' +
        '<div class="stat-line">基础值:<span class="stat-val" data-key="originGainBase"></span>(由行动点计算)</div>' +
        '<div class="stat-line">研究阶段加成:×<span class="stat-val" data-key="originGainStage"></span>' +
        '(研究阶段 <span class="stat-val" data-key="originGainStageNum"></span>)</div>';

        // 本源里程碑"无尽阶梯II"(完成 30 次研究):× (1 + 完成次数/30)
        if(originMilestoneActive(30)){
            html +=
            '<div class="stat-line">无尽阶梯II:×<span class="stat-val" data-key="originGainStair"></span>' +
            '(完成研究 <span class="stat-val" data-key="originGainStairN"></span> 次)</div>';
        }

        // 本源升级"深入本源":×2^等级
        if(originUpgradeActive("deepOrigin")){
            html +=
            '<div class="stat-line">深入本源:×<span class="stat-val" data-key="originGainDeep"></span>' +
            '(等级 <span class="stat-val" data-key="originGainDeepLv"></span>)</div>';
        }

        html += '</details>';

    }

    // 实验完成次数生产速率(自动实验助手)
    html +=
    '<details class="stat-group">' +
    '<summary>实验完成次数生产速率</summary>' +
    '<div class="stat-line">实验1:<span class="stat-val" data-key="expAutoRate1"></span>/s</div>' +
    '<div class="stat-line">实验2:<span class="stat-val" data-key="expAutoRate2"></span>/s</div>' +
    '<div class="stat-line">实验3:<span class="stat-val" data-key="expAutoRate3"></span>/s</div>' +
    '<div class="stat-line">实验4:<span class="stat-val" data-key="expAutoRate4"></span>/s</div>';

    // 元-力量效果5(引言):实验助手速度 ×(1+MetaPower)^0.05
    if(introEffectsEnabled()){
        html +=
        '<div class="stat-line">元-力量效果5:×<span class="stat-val" data-key="metaEff5"></span></div>';
    }

    // 论文升级"实验导向":实验助手速度 ×(1+实验完成次数总和)^0.2
    if(paperOwned("experimentOriented")){
        html +=
        '<div class="stat-line">论文·实验导向:×<span class="stat-val" data-key="expOrBonus"></span>' +
        '(完成次数总和 <span class="stat-val" data-key="expTotal"></span>)</div>';
    }

    // 研究里程碑"无尽阶梯"(阶段9):实验助手速度 ×(1+研究重置次数/30)
    if(isMilestoneActive("stage9")){
        html +=
        '<div class="stat-line">里程碑·无尽阶梯:×<span class="stat-val" data-key="endlessStair"></span>' +
        '(研究重置 <span class="stat-val" data-key="endlessResets"></span> 次)</div>';
    }

    // 本源升级"底数提升2":自动实验助手每级的加成底数
    if(originUpgradeActive("expBaseBoost")){
        html +=
        '<div class="stat-line">本源·底数提升2:每级 ×<span class="stat-val" data-key="expBaseVal"></span></div>';
    }

    html += '</details>';

    return html;

}


// 更新所有数值文本
function updateStatVals(){

    // 知识产出
    setStat("kps", getKnowledgeSpeed());

    for(let id in game.theories){

        let t =
        game.theories[id];

        if(!t.unlocked)
            continue;

        setStat("tp_" + id, t.power);

    }

    if(isMilestoneActive("stage1"))
        setStat("resKnow", researchPowerBonus());

    // 里程碑 stage4(前沿研究):知识获取 ×(1+累计行动点)
    if(isMilestoneActive("stage4"))
        setStat("resKnow4", frontierResearchBonus());

    // 知识边界:软上限使知识生产除以的倍数(原始速度/受限后速度,未超限=1)
    setStat("knowledgeCap", knowledgeCapDivisor());

    // 论文升级"摘要":知识边界倍率与当前知识边界值
    setStat("summaryMult", summaryBoundaryBonus());
    setStat("limitVal", knowledgeLimit());

    // 本源升级"知识扩充":知识边界倍率
    if(originUpgradeActive("knowledgeExpand"))
        setStat("expandMult", knowledgeExpandMult());

    // 论文升级"注重创新":知识获取倍率
    if(paperOwned("innovation"))
        setStat("innovBonus", innovationBonus());

    // 本源层"你的理论":知识 / 元-力量 / 行动点三处倍率
    if(ownTheoryUnlocked()){
        setStat("ownTheoryK", ownTheoryEffect());
        setStat("ownTheoryT", ownTheoryTimeMult());
    }

    if(theoremUpgradeOwned("propagateI"))
        setStat("ownTheoryMP", ownTheoryMetaEffect());

    if(theoremUpgradeOwned("propagateII"))
        setStat("ownTheoryAP", ownTheoryAPEffect());

    // 论文"参考文献-引用旧理论":理论1~5^1.1 带来的额外倍率(= 乘积^0.1)
    if(paperOwned("refLegacyTheory"))
        setStat("refLegacyMult", theoryProductLegacy().pow(0.1));

    // 论文"参考文献-引用理论6":理论6^1.3 带来的额外倍率(= 理论6^0.3)
    if(paperOwned("refTheory6"))
        setStat("refT6Mult", theoryProduct6().pow(0.3));

    // 论文"参考文献-引用实验成果":行动点公式指数
    if(paperOwned("refExperiment")){
        setStat("apExp", researchActionExp());
        setStat("apExpBase", RESEARCH_CONFIG.actionExp);
    }

    // 行动点获取:最终值 / 基础值 / 里程碑 stage2 倍率
    setStat("apGain", actionPointsGain());
    setStat("apBase", actionPointsBase());

    // 本源获取:最终值 / 基础值(由行动点计算) / 研究阶段加成
    if(originUnlocked()){
        setStat("originGainVal", originGain());
        setStat("originGainBase", originGainBase());
        setStat("originGainStage", originGainStageMult());
        setStat("originGainStageNum", game.researchStage || 0);
    }

    // 本源里程碑"无尽阶梯II"
    if(originMilestoneActive(30)){
        setStat("originGainStair", originStaircaseBonus());
        setStat("originGainStairN", originResets());
    }

    // 本源升级"深入本源"
    if(originUpgradeActive("deepOrigin")){
        setStat("originGainDeep", deepOriginMult());
        setStat("originGainDeepLv", originUpgradeLevel("deepOrigin"));
    }

    if(isMilestoneActive("stage2")){
        setStat("apStage2", actionPointsStageMultiplier());
        setStat("apStageNum", game.researchStage);
    }

    // 理论力量
    for(let id in game.theories){

        let t =
        game.theories[id];

        if(!t.unlocked)
            continue;

        setStat("tg_" + id, theoryPowerGain(id));

        let rate =
        isEffectUnlocked("upgradeRate")
        ? metaUpgradeRate()
        : new Decimal(2);

        // 理论升级:具体 rate 与 level
        setStat("rateNum_" + id, rate);
        setStat("levelNum_" + id, t.level);
        setStat("rate_" + id, Decimal.pow(rate, t.level));

        // 元-力量:具体 metaPower 与 exp1Exponent
        setStat("mpNum_" + id, game.metaPower);
        setStat("exp1Num_" + id, exp1Exponent());
        setStat("meta_" + id, metaPowerBonus());

        if(isMilestoneActive("stage1"))
            setStat("res_" + id, researchPowerBonus());

    }

    // 元-力量产出
    setStat("mpg", metaPowerGain());

    // 想法:具体 exp2Base() 与 ideas 数
    setStat("mpBaseNum", exp2Base());
    setStat("mpIdeasNum", game.ideas);
    setStat(
        "mpbase",
        Decimal.pow(
            exp2Base(),
            Math.max(game.ideas - 1, 0)
        )
    );

    if(isEffectUnlocked("metaGain"))
        setStat("mpgain", metaGainBonus());

    // 元-力量效果5~7(引言;未达对应想法数时倍率为 1)
    // 效果5 → 实验完成次数生产速率组;效果6 → 行动点获取组;效果7 → 知识产出组
    if(introEffectsEnabled()){
        setStat("metaEff5", metaExpAssistantBonus());
        setStat("metaEff6", metaAPBonus());
        setStat("metaEff7", metaBoundaryBonus());
    }

    // 想法价格
    setStat("ideaCostVal", ideaCost());
    setStat("ideaN", IDEA_PRICE.N + exp3Effect());
    setStat("exp3EffectVal", exp3Effect());

    // 理论升级价格(实验4)
    setStat("tUpCost1", theoryUpgradeCost("theory1"));
    setStat("tUpN", getTheoryPrice("theory1").N + exp4Effect());
    setStat("exp4EffectVal", exp4Effect());

    // 重复完成实验加成(显示实际效果值)
    setStat("exp1C", expCompletions("exp1"));
    setStat("exp1Mult", exp1CompletionBonus());
    setStat("exp2C", expCompletions("exp2"));
    setStat("exp2Add", exp2CompletionBonus());
    setStat("exp3C", expCompletions("exp3"));
    setStat("exp3Div", exp3CompletionDivisor());
    setStat("exp4C", expCompletions("exp4"));
    setStat("exp4Mult", exp4CompletionBonus());

    // 实验完成次数生产速率(自动实验助手)
    setStat("expAutoRate1", expAutoRate("expAuto1"));
    setStat("expAutoRate2", expAutoRate("expAuto2"));
    setStat("expAutoRate3", expAutoRate("expAuto3"));
    setStat("expAutoRate4", expAutoRate("expAuto4"));

    // 论文升级"实验导向"
    if(paperOwned("experimentOriented")){
        setStat("expTotal", totalExpCompletions());
        setStat("expOrBonus", experimentOrientedBonus());
    }

    // 研究里程碑"无尽阶梯"(阶段9)
    if(isMilestoneActive("stage9")){
        setStat("endlessStair", endlessStaircaseBonus());
        setStat("endlessResets", endlessStaircaseResets());
    }

    // 本源升级"底数提升2":每级加成底数
    if(originUpgradeActive("expBaseBoost"))
        setStat("expBaseVal", expAssistantBase());

}


// ============================================================
// 游戏统计(Game Stats) —— 统计页"游戏统计"子页
// 生涯累计数据,部分行按游戏进度解锁显示:
//   基础   : 游戏时间 / 累计生产知识(开局即显示)
//   想法解锁后 : 累计获得想法 / 历史最高想法
//   研究解锁后 : 累计获得行动点 / 研究重置次数
//   研究重置后 : 最快研究重置用时
//   研究阶段3后: 实验完成总次数
//   解锁本源后 : 完成研究次数 / 累计本源
// ⚠ 以上解锁都是"永久"的:登记在 game.permaUnlocks,
//   完成研究把想法 / 研究阶段清零后,这些条目不会跟着消失。
// ============================================================

// 组可见签名(想法/研究/最快重置/阶段3/本源),变化时重建 DOM
let lastGameStatsKey = "";

function gameStatsKey(){

    return [
        permaUnlock("idea") ? 1 : 0,
        permaUnlock("research") ? 1 : 0,
        permaUnlock("reset1") ? 1 : 0,
        permaUnlock("stage3") ? 1 : 0,
        // 第 5 段:完成过研究后,累计行动点改为"本次研究"口径
        (typeof originResets === "function" && originResets() >= 1) ? 1 : 0,
        // 第 6 段:解锁本源层 → 显示完成研究次数 / 累计本源
        permaUnlock("origin") ? 1 : 0
    ].join(":");

}


// 格式化游戏时间(秒 → 天/时/分/秒)
function formatGameTime(sec){

    sec = Math.max(0, Math.floor(sec));

    let d = Math.floor(sec / 86400);
    let h = Math.floor((sec % 86400) / 3600);
    let m = Math.floor((sec % 3600) / 60);
    let s = sec % 60;

    if(d > 0)
        return d + " 天 " + h + " 小时 " + m + " 分";

    if(h > 0)
        return h + " 小时 " + m + " 分 " + s + " 秒";

    if(m > 0)
        return m + " 分 " + s + " 秒";

    return s + " 秒";

}


// 绘制游戏统计(每 tick 调用;组状态变化才重建)
function renderGameStats(){

    let panel =
    document.getElementById(
        "statsGamePanel"
    );

    if(!panel)
        return;

    let key = gameStatsKey();

    let parts = key.split(":");

    let showIdea =
    parts[0] === "1";

    let showResearch =
    parts[1] === "1";

    // 最快研究重置用时:完成第一次研究重置后显示
    let showFastest =
    parts[2] === "1";

    let showStage3 =
    parts[3] === "1";

    // 完成过研究:累计行动点会随本源重置清零,文案改为"本次研究中"
    let showOrigin =
    parts[4] === "1";

    // 解锁本源层:完成研究次数 / 累计本源
    let showOriginStats =
    parts[5] === "1";

    if(key !== lastGameStatsKey){

        lastGameStatsKey = key;

        let html =
        '<div class="game-stat">你一共玩了<span class="stat-val gs-time"></span>(游戏时间)</div>' +
        '<div class="game-stat">你一共生产了<span class="stat-val gs-produced"></span>知识</div>';

        if(showIdea){
            html +=
            '<div class="game-stat">你累计获得了<span class="stat-val gs-totalideas"></span>想法</div>' +
            '<div class="game-stat">你的历史最高想法数是<span class="stat-val gs-maxideas"></span></div>';
        }

        if(showResearch){
            // 完成过一次研究后,累计行动点每轮都会清零 →
            // 文案改成"在本次研究中"
            html +=
            '<div class="game-stat">' +
            (showOrigin
                ? "在本次研究中，你累计获得了"
                : "你累计获得了") +
            '<span class="stat-val gs-totalap"></span>行动点</div>' +
            // 这里的次数是原始值,不含"真·无尽阶梯"等加成
            // (其它地方(里程碑/助手/成就)用的都是 effectiveResearchResets())
            '<div class="game-stat">你一共进行了<span class="stat-val gs-resets"></span>次研究重置（不计入加成）</div>';
        }

        if(showFastest){
            html +=
            '<div class="game-stat">最快的研究重置用时<span class="stat-val gs-fastest"></span></div>';
        }

        if(showStage3){
            html +=
            '<div class="game-stat">所有实验合计已完成<span class="stat-val gs-expall"></span>次</div>';
        }

        if(showOriginStats){
            html +=
            '<div class="game-stat">你一共完成了<span class="stat-val gs-originresets"></span>次研究</div>' +
            '<div class="game-stat">你累计获得了<span class="stat-val gs-totalorigin"></span>本源</div>';
        }

        panel.innerHTML = html;

    }

    // 数值更新
    let set = function(sel, val){
        let el =
        panel.querySelector(
            sel
        );
        if(el && el.innerText !== String(val))
            el.innerText = String(val);
    };

    set(".gs-time", formatGameTime(game.totalTime || 0));
    set(".gs-produced", format(
        game.totalKnowledgeProduced || 0
    ));

    if(showIdea){
        set(".gs-totalideas", game.totalIdeas || 0);
        set(".gs-maxideas", game.maxIdeas || 0);
    }

    if(showResearch){
        set(".gs-totalap", format(
            game.totalResearchPoints || 0
        ));
        set(".gs-resets", game.researchResets || 0);
    }

    if(showFastest){
        let fastest =
        (game.fastestResearchReset === null
            || game.fastestResearchReset === undefined)
        ? "-"
        : formatGameTime(game.fastestResearchReset);
        set(".gs-fastest", fastest);
    }

    if(showStage3){
        set(".gs-expall", format(totalExpCompletions()));
    }

    if(showOriginStats){
        set(".gs-originresets", originResets());
        // 累计获得的本源(不扣购买消耗)
        set(".gs-totalorigin", format(totalOrigin()));
    }

}


// 四个实验完成次数总和(自动实验助手/重复完成累计;未解锁实验为 0)
function totalExpCompletions(){

    let total = 0;

    for(let i = 1; i <= 4; i++)
        total += expCompletions("exp" + i);

    return total;

}


// 设置某个数值文本
function setStat(key, val){

    let els =
    document.querySelectorAll(
        '.stat-val[data-key="' + key + '"]'
    );

    for(let i = 0; i < els.length; i++){

        if(els[i])
            els[i].innerText = format(val);

    }

}
