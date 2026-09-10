function format(x){


if(!(x instanceof Decimal))
x=new Decimal(x);



if(x.lt(1000000))
return x.toFixed(2);



return x.toExponential(2);


}