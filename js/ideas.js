// ============================================================
// 想法系统(Ideas)
// 达到 1e6 知识后可重置,获得 1 个"想法"(声望机制)。
// 第 x 个想法的价格 = 10^f(x, A, B, N),其中:
//   f(x, a, b, n) = a*x + b*max(x-n, 0)^2
//   x 从 1 开始(第 1 个想法 x=1 → 10^A)
//   低想法数按指数增长,超过 N 个想法后叠加二次项变陡,
//   抑制后期想法推进过快。
// 基于想法数量产生"元-力量"(MetaPower):
//   速度 = 0.1 * 底数^(ideas-1) /秒(默认底数 2)
//   实验2 完成后按最佳提交偏差,底数提升为 2.2~3.0(见 exp2Base)
// 元-力量效果(解锁点统一在 META_EFFECTS 配置,不硬编码):
//   效果1(默认):所有理论力量生产速度 ×(1 + metaPower)
//   效果2(需 4 想法):升级倍率从 2 提升为 2 + 0.2*ln(MetaPower+1)
//   效果3(需 7 想法):元-力量获取速度 ×(1 + metaPower)^(1/4)
//   效果4(需 10 想法):想法花费 ÷(1 + metaPower)
// ============================================================


// ============================================================
// 想法价格参数(调整这里即可改变想法价格曲线)
// Price(第 x 个想法) = 10^f(x, A, B, N)
// x 从 1 开始:第 1 个想法 x=1 → 10^A
// ============================================================
const IDEA_PRICE = {
    A: 6,   // 线性指数系数(第 1 个想法 = 10^6,与原版一致)
    B: 1,   // 二次项系数:超过 N 个想法后价格加速增长
    N: 10   // 二次项生效的起始想法数(x > N 后开始加速)
};


// 元-力量效果列表(按解锁想法数排序)
// key: 效果唯一标识(供代码判断是否解锁)
// unlockIdeas: 需要达到的想法数
// name: 效果名称
// desc: 效果说明
const META_EFFECTS = [
    {
        key: "powerBonus",
        unlockIdeas: 0,
        name: "力量加成",
        desc: "所有理论力量生产速度 ×(1 + MetaPower)"
    },
    {
        key: "upgradeRate",
        unlockIdeas: 4,
        name: "升级倍率提升",
        desc: "升级倍率提升为 2 + 0.2·ln(MetaPower+1)"
    },
    {
        key: "metaGain",
        unlockIdeas: 7,
        name: "元-力量增幅",
        desc: "元-力量获取速度 ×(1 + MetaPower)^(1/4)"
    },
    {
        key: "costReduce",
        unlockIdeas: 10,
        name: "想法花费减免",
        desc: "下个想法花费 ÷(1 + MetaPower)"
    }
];


// 判断某个效果是否已解锁(按 key 查配置,解锁点由 META_EFFECTS 统一控制)
function isEffectUnlocked(key){

    for(let i = 0; i < META_EFFECTS.length; i++){

        let e = META_EFFECTS[i];

        if(e.key === key)
            return game.ideas >= e.unlockIdeas;

    }

    return false;

}


// ============================================================
// 元-力量效果公式(统一入口,避免在多处重复计算)
// ============================================================

// 效果1 的元-力量加成倍率:含实验指数
// (1+MetaPower)^exp1Exponent()
// 实验1 的"无"档(含未提交)提供 ^1.1 保底;提交后 1.1~1.5
function metaPowerBonus(){
    return Decimal.pow(
        new Decimal(1).add(game.metaPower),
        exp1Exponent()
    );
}


// 效果2 的升级倍率:2 + 0.2 * ln(MetaPower + 1)
function metaUpgradeRate(){
    return new Decimal(2)
    .add(
        new Decimal(0.2)
        .mul(
            game.metaPower
            .add(1)
            .ln()
        )
    );
}


// 效果3 的元-力量获取倍率:(1+MetaPower)^(1/4)
// 与实验无关,直接构造,不嵌套 metaPowerBonus(避免双重指数)
// 注意:指数 1/4 为用户调整后的数值(原 1/3),以代码为准
function metaGainBonus(){
    return Decimal.pow(
        new Decimal(1).add(game.metaPower),
        1/4
    );
}


// 当前生效的元-力量效果描述(带数值)
function metaEffectDesc(effect){

    if(effect.key === "powerBonus"){
        return "所有理论力量生产速度 ×" +
        format(metaPowerBonus());
    }

    if(effect.key === "upgradeRate"){
        return "升级倍率 = " +
        format(metaUpgradeRate());
    }

    if(effect.key === "metaGain"){
        return "元-力量获取速度 ×" +
        format(metaGainBonus());
    }

    if(effect.key === "costReduce"){
        return "想法花费 ÷" +
        format(new Decimal(1).add(game.metaPower));
    }

    return effect.desc;

}


// 绘制元-力量效果列表(增量渲染:仅在想法数变化时重建)
let lastEffectIdeas = -1;

function renderMetaEffects(){

    let box =
    document.getElementById(
        "metaEffects"
    );

    if(!box)
        return;

    // 想法数没变 → 不重建,只更新数值文本
    if(lastEffectIdeas === game.ideas){

        let vals =
        box.querySelectorAll(".effect-val");

        for(let i = 0; i < vals.length; i++){

            let el = vals[i];

            let eid = Number(el.dataset.effectId);

            if(!META_EFFECTS[eid])
                continue;

            el.innerText =
            metaEffectDesc(META_EFFECTS[eid]);

        }

        return;

    }

    lastEffectIdeas = game.ideas;

    box.innerHTML = "";

    let nextUnlock = null;

    for(let i = 0; i < META_EFFECTS.length; i++){

        let e = META_EFFECTS[i];

        let div =
        document.createElement("div");

        div.className = "meta-effect";

        if(game.ideas >= e.unlockIdeas){

            // 已解锁:名称 + 数值
            div.dataset.unlocked = "1";

            div.innerHTML =
            "<span class=\"effect-name\">" + e.name + "</span>" +
            "<span class=\"effect-val\" data-effect-id=\"" + i + "\">" +
            metaEffectDesc(e) +
            "</span>";

            box.appendChild(div);

        }else{

            // 未解锁:只对第一个未解锁效果显示提示行
            if(!nextUnlock){

                nextUnlock = e;

                div.className = "meta-effect locked";

                div.innerHTML =
                "<span class=\"effect-lock\">达到 " +
                e.unlockIdeas +
                " 想法以解锁下一个效果</span>";

                box.appendChild(div);

            }

            // 其余未解锁效果跳过(避免空框)

        }

    }

}


// 获得下一个想法的价格:10^f(x, A, B, N)
// x = 当前想法数 + 1(下一个想法的序号,从 1 开始)
// f(x) = A*x + B*max(x-N, 0)^2
// N 为基础值 IDEA_PRICE.N + 实验3 效果(exp3Effect,想法价格膨胀起始点延后)
// 效果4(costReduce)解锁后:价格 ÷(1 + MetaPower)
function ideaCost(){

    // 下一个想法的序号:第 1 个想法 x=1
    let x =
    game.ideas + 1;

    // 价格指数 f(x)
    let over =
    Math.max(x - (IDEA_PRICE.N + exp3Effect()), 0);

    let exp =
    IDEA_PRICE.A * x
    + IDEA_PRICE.B * over * over;

    let base =
    Decimal.pow(
        10,
        exp
    );

    // 效果4:下个想法花费 ÷(1 + MetaPower)
    // 使用原始 1+MetaPower(不应用实验指数,效果4 是独立于实验的减免)
    if(isEffectUnlocked("costReduce")){

        base =
        base.div(
            new Decimal(1)
            .add(game.metaPower)
        );

    }

    // 多次完成实验3:想法花费 ÷ completions^10(≥2 生效)
    base = base.div(
        exp3CompletionDivisor()
    );

    return base;
}


// 是否可以获得下一个想法
function canGetIdea(){
    return game.knowledge.gte(
        ideaCost()
    );
}


// 元-力量每秒增长量:0.1 * 底数^(ideas-1)
// 底数默认 2;实验2 提交后按最佳偏差取 Base(2.2~3.0,见 exp2Base)
// ideas=0(未获得想法)时返回 0
// 效果3(7 想法)解锁后:再 ×(1 + MetaPower)^(1/4)
function metaPowerGain(){

    if(game.ideas <= 0)
        return new Decimal(0);

    // 底数:默认 2,实验2 提升后 2.2~3.0
    let base =
    exp2Base();

    let gain =
    new Decimal(0.1)
    .mul(
        Decimal.pow(
            base,
            game.ideas - 1
        )
    );

    // 效果3:元-力量获取速度 ×(1 + MetaPower)^(1/4)
    if(isEffectUnlocked("metaGain")){

        gain = gain.mul(
            metaGainBonus()
        );

    }

    // 多次完成实验1:元-力量生产 × completions(≥2 生效)
    gain = gain.mul(
        exp1CompletionBonus()
    );

    return gain;
}


// 更新元-力量(每 tick 调用)
function updateMetaPower(dt){

    if(game.ideas <= 0)
        return;

    game.metaPower =
    game.metaPower.add(
        metaPowerGain().mul(dt)
    );

}


// 获得想法:重置知识与理论,ideas + 1
// 元-力量保留(它是跨重置的永久资源)
function getIdea(){

    if(!canGetIdea())
        return;

    game.ideas++;

    // 生涯统计:累计获得的想法数、历史最高想法数(研究重置清零 ideas 不影响)
    game.totalIdeas =
    (game.totalIdeas || 0) + 1;

    if(game.maxIdeas === undefined
        || game.ideas > game.maxIdeas)
        game.maxIdeas = game.ideas;

    // 重置知识(成就"第一个想法"达成后:保留 10 知识)
    game.knowledge =
    isAchievementUnlocked("idea1")
    ? new Decimal(10)
    : new Decimal(0);

    // 重置所有理论
    for(let id in game.theories){

        let t =
        game.theories[id];

        t.unlocked = false;
        t.level = 0;
        t.power =
        new Decimal(1);

    }

    // 保存(元-力量与想法数已持久化)
    saveGame();

    // 仅第一次获得想法时播放剧情,之后直接继续
    if(!game.ideaStorySeen){

        game.ideaStorySeen = true;

        saveGame();

        showIdeaStory();

    }

    // 刷新界面
    renderTheories();
    renderIdeaPage();

}


// 绘制想法页面(增量更新文本,不重建 DOM)
function renderIdeaPage(){

    let count =
    document.getElementById(
        "ideaCount"
    );

    if(count)
        count.innerText = game.ideas;

    let meta =
    document.getElementById(
        "metaPower"
    );

    if(meta)
        meta.innerText = format(game.metaPower);

    let metaRate =
    document.getElementById(
        "metaPowerRate"
    );

    if(metaRate)
        metaRate.innerText = format(metaPowerGain());

    // 元-力量效果1:× (1 + metaPower)
    let effect =
    document.getElementById(
        "metaEffect"
    );

    if(effect)
        effect.innerText = format(metaPowerBonus());

    // 元-力量效果列表(增量渲染)
    renderMetaEffects();

    // 下一个想法价格
    let cost =
    document.getElementById(
        "ideaCost"
    );

    if(cost)
        cost.innerText = format(ideaCost());

    // 当前进度:知识 / 价格
    let progress =
    document.getElementById(
        "ideaProgress"
    );

    if(progress)
        progress.innerText =
        format(game.knowledge)
        + " / "
        + format(ideaCost());

    // 重置按钮可用状态
    let btn =
    document.getElementById(
        "getIdeaBtn"
    );

    if(btn)
        btn.disabled = !canGetIdea();

}
