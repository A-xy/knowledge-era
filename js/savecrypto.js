// ============================================================
// 存档加密模块(浏览器/Node 通用,UMD)
// ------------------------------------------------------------
// 算法:AES-256-GCM(认证加密,防篡改)
//   - 浏览器:crypto.subtle(WebCrypto,异步)
//   - Node:crypto.createCipheriv / createDecipheriv(同步)
// 密钥:内置常量 32 字节 hex(两端严格一致;修改它会使旧加密档失效)
// 格式: KZENC1:<base64(iv)>:<base64(ciphertext||tag)>
//   iv 随机 12 字节;tag 为 GCM 认证标签 16 字节(浏览器自动附加
//   在密文尾部,Node 需手动拼接,格式保持一致)
//
// 安全边界说明(单机游戏防作弊场景):
//   这是无服务器密钥分发的本地游戏。内置密钥可被逆向分析者获取,
//   因此加密的目标是:防止玩家直接查看/手工篡改存档文件,
//   并对导入做完整性校验(篡改会导致解密失败并报错)。
// ============================================================
(function(root, factory){
    if(typeof module === "object" && module.exports){
        // Node / 模拟器环境
        module.exports = factory(require("crypto"));
    }else{
        // 浏览器环境
        root.SaveCrypto = factory(null);
    }
})(typeof self !== "undefined" ? self : this, function(nodeCrypto){


// ---------------- 常量 ----------------
// 存档加密魔数(加密文件前缀,用于自动识别)
const MAGIC = "KZENC1:";

// AES-256 密钥(32 字节 = 64 个 hex 字符)
// 如需更换密钥:改这里并重新导出存档;旧加密档将无法解密
const KEY_HEX =
    "4b9f8e2c7a1d5b3f0e6c9a4d2f8b7e1a" +
    "5c3d9f0e8a2b6c4d1e7f3a5b9c0d2e8f";

// GCM 认证标签字节数(标准 16)
const TAG_BYTES = 16;
const IV_BYTES = 12;


// ---------------- 字节工具 ----------------
function hexToBytes(hex){
    let out = new Uint8Array(hex.length / 2);
    for(let i = 0; i < out.length; i++){
        out[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return out;
}

const KEY_BYTES = hexToBytes(KEY_HEX);

// base64 编码(处理任意二进制)
function bytesToB64(bytes){
    if(typeof Buffer !== "undefined" && Buffer.from){
        // Node
        return Buffer.from(bytes.buffer
            ? bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength)
            : bytes).toString("base64");
    }
    // 浏览器
    let bin = "";
    for(let i = 0; i < bytes.length; i++)
        bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

// base64 解码 → Uint8Array
function b64ToBytes(b64){
    if(typeof Buffer !== "undefined" && Buffer.from){
        // Node
        let buf = Buffer.from(b64, "base64");
        return new Uint8Array(
            buf.buffer,
            buf.byteOffset,
            buf.byteLength
        );
    }
    // 浏览器
    let bin = atob(b64);
    let out = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++)
        out[i] = bin.charCodeAt(i);
    return out;
}

function strToBytes(str){
    if(typeof TextEncoder !== "undefined")
        return new TextEncoder().encode(str);
    // 兜底(极旧环境)
    let out = new Uint8Array(str.length);
    for(let i = 0; i < str.length; i++)
        out[i] = str.charCodeAt(i) & 0xff;
    return out;
}

function bytesToStr(bytes){
    if(typeof TextDecoder !== "undefined")
        return new TextDecoder().decode(bytes);
    let s = "";
    for(let i = 0; i < bytes.length; i++)
        s += String.fromCharCode(bytes[i]);
    return s;
}


// ---------------- 加密(浏览器异步 / Node 同步均可) ----------------
// 浏览器使用 crypto.subtle(异步);Node 用 createCipheriv
function browserCryptoAvailable(){
    return (typeof crypto !== "undefined")
        && crypto.subtle;
}

async function importAesKey(){
    return crypto.subtle.importKey(
        "raw",
        KEY_BYTES,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
}

// Node:异步 WebCrypto 加密(供测试/统一入口)
async function encryptAsyncNode(plain){
    const webcrypto = nodeCrypto.webcrypto;
    const iv = webcrypto.getRandomValues(
        new Uint8Array(IV_BYTES)
    );
    const key = await webcrypto.subtle.importKey(
        "raw", KEY_BYTES, { name: "AES-GCM" },
        false, ["encrypt"]
    );
    const ct = await webcrypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        strToBytes(plain)
    );
    return MAGIC + bytesToB64(iv) + ":" +
        bytesToB64(new Uint8Array(ct));
}

// Node:同步加密(createCipheriv)
function encryptSyncNode(plain){
    const iv = nodeCrypto.randomBytes(IV_BYTES);
    const cipher = nodeCrypto.createCipheriv(
        "aes-256-gcm", KEY_BYTES, iv
    );
    const head = cipher.update(plain, "utf8");
    const tail = cipher.final();
    const tag = cipher.getAuthTag();
    return MAGIC +
        bytesToB64(iv) + ":" +
        bytesToB64(
            Buffer.concat([head, tail, tag])
        );
}

// Node:同步解密(createDecipheriv)
function decryptSyncNode(text){
    if(!isEncrypted(text))
        throw new Error("不是加密存档(缺少标识)");
    const parts = text.slice(MAGIC.length).split(":");
    if(parts.length !== 2)
        throw new Error("存档文件格式损坏");
    const iv = b64ToBytes(parts[0]);
    const body = b64ToBytes(parts[1]);
    if(body.length <= TAG_BYTES)
        throw new Error("存档文件内容不完整");
    const data = body.slice(0, body.length - TAG_BYTES);
    const tag = body.slice(body.length - TAG_BYTES);
    const decipher = nodeCrypto.createDecipheriv(
        "aes-256-gcm", KEY_BYTES, iv
    );
    decipher.setAuthTag(tag);
    const out = [];
    out.push(decipher.update(data));
    out.push(decipher.final()); // 校验失败会在此抛出
    return Buffer.concat(out).toString("utf8");
}


// ---------------- 对外 API ----------------

// 是否加密存档(按魔数识别;旧明文存档返回 false)
function isEncrypted(text){
    return typeof text === "string"
        && text.indexOf(MAGIC) === 0;
}

// 加密(浏览器/Node 通用,返回 Promise)
async function encrypt(plain){
    if(nodeCrypto){
        // Node:优先 WebCrypto(与浏览器同路径便于交叉测试)
        if(nodeCrypto.webcrypto && nodeCrypto.webcrypto.subtle)
            return encryptAsyncNode(plain);
        return encryptSyncNode(plain);
    }
    // 浏览器
    if(!browserCryptoAvailable()){
        throw new Error(
            "当前环境不支持 WebCrypto(需 https 或 localhost)。" +
            "请用服务器方式打开游戏后再导出。"
        );
    }
    const iv = crypto.getRandomValues(
        new Uint8Array(IV_BYTES)
    );
    const key = await importAesKey();
    const ct = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        strToBytes(plain)
    );
    return MAGIC + bytesToB64(iv) + ":" +
        bytesToB64(new Uint8Array(ct));
}

// 解密(浏览器/Node 通用,返回 Promise;失败抛错)
async function decrypt(text){
    if(nodeCrypto)
        return decryptSyncNode(text);
    if(!browserCryptoAvailable()){
        throw new Error(
            "当前环境不支持 WebCrypto(需 https 或 localhost)。"
        );
    }
    if(!isEncrypted(text))
        throw new Error("不是加密存档(缺少标识)");
    const parts = text.slice(MAGIC.length).split(":");
    if(parts.length !== 2)
        throw new Error("存档文件格式损坏");
    const iv = b64ToBytes(parts[0]);
    const body = b64ToBytes(parts[1]);
    const key = await importAesKey();
    const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        body
    );
    return bytesToStr(new Uint8Array(plain));
}

return {
    MAGIC: MAGIC,
    isEncrypted: isEncrypted,
    encrypt: encrypt,          // async(浏览器/Node)
    decrypt: decrypt,          // async
    encryptSync: encryptSyncNode, // Node 同步
    decryptSync: decryptSyncNode  // Node 同步
};

});
