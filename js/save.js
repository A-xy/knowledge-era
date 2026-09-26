// 序列化游戏对象(Decimal 转为字符串)
function serializeGame(){
    return JSON.stringify(
        game,
        (key,value)=>{

            if(value instanceof Decimal)

                return value.toString();


            return value;

        }
    );
}


// 保存游戏到 localStorage
function saveGame(){


    game.lastSave = Date.now();

    localStorage.setItem(

        "scienceSave",

        serializeGame()

    );


}


// 手动保存
function manualSave(){

    saveGame();

    alert("已保存!");

}


// 导出存档:加密后写入导出文本框(兼容无 SaveCrypto 环境直接明文)
async function exportSave(){

    let area =
    document.getElementById(
        "exportArea"
    );

    if(!area)
        return;

    let plain =
    serializeGame();

    // 加密模块可用(浏览器含 WebCrypto)→ 加密导出
    if(typeof SaveCrypto !== "undefined"){

        try{

            area.value =
            await SaveCrypto.encrypt(plain);

            alert("已导出(已加密),请复制文本框中的内容。");

            return;

        }catch(e){

            alert("导出加密失败:" + e.message);

            return;

        }

    }

    // 兜底:无加密模块时明文导出
    area.value = plain;

    alert("已导出,请复制文本框中的内容。");

}


// 导入存档:从导入文本框读取并覆盖当前存档
// 自动识别:加密存档(KZENC1: 前缀)→ 先解密;明文旧档 → 直接解析
async function importSave(){

    let area =
    document.getElementById(
        "importArea"
    );

    if(!area)
        return;

    let text = area.value.trim();

    if(!text){
        alert("请先粘贴存档文本!");
        return;
    }

    // 加密存档 → 解密为明文 JSON(解密失败会抛错,给出清晰提示)
    if(typeof SaveCrypto !== "undefined"
        && SaveCrypto.isEncrypted(text)){

        try{

            text =
            await SaveCrypto.decrypt(text);

        }catch(e){

            alert("导入失败:存档解密失败。" +
                "请确认文件完整且由同一版本游戏导出。" +
                "(详情:" + e.message + ")");

            return;

        }

    }

    try{

        let obj = JSON.parse(text);

        if(!obj || typeof obj !== "object" || !obj.theories){
            alert("存档格式不正确!");
            return;
        }

        game = obj;

        // 主循环计时基准:与 loadGame 同理,从导入的存档恢复计时起点
        if(typeof lastTickTime !== "undefined"){
            lastTickTime =
            (game.lastSave && game.lastSave > 0)
                ? game.lastSave
                : null;
        }

        game.knowledge =
        new Decimal(
            game.knowledge
        );

        for(let id in game.theories){

            game.theories[id].power =
            new Decimal(
                game.theories[id].power
            );

            if(game.theories[id].unlocked === undefined)
                game.theories[id].unlocked = false;

            if(game.theories[id].level === undefined)
                game.theories[id].level = 0;

        }

        // 兼容旧存档:拓展理论(理论6)与发现标记
        ensureTheory6Compat();

        if(game.ideas === undefined)
            game.ideas = 0;

        if(game.ideaStorySeen === undefined)
            game.ideaStorySeen = false;

        if(game.metaPower === undefined)
            game.metaPower = new Decimal(0);
        else
            game.metaPower =
            new Decimal(
                game.metaPower
            );

        // 兼容旧存档:调试速度(缺省 1 = 正常速度)
        if(game.debugSpeed === undefined || game.debugSpeed <= 0)
            game.debugSpeed = 1;

        // 时间碎片系统字段(时间碎片/加速档位;档位合法性由 main.js 再校验)
        if(game.timeShards === undefined)
            game.timeShards = 0;
        if(game.timeMult === undefined)
            game.timeMult = 1;

        // 兼容旧存档:成就系统 + 高速研究计时字段
        if(game.achievements === undefined)
            game.achievements = {};
        if(game.totalTime === undefined)
            game.totalTime = 0;
        if(game.lastResearchResetTime === undefined)
            game.lastResearchResetTime = null;
        if(game.fastResearchFlag === undefined)
            game.fastResearchFlag = false;

        // 兼容旧存档:生涯统计字段(累计值,跨重置不清零)
        if(game.totalKnowledgeProduced === undefined)
            game.totalKnowledgeProduced = new Decimal(0);
        else
            game.totalKnowledgeProduced =
            new Decimal(game.totalKnowledgeProduced);
        if(game.totalIdeas === undefined)
            game.totalIdeas = 0;
        if(game.maxIdeas === undefined)
            game.maxIdeas = 0;
        if(game.totalResearchPoints === undefined)
            game.totalResearchPoints = new Decimal(0);
        else
            game.totalResearchPoints =
            new Decimal(game.totalResearchPoints);
        if(game.fastestResearchReset === undefined)
            game.fastestResearchReset = null;

        // 兼容旧存档:后期剧情标记
        if(game.firstResetHelperStorySeen === undefined)
            game.firstResetHelperStorySeen = false;
        if(game.stage3AutoStorySeen === undefined)
            game.stage3AutoStorySeen = false;
        if(game.knowledgeLimitStorySeen === undefined)
            game.knowledgeLimitStorySeen = false;
        if(game.stage4FrontierStorySeen === undefined)
            game.stage4FrontierStorySeen = false;

        // 兼容旧存档:前沿领域(阶段4)
        // frontierActive / inspiration / 各论文升级解锁状态均由
        // frontier.js 的 ensurePaperCompat() 按 FRONTIER_CONFIG 自动补齐
        ensurePaperCompat();

        // 兼容旧存档:成就相关字段(ensureAchievementCompat,见 achievements.js)
        ensureAchievementCompat();

        // 兼容旧存档:研究系统字段
        if(game.researchStage === undefined)
            game.researchStage = 0;

        if(game.researchResets === undefined)
            game.researchResets = 0;

        if(game.actionPoints === undefined)
            game.actionPoints = new Decimal(0);
        else
            game.actionPoints =
            new Decimal(
                game.actionPoints
            );

        if(game.researchStorySeen === undefined)
            game.researchStorySeen = false;

        // 兼容旧存档:助手系统
        if(game.assistants === undefined){

            game.assistants = {
                theorist: { unlocked: false, enabled: true },
                ideaSorter: { unlocked: false, enabled: true }
            };

        }else{

            let defaults = {
                theorist: { unlocked: false, enabled: true },
                ideaSorter: { unlocked: false, enabled: true },
                researchSummarizer: { unlocked: false, enabled: true },
                expAuto1: { unlocked: false, enabled: true, level: 0 },
                expAuto2: { unlocked: false, enabled: true, level: 0 },
                expAuto3: { unlocked: false, enabled: true, level: 0 },
                expAuto4: { unlocked: false, enabled: true, level: 0 }
            };

            for(let key in defaults){

                if(game.assistants[key] === undefined)
                    game.assistants[key] = defaults[key];
                else{

                    if(game.assistants[key].unlocked === undefined)
                        game.assistants[key].unlocked = false;

                    if(game.assistants[key].enabled === undefined)
                        game.assistants[key].enabled = true;

                    // 研究总结员的阈值/倍数/模式:由 ensureSummarizerCompat() 统一补齐
                    if(key.indexOf("expAuto") === 0
                        && game.assistants[key].level === undefined)
                        game.assistants[key].level = 0;

                }

            }

        }

        // 兼容旧存档:研究总结员(模式/倍数设置 + 上次重置行动点)
        ensureSummarizerCompat();

        // 兼容旧存档:实验系统(首次进入实验页时生成 exp1)
        if(game.experiments === undefined)
            game.experiments = {};

        // 实验系统 Decimal 字段还原(存档把 Decimal 序列化为字符串)
        // 主要是 exp2.elapsed 与 measurements[].t(updateExperiment2Time 累加)
        fixExp2TimeFields();

        if(game.lastSave === undefined)
            game.lastSave = Date.now();

        saveGame();

        alert("导入成功!");

        location.reload();

    }catch(e){
        alert("导入失败:" + e.message);
    }

}


// 重置游戏
function resetGame(){

    if(confirm("确定要重置游戏吗?所有进度将丢失!")){

        localStorage.removeItem(
            "scienceSave"
        );

        location.reload();

    }

}


// 读取存档并恢复 game 对象
function loadGame(){


    let data=
    localStorage.getItem(
        "scienceSave"
    );


    if(!data)
        return;


    let obj=
    JSON.parse(data);


    game=obj;


    // 主循环计时基准:从存档恢复"上次真正结算的时间",
    // 这样后台挂机/关页面期间的全部时长都会进离线碎片转化。
    // (取不到时保持 null,交给首帧自行初始化)
    if(typeof lastTickTime !== "undefined"){
        lastTickTime =
        (game.lastSave && game.lastSave > 0)
            ? game.lastSave
            : null;
    }


    game.knowledge=
    new Decimal(
        game.knowledge
    );


    for(let id in game.theories){

        game.theories[id].power=
        new Decimal(
            game.theories[id].power
        );

    }

    // 兼容旧存档:拓展理论(理论6)与发现标记
    ensureTheory6Compat();

    // 兼容旧存档:想法系统字段
    if(game.ideas === undefined)
        game.ideas = 0;

    if(game.ideaStorySeen === undefined)
        game.ideaStorySeen = false;

    if(game.metaPower === undefined)
        game.metaPower = new Decimal(0);
    else
        game.metaPower =
        new Decimal(
            game.metaPower
        );

    // 兼容旧存档:调试速度(缺省 1 = 正常速度)
    if(game.debugSpeed === undefined || game.debugSpeed <= 0)
        game.debugSpeed = 1;

    // 时间碎片系统字段
    if(game.timeShards === undefined)
        game.timeShards = 0;
    if(game.timeMult === undefined)
        game.timeMult = 1;

    // 成就系统 + 高速研究计时字段
    if(game.achievements === undefined)
        game.achievements = {};
    if(game.totalTime === undefined)
        game.totalTime = 0;
    if(game.lastResearchResetTime === undefined)
        game.lastResearchResetTime = null;
    if(game.fastResearchFlag === undefined)
        game.fastResearchFlag = false;

    // 生涯统计字段(累计值,跨重置不清零)
    if(game.totalKnowledgeProduced === undefined)
        game.totalKnowledgeProduced = new Decimal(0);
    else
        game.totalKnowledgeProduced =
        new Decimal(game.totalKnowledgeProduced);
    if(game.totalIdeas === undefined)
        game.totalIdeas = 0;
    if(game.maxIdeas === undefined)
        game.maxIdeas = 0;
    if(game.totalResearchPoints === undefined)
        game.totalResearchPoints = new Decimal(0);
    else
        game.totalResearchPoints =
        new Decimal(game.totalResearchPoints);
    if(game.fastestResearchReset === undefined)
        game.fastestResearchReset = null;

    // 后期剧情标记
    if(game.firstResetHelperStorySeen === undefined)
        game.firstResetHelperStorySeen = false;
    if(game.stage3AutoStorySeen === undefined)
        game.stage3AutoStorySeen = false;
    if(game.knowledgeLimitStorySeen === undefined)
        game.knowledgeLimitStorySeen = false;
    if(game.stage4FrontierStorySeen === undefined)
        game.stage4FrontierStorySeen = false;

    // 前沿领域(阶段4):frontierActive / inspiration / 各论文升级解锁状态
    // 统一由 frontier.js 的 ensurePaperCompat() 按配置补齐
    ensurePaperCompat();

    // 成就相关字段(ensureAchievementCompat,见 achievements.js)
    ensureAchievementCompat();

    // 兼容旧存档:研究系统字段
    if(game.researchStage === undefined)
        game.researchStage = 0;

    if(game.researchResets === undefined)
        game.researchResets = 0;

    if(game.actionPoints === undefined)
        game.actionPoints = new Decimal(0);
    else
        game.actionPoints =
        new Decimal(
            game.actionPoints
        );

    if(game.researchStorySeen === undefined)
        game.researchStorySeen = false;

    // 兼容旧存档:助手系统
    if(game.assistants === undefined){

        game.assistants = {
            theorist: { unlocked: false, enabled: true },
            ideaSorter: { unlocked: false, enabled: true }
        };

    }else{

        let defaults = {
            theorist: { unlocked: false, enabled: true },
            ideaSorter: { unlocked: false, enabled: true },
            researchSummarizer: { unlocked: false, enabled: true },
            expAuto1: { unlocked: false, enabled: true, level: 0 },
            expAuto2: { unlocked: false, enabled: true, level: 0 },
            expAuto3: { unlocked: false, enabled: true, level: 0 },
            expAuto4: { unlocked: false, enabled: true, level: 0 }
        };

        for(let key in defaults){

            if(game.assistants[key] === undefined)
                game.assistants[key] = defaults[key];
            else{

                if(game.assistants[key].unlocked === undefined)
                    game.assistants[key].unlocked = false;

                if(game.assistants[key].enabled === undefined)
                    game.assistants[key].enabled = true;

                if(key === "researchSummarizer"
                    && game.assistants[key].threshold === undefined)
                    game.assistants[key].threshold = 5;

                if(key.indexOf("expAuto") === 0
                    && game.assistants[key].level === undefined)
                    game.assistants[key].level = 0;

            }

        }

    }

    // 兼容旧存档:研究总结员(模式/倍数设置 + 上次重置行动点)
    ensureSummarizerCompat();

    // 兼容旧存档:实验系统(首次进入实验页时生成 exp1)
    if(game.experiments === undefined)
        game.experiments = {};

    // 实验系统 Decimal 字段还原(存档把 Decimal 序列化为字符串)
    fixExp2TimeFields();

    if(game.lastSave === undefined)
        game.lastSave = Date.now();

}


// 归一化实验2 的时间字段为普通 number(时间不用大数库)
// 兼容旧存档:旧版曾用 Decimal/拼接字符串存储 elapsed 与 measurements[].t
// 同时清理旧版 bug 遗留的损坏测量记录(t 为拼接字符串 / signal 为 null)
function fixExp2TimeFields(){

    if(!game.experiments || !game.experiments.exp2)
        return;

    let e =
    game.experiments.exp2;

    // elapsed:统一为 number
    if(e.elapsed !== undefined
        && typeof e.elapsed !== "number")
        e.elapsed = Number(e.elapsed) || 0;

    // measurements[].t:统一为 number;损坏记录(拼接字符串/无效信号)直接删除
    if(Array.isArray(e.measurements)){

        for(let i = 0; i < e.measurements.length; i++){

            let m =
            e.measurements[i];

            if(!m)
                continue;

            // t:归一化为 number(损坏的拼接字符串取数字前缀,取不到则记为 0)
            if(m.t !== undefined
                && typeof m.t !== "number"){

                let num =
                parseFloat(m.t);

                if(isNaN(num))
                    num = 0;

                m.t = num;

            }

            // signal:无效(非数字/null)的测量记录整体删除
            if(typeof m.signal !== "number"
                || !isFinite(m.signal)){

                e.measurements.splice(i, 1);
                i--;

            }

        }

    }

}
