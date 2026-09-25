// 数值显示
//   x < 1e6  → 保留 2 位小数的普通写法("12345.68")
//   x ≥ 1e6  → 科学计数法:尾数 2 位小数(去掉多余的 0)+ 完整指数("1.47e1210")
//
// 注意:这里没有直接用 Decimal.toExponential()。
// break_eternity 对层级 ≥1 的大数(即 |x| ≥ 9e15)会走
// toStringWithDecimalPlaces → decimalPlaces(),而 decimalPlaces 是按
// "places+1 = 3 位有效数字"来舍入的 —— 对**尾数**没问题,但**指数**也被同样
// 舍入,导致 1e1221 显示成 1e1220(个位数永远归零);
// 同时尾数四舍五入到 10 时也不会向指数进位(出现 "10e1220" 这种写法)。
// 因此改为自己拆出尾数与指数:尾数四舍五入(进位则指数 +1),指数原样显示。
function format(x){

if(!(x instanceof Decimal))
x=new Decimal(x);

// NaN / Infinity 等异常状态:交回库处理
if(isNaN(x.sign) || isNaN(x.layer) || isNaN(x.mag)
|| x.mag === Infinity || x.layer === Infinity)
return x.toString();

// 负数:取出符号,按正数格式化
if(x.sign < 0)
return "-" + format(x.neg());

if(x.lt(1000000))
return x.toFixed(2);

let lg =
x.log10();

let expNum =
lg.toNumber();

// 指数本身也大到超出普通数字范围(层级 ≥3)时的兜底写法
if(!isFinite(expNum))
return x.toString();

let exp =
Math.floor(expNum);

let mantissa =
Math.pow(10, expNum - exp);

let ms =
trimTrailingZeros(mantissa.toFixed(2));

// 尾数进位到 10(例如 9.999 → 10.00):指数 +1,尾数回到 1
if(parseFloat(ms) >= 10){

ms =
trimTrailingZeros((parseFloat(ms) / 10).toFixed(2));

exp += 1;

}

return ms + "e" + exp;

}


// 去掉小数末尾多余的 0("1.00" → "1","1.50" → "1.5")
function trimTrailingZeros(s){

if(s.indexOf(".") < 0)
return s;

return s.replace(/\.?0+$/, "");

}
