const  math  = require('mathjs');

let evaluateExp = (str, d) => {
    return math.evaluate(str,d)
}

let buildExpressionScope = (expr, row, dimensions) => {
    let cols = dimensions && dimensions.length ? dimensions : Object.keys(row);
    let sortedCols = cols.slice().sort((a,b) => b.length - a.length);
    let normalizedExpr = expr;
    let scope = {};

    sortedCols.forEach((colName, idx) => {
        let token = "__col" + idx;
        let value = Number(row[colName]);
        if(!Number.isFinite(value)){
            throw new Error("non numeric column");
        }
        scope[token] = value;
        normalizedExpr = normalizedExpr.split(colName).join(token);
    });

    return { normalizedExpr, scope };
}

exports.addPolyDim = (str, data, dimensions) => {
    for( let d of data){
        let parsed = buildExpressionScope(str, d, dimensions);
        let out = evaluateExp(parsed.normalizedExpr, parsed.scope);
        let value = Number(out);
        if(!Number.isFinite(value)){
            throw new Error("expression did not evaluate to a number");
        }
        d[str] = +(Number(value.toFixed(2)));
    }
}
