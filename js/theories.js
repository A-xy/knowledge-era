const theoryData = {
    theory1:{
        name:"基础理论",
        cost:new Decimal(10),
        // 该理论独立的升级价格参数(不填则用全局默认值)
        price:{
            BASE: 100,
            A: 2,
            B: 1,
            N: 5
        }
    },
    theory2:{
        name:"物质理论",
        cost:new Decimal(100),
        price:{
            BASE: 1e3,
            A: 3,
            B: 1,
            N: 5
        }
    },
    theory3:{
        name:"能量理论",
        cost:new Decimal(10000),
        price:{
            BASE: 1e7,
            A: 4,
            B: 1,
            N: 5
        }
    },
    theory4:{
        name:"宇宙理论",
        cost:new Decimal("1e8"),
        price:{
            BASE: 1e12,
            A: 5,
            B: 1,
            N: 5
        }
    },
    theory5:{
        name:"终极理论",
        cost:new Decimal("1e13"),
        price:{
            BASE: 1e18,
            A: 6,
            B: 1,
            N: 5
        }
    },
    // 拓展理论:在前沿领域中发现的新理论
    // 与其他理论不同 —— 它在前沿领域内**依然可用**(理论2~5 在领域内失效)
    // 未发现前完全不显示(玩家不知道它存在),发现后按前置理论规则解锁
    theory6:{
        name:"拓展理论",
        cost:new Decimal("1e180"),
        price:{
            BASE: 1e190,
            A: 10,
            B: 1,
            N: 5
        }
    }
};


// 拓展理论(理论6)的发现阈值:在前沿领域中知识达到该值后,由剧情发现
// 注意:与解锁花费(theoryData.theory6.cost)含义不同,分开配置便于单独调整
const THEORY6_DISCOVER_KNOWLEDGE =
new Decimal("1e180");


// 兼容旧存档:补齐拓展理论的运行时状态与发现标记
// (旧存档的 game.theories 里没有 theory6,也没有 theory6StorySeen)
function ensureTheory6Compat(){

    if(!game.theories)
        game.theories = {};

    if(game.theories.theory6 === undefined){

        game.theories.theory6 = {
            unlocked:false,
            level:0,
            power:new Decimal(1)
        };

    }

    let t =
    game.theories.theory6;

    // power 可能是字符串(直接来自存档)或缺失
    if(!(t.power instanceof Decimal))
        t.power = new Decimal(t.power === undefined ? 1 : t.power);

    if(t.unlocked === undefined)
        t.unlocked = false;

    if(t.level === undefined)
        t.level = 0;

    if(game.theory6StorySeen === undefined)
        game.theory6StorySeen = false;

}


// ============================================================
// 升级价格默认参数(全局兜底值)
// 注意:游戏里 level 从 0 开始(第一级 = level 0)
// Price(level) = BASE * 10^(A*level + B*max(level-N, 0)^2)
// 低等级按指数增长(每级约 ×10^A);超过 N 级后叠加二次项,
// 价格快速陡增,抑制"购买最大"导致的等级爆炸。
// - BASE: 基础价格倍数(level 0 时价格 = BASE,默认 10 与原版一致)
// - A:    线性指数系数,每升 1 级价格约 ×10^A
// - B:    二次项系数,超过 N 级后价格加速增长(越大越难升级)
// - N:    二次项生效的起始等级阈值(level > N 后开始加速)
//
// 注意:每个理论可以在 theoryData 中单独配置自己的 price 参数
// (见下方 theoryData 各理论的 price 字段),未配置的理论使用这里的默认值。
// ============================================================
const DEFAULT_UPGRADE_PRICE = {
    BASE: 10,   // 基础价格倍数(level 0 时价格 = 10)
    A: 1,       // 线性指数系数:每升 1 级价格约 ×10^A
    B: 0.05,    // 二次项系数:超过 N 级后价格加速增长
    N: 100      // 二次项生效的起始等级阈值(level > N 后开始加速)
};


// 获取某个理论的价格参数(未单独配置时用全局默认值)
function getTheoryPrice(id){
    let data =
    theoryData[id];

    return (data && data.price)
    ? data.price
    : DEFAULT_UPGRADE_PRICE;
}


// 价格指数 f(x,p) = p.A*x + p.B*max(x-p.N,0)^2
// 实验4(exp4Effect)使二次项起始点延后:N 变大 → 价格膨胀延后
function priceExponent(x, p){
    let over = Math.max(x - (p.N + exp4Effect()), 0);
    return p.A * x + p.B * over * over;
}


// 理论升级价格:Price(level) = BASE * 10^f(level)
// level 从 0 开始(第一级 = level 0),所以直接代入 level
// 每个理论使用自己独立的 price 参数
function theoryUpgradeCost(id){
    let t =
    game.theories[id];

    let p =
    getTheoryPrice(id);

    let exp =
    priceExponent(t.level, p);

    return new Decimal(p.BASE)
    .mul(
        Decimal.pow(10, exp)
    );
}


// 拓展理论(理论6)是否已被发现(前沿领域中知识达标后由剧情发现)
// 未发现前:该理论完全不显示(玩家不知道它存在)
function theory6Unlocked(){

    return !!game.theory6StorySeen;

}


// 拓展理论的前置理论 id
//   前沿领域内:理论2~5 不可用,链条变为 1→6,故只需理论1
//   领域外:沿用正常链条,需要理论5 已解锁
function theory6PrereqId(){

    return frontierActive() ? "theory1" : "theory5";

}


// 拓展理论的前置是否已满足
function theory6PrereqMet(){

    let pre =
    game.theories[theory6PrereqId()];

    return !!(pre && pre.unlocked);

}


// 判断理论是否应该显示
function theoryVisible(id){
    let num =
    Number(
        id.replace("theory","")
    );

    // 拓展理论:需先在前沿领域中发现,且前置理论已解锁
    if(num === 6)
        return theory6Unlocked()
            && theory6PrereqMet();

    // 前沿领域:理论2~5 被禁用(不显示、无法解锁)
    if(frontierActive() && num >= 2)
        return false;

    //理论1默认显示
    if(num===1)
        return true;

    //其他理论需要前置理论解锁
    return game.theories[
        "theory"+(num-1)
    ].unlocked;
}


// 理论在前沿领域中是否被禁用(2~5)
// 注意:拓展理论(理论6)在前沿领域内**可用** —— 只有 2~5 失效
function theoryDisabled(id){

    if(!frontierActive())
        return false;

    let num =
    Number(
        id.replace("theory","")
    );

    return num >= 2 && num <= 5;

}


// 解锁理论
function unlockTheory(id){
    let t =
    game.theories[id];

    let data =
    theoryData[id];

    if(t.unlocked)
        return;

    // 前沿领域:理论2~5 不可用
    if(theoryDisabled(id))
        return;

    if(game.knowledge.gte(data.cost)){

        game.knowledge =
        game.knowledge.sub(data.cost);

        t.unlocked=true;

        //理论力量初始为1
        t.power =
        new Decimal(1);

        renderTheories();

    }
}


// 升级理论
function upgradeTheory(id){
    let t =
    game.theories[id];

    if(!t.unlocked)
        return;

    // 前沿领域:理论2~5 不可用
    if(theoryDisabled(id))
        return;

    //升级价格
    let cost =
    theoryUpgradeCost(id);

    if(game.knowledge.gte(cost)){

        game.knowledge =
        game.knowledge.sub(cost);

        t.level++;

        renderTheories();

    }
}


// 购买最大:对所有已解锁理论尝试购买最大数量
// 购买最大:先解锁所有可解锁的理论,再逐级升级已解锁理论
function buyMaxTheories(){

    // 第一步:解锁所有当前可解锁的理论
    for(let i = 1; i <= 6; i++){

        let id =
        "theory" + i;

        let t =
        game.theories[id];

        if(t && !t.unlocked && theoryVisible(id)){
            unlockTheory(id);
        }

    }

    // 第二步:升级已解锁理论
    for(let id in game.theories){

        let t =
        game.theories[id];

        if(!t.unlocked)
            continue;

        // 每级价格由 theoryUpgradeCost 计算,逐级购买直到知识不足
        let guard = 0;
        let cost =
        theoryUpgradeCost(id);

        while(game.knowledge.gte(cost)){

            game.knowledge =
            game.knowledge.sub(cost);

            t.level++;

            cost =
            theoryUpgradeCost(id);

            guard++;
            if(guard > 100000) break; // 安全保护
        }

    }

    renderTheories();

}


// 理论力量每秒增长量
// 基础值 = 0.1 * 升级倍率^level,再乘以元-力量加成 (1 + metaPower)
// 升级倍率:
//   默认 = 2
//   效果2(upgradeRate)解锁后 = 2 + 0.2 * ln(MetaPower + 1)
// 公式统一在 ideas.js 的 metaUpgradeRate()/metaPowerBonus()
function theoryPowerGain(id){
    let t =
    game.theories[id];

    if(!t.unlocked)
        return new Decimal(0);

    // 升级倍率:效果2(upgradeRate)解锁后随 MetaPower 增长
    let rate =
    isEffectUnlocked("upgradeRate")
    ? metaUpgradeRate()
    : new Decimal(2);

    let base =
    new Decimal(0.1)
    .mul(
        Decimal.pow(
            rate,
            t.level
        )
    );

    // 元-力量效果1:理论力量 ×(1+MetaPower)^实验指数
    // metaPowerBonus() 已包含实验指数(默认 1.0,实验提交提升后升高)
    let result =
    base.mul(metaPowerBonus());

    // 研究里程碑 stage1:所有理论力量获取 ×(1 + 研究重置次数,最大10)
    if(isMilestoneActive("stage1")){
        result =
        result.mul(
            researchPowerBonus()
        );
    }

    // 多次完成实验4:所有理论力量生产 × completions^2(≥2 生效)
    result =
    result.mul(
        exp4CompletionBonus()
    );

    return result;
}


// 更新理论力量
function updateTheoryPower(dt){
    for(let id in game.theories){

        let t =
        game.theories[id];

        if(t.unlocked){

            t.power =

            t.power.add(
                theoryPowerGain(id).mul(dt)
            );

        }

    }
}


// ============================================================
// 知识边界(软上限)
// 游戏后期的知识获取速度可超过 1.79e308/s(JS number 上限,
// 一些增量游戏称其为"无限")。超过边界后知识生产受软上限限制:
//   capped = 1.79e308 * sqrt(speed / 1.79e308)
// 该计算在各种加成之后进行,结果为最终显示的知识获取速度。
// ============================================================
const KNOWLEDGE_LIMIT =
new Decimal("1.79e308");


// 原始知识速度是否已超越边界(用于显示"已超越边界"提示)
// 边界取 knowledgeLimit()(含论文升级"摘要"的加成,见 frontier.js)
function knowledgeBeyondLimit(speed){
    return speed.gt(knowledgeLimit());
}


// 知识边界软上限(输入原始速度,返回受限后的最终速度)
// capped = 边界 × sqrt(speed / 边界)
function knowledgeSoftCap(speed){

    let limit =
    knowledgeLimit();

    if(!speed.gt(limit))
        return speed;

    return limit.mul(
        speed.div(limit).sqrt()
    );

}


// 软上限使知识生产除以的倍数 = 原始速度 / 受限后速度
// 未超限时为 1(÷1,不受影响);超限后为 sqrt(raw/limit)(>1)
function knowledgeCapDivisor(){
    let raw = knowledgeRawSpeed();
    let capped = knowledgeSoftCap(raw);
    return raw.div(capped);
}


// 已解锁理论的 power 乘积,按两组分别统计(供"参考文献"系列的指数加成使用):
//   theoryProductLegacy() → 理论1~5 的乘积
//   theoryProduct6()      → 理论6 的乘积(未解锁视为 1)
function theoryProductLegacy(){

    let prod =
    new Decimal(1);

    for(let id in game.theories){

        if(id === "theory6")
            continue;

        let t =
        game.theories[id];

        if(t.unlocked)
            prod = prod.mul(t.power);

    }

    return prod;

}


function theoryProduct6(){

    let prod =
    new Decimal(1);

    for(let id in game.theories){

        if(id !== "theory6")
            continue;

        let t =
        game.theories[id];

        if(t.unlocked)
            prod = prod.mul(t.power);

    }

    return prod;

}


// 所有理论对知识的加成(两组乘积各自按论文指数取幂后相乘)
// 论文"参考文献-引用旧理论"(第6行):理论1~5 的项 ^1.1
// 论文"参考文献-引用理论6"(第6行):理论6 的项 ^1.3
// (指数入口在 frontier.js;未加载时按 1 处理,保证独立测试可用)
function theoryPowerProduct(){

    let legacy =
    theoryProductLegacy();

    let t6 =
    theoryProduct6();

    let expLegacy =
    (typeof refLegacyTheoryExponent === "function")
    ? refLegacyTheoryExponent()
    : 1;

    let expT6 =
    (typeof refTheory6Exponent === "function")
    ? refTheory6Exponent()
    : 1;

    if(expLegacy !== 1)
        legacy = legacy.pow(expLegacy);

    if(expT6 !== 1)
        t6 = t6.pow(expT6);

    return legacy.mul(t6);

}


// 计算原始知识速度(各种加成之后、软上限之前)
// 里程碑 stage1 解锁后:知识获取 ×(1 + 研究重置次数,最大10)
// 里程碑 stage4(前沿研究):知识获取 ×(1 + 累计行动点)
function knowledgeRawSpeed(){

    // 理论对知识的加成(= 各已解锁理论 power 的乘积,可被"参考文献"提高指数)
    let speed =
    theoryPowerProduct();

    // 研究里程碑 stage1:知识获取加成
    if(isMilestoneActive("stage1")){
        speed =
        speed.mul(
            researchPowerBonus()
        );
    }

    // 研究里程碑 stage4(前沿研究):知识获取 ×(1+累计行动点)
    if(isMilestoneActive("stage4")){
        speed =
        speed.mul(
            frontierResearchBonus()
        );
    }

    // 论文升级"注重创新":知识获取 ×(1+灵感)^(1/4)
    speed =
    speed.mul(
        innovationBonus()
    );

    return speed;
}


// 计算知识速度(最终显示值,已应用知识边界软上限)
function getKnowledgeSpeed(){
    return knowledgeSoftCap(
        knowledgeRawSpeed()
    );
}


// "购买最大"按钮是否已解锁
// 成就"终极理论吗?"(解锁终极理论)达成后永久解锁,不会被想法重置清掉;
// 研究阶段1 里程碑也提供该按钮。
function buyMaxUnlocked(){

    return isAchievementUnlocked("theory5")
    || isMilestoneActive("stage1");

}


// 绘制理论界面
// 采用增量渲染:卡片只在状态(解锁/等级)变化时才重建,
// 数值变化只更新文本,避免每帧重建按钮导致点击事件丢失
function renderTheories(){

    // 购买最大按钮:成就"终极理论吗?"永久解锁(或研究阶段1 里程碑)
    let buyBtn =
    document.getElementById(
        "buyMaxBtn"
    );

    if(buyBtn){
        buyBtn.style.display =
        buyMaxUnlocked() ? "block" : "none";
    }

    let box =
    document.getElementById(
        "theories"
    );

    // 当前应显示的理论 id 列表
    let visibleIds = [];

    for(let id in game.theories){

        if(theoryVisible(id))
            visibleIds.push(id);

    }

    // 移除已不再显示的理论卡片
    for(let i = box.children.length - 1; i >= 0; i--){

        let child = box.children[i];

        if(!visibleIds.includes(child.dataset.theory)){
            child.remove();
        }

    }

    for(let id of visibleIds){

        let t =
        game.theories[id];

        let data =
        theoryData[id];

        let div =
        document.getElementById(
            "theory-"+id
        );

        //==================
        // 未解锁
        //==================
        if(!t.unlocked){

            // 卡片已存在且状态未变,无需重建
            if(div && div.dataset.mode === "locked")
                continue;

            if(!div){
                div = document.createElement("div");
                div.id = "theory-"+id;
                div.dataset.theory = id;
                box.appendChild(div);
            }

            div.dataset.mode = "locked";

            div.innerHTML = `

            <h3>
            ${data.name}
            </h3>

            <span class="cost">
            解锁需要：
            ${format(data.cost)}
            </span>

            <button data-theory="${id}" data-action="unlock">

            学习理论

            </button>

            `;

        }

        //==================
        // 已解锁
        //==================
        else{

            let upgradeCost =

            theoryUpgradeCost(id);

            let gain =
            theoryPowerGain(id);

            // 卡片已存在且等级未变,只更新力量/生产速度文本,不重建按钮
            if(div && div.dataset.mode === "upgraded" && Number(div.dataset.level) === t.level){

                let p = div.querySelector(".power-val");
                if(p)
                    p.innerText = format(t.power) + " (+" + format(gain) + "/秒)";

                continue;
            }

            if(!div){
                div = document.createElement("div");
                div.id = "theory-"+id;
                div.dataset.theory = id;
                box.appendChild(div);
            }

            div.dataset.mode = "upgraded";
            div.dataset.level = t.level;

            div.innerHTML = `

            <h3>
            ${data.name}
            </h3>

            <span class="power">
            力量：
            <span class="power-val">${format(t.power)} (+${format(gain)}/秒)</span>
            </span>

            <span class="level">
            Lv.${t.level}
            </span>

            <span class="cost">
            升级：
            ${format(upgradeCost)}
            </span>

            <button data-theory="${id}" data-action="upgrade">

            升级

            </button>

            `;

        }

    }

}


// 事件委托:所有理论按钮的点击统一由容器处理
// 同时监听 mousedown,保证即使按钮正在被刷新也能立刻响应
(function(){

    let box =
    document.getElementById(
        "theories"
    );

    function handle(e){

        let btn = e.target.closest("button[data-theory]");
        if(!btn) return;

        let id = btn.dataset.theory;
        let action = btn.dataset.action;

        if(action === "unlock")
            unlockTheory(id);

        else if(action === "upgrade")
            upgradeTheory(id);

    }

    box.addEventListener("mousedown", handle);
    box.addEventListener("click", handle);

})();


// ============================================================
// 键盘操作(在游戏界面的任意页面都可用)
//   数字键 1~6:购买对应理论(未解锁则解锁,已解锁则升级一次)
//   M 键:购买全部最大;按住 M 持续生效
//         (仅在"购买最大"解锁后有效,见 buyMaxUnlocked)
// ============================================================

// 键盘操作是否生效:只要处于游戏界面(非剧情界面)即可,
// 不限于知识/理论页——在想法/研究/成就等页面同样可用
function keyboardActive(){

    let gameScreen =
    document.getElementById(
        "gameScreen"
    );

    return !!gameScreen
    && gameScreen.style.display === "block";

}


// 按键购买对应理论(数字 1~6 → theory1~6)
function buyTheoryByKey(num){

    if(num < 1 || num > 6)
        return;

    let id =
    "theory" + num;

    let t =
    game.theories[id];

    if(!t)
        return;

    // 未解锁但可见 → 解锁;已解锁 → 升级一次
    if(!t.unlocked){
        if(theoryVisible(id))
            unlockTheory(id);
    }else{
        upgradeTheory(id);
    }

}


// M 键按住时持续购买最大(100ms 一次)
let holdMBuyTimer = null;

function stopHoldBuyMax(){
    if(holdMBuyTimer){
        clearInterval(holdMBuyTimer);
        holdMBuyTimer = null;
    }
}


(function(){

    // 模拟器等环境可能无 document.addEventListener(不影响浏览器)
    if(!document.addEventListener)
        return;

    // 仅在游戏界面(非剧情界面)响应键盘
    document.addEventListener("keydown", function(e){

        if(!keyboardActive())
            return;

        // 防止输入框内误触
        let tag =
        (e.target && e.target.tagName)
        ? e.target.tagName.toLowerCase()
        : "";

        if(tag === "input" || tag === "textarea")
            return;

        // 数字键 1~6 → 购买对应理论
        if(e.key >= "1" && e.key <= "6"){

            e.preventDefault();

            buyTheoryByKey(
                Number(e.key)
            );

            return;

        }

        // M / m → 购买最大(按住持续生效)
        // 仅在"购买最大"已解锁后有效(成就"终极理论吗?"/研究阶段1 里程碑)
        if(e.key === "m" || e.key === "M"){

            e.preventDefault();

            if(!buyMaxUnlocked())
                return;

            if(holdMBuyTimer)
                return; // 已在持续中

            buyMaxTheories();

            holdMBuyTimer =
            setInterval(
                buyMaxTheories,
                100
            );

        }

    });

    document.addEventListener("keyup", function(e){

        if(e.key === "m" || e.key === "M")
            stopHoldBuyMax();

    });

    // 页面失焦时停止按住购买,避免后台空转
    document.addEventListener("blur", function(){
        stopHoldBuyMax();
    });

})();
