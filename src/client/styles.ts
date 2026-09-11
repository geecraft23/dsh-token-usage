/** Scoped, responsive settings presentation; colors follow the host theme. */
export const css = `
.dsh-usage{font:inherit;color:inherit;line-height:1.5;width:100%;max-width:960px;box-sizing:border-box}
.dsh-usage *{box-sizing:border-box}.dsh-usage h2{font-size:24px;letter-spacing:-.6px;margin:0 0 6px;font-weight:650}
.dsh-usage h3{font-size:15px;margin:24px 0 10px}.dsh-usage p{margin:6px 0}.dsh-usage .muted{opacity:.62;font-size:12px}
.dsh-usage .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0 16px;align-items:center}
.dsh-usage button,.dsh-usage select,.dsh-usage input{font:inherit;font-size:12px;border:1px solid #8884;border-radius:8px;background:transparent;color:inherit;padding:7px 10px}
.dsh-usage select option{color:CanvasText;background:Canvas}.dsh-usage button{cursor:pointer}.dsh-usage button:hover{background:#8882}
.dsh-usage button:disabled,.dsh-usage select:disabled{opacity:.4;cursor:wait}.dsh-usage :focus-visible{outline:2px solid #60a5fa;outline-offset:2px}
.dsh-usage .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.dsh-usage .card{border:1px solid #8883;border-radius:12px;padding:16px 14px;min-width:0}
.dsh-usage .card.offline{background:#2db89a0c;border-color:#2db89a50}.dsh-usage .metric{font-size:clamp(20px,3vw,30px);font-weight:650;letter-spacing:-.8px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;margin:8px 0}
.dsh-usage .card label{font-size:12px;opacity:.7}.dsh-usage .submetric{font-size:11px;opacity:.65;font-variant-numeric:tabular-nums}
.dsh-usage .legend{display:flex;gap:15px;font-size:11px;opacity:.75}.dsh-usage .dot{width:7px;height:7px;display:inline-block;border-radius:50%;margin-right:5px}
.dsh-usage .chart{height:100px;display:flex;align-items:end;gap:3px;border-bottom:1px solid #8884;margin:12px 0 4px}
.dsh-usage .bar{flex:1;min-width:1px;display:flex;flex-direction:column-reverse;height:100%;justify-content:flex-start}
.dsh-usage .bar span{display:block;min-height:0;border-radius:2px 2px 0 0}.dsh-usage .axis{display:flex;justify-content:space-between;font-size:10px;opacity:.55}
.dsh-usage .table-wrap{overflow-x:auto}.dsh-usage table{width:100%;border-collapse:collapse;font-size:12px;text-align:left;white-space:nowrap}
.dsh-usage th{font-weight:500;opacity:.55;padding:10px 8px;border-bottom:1px solid #8884}.dsh-usage td{padding:12px 8px;border-bottom:1px solid #8882;font-variant-numeric:tabular-nums}
.dsh-usage td:first-child{min-width:150px;max-width:230px;white-space:normal;overflow-wrap:anywhere}.dsh-usage .num{text-align:right}.dsh-usage td select{padding:4px 5px;font-size:11px}
.dsh-usage .coverage{display:flex;gap:8px 16px;flex-wrap:wrap;border-top:1px solid #8883;margin-top:24px;padding-top:14px;font-size:12px}
.dsh-usage .notice{padding:10px 12px;border:1px solid #d99b4055;border-radius:8px;background:#d99b4010;font-size:12px;margin:10px 0}
.dsh-usage .empty{padding:45px 0;text-align:center;opacity:.6}.dsh-usage details{margin-top:16px;font-size:12px}.dsh-usage summary{cursor:pointer;opacity:.7}
.dsh-usage .dates{display:flex;gap:8px;align-items:center;font-size:11px}.dsh-usage .status{font-size:11px;color:#2db89a}
@media(max-width:650px){.dsh-usage .cards{grid-template-columns:1fr 1fr}.dsh-usage .card:first-child{grid-column:1/-1}.dsh-usage .metric{font-size:25px}.dsh-usage h2{font-size:21px}}

.dsh-usage .totals-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #8883;border-radius:16px;margin:20px 0 0;padding:20px 0}
.dsh-usage .totals-strip>div,.dsh-usage .insights-strip>div{min-width:0;text-align:center;display:flex;flex-direction:column;gap:5px;padding:0 8px}
.dsh-usage .totals-strip>div+div{border-left:1px solid #8882}.dsh-usage .totals-strip strong{font-size:clamp(18px,2.2vw,27px);font-weight:600;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.dsh-usage .totals-strip>div>span,.dsh-usage .insights-strip>div>span{font-size:12px;opacity:.6}.dsh-usage .insights-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:22px 0}.dsh-usage .insights-strip strong{font-size:16px;font-weight:500;overflow-wrap:anywhere}
.dsh-usage .activity{margin:12px 0 30px}.dsh-usage .section-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.dsh-usage .section-heading h3{margin:0;font-size:16px}
.dsh-usage .view-tabs{display:flex;gap:12px;margin:14px 0}.dsh-usage .view-tabs button{border:0;padding:3px 0;border-radius:0;opacity:.5}.dsh-usage .view-tabs button[aria-pressed=true]{opacity:1;border-bottom:2px solid #447bdd}
.dsh-usage .calendar-scroll{overflow-x:auto;padding:3px}.dsh-usage .calendar{display:grid;gap:5px;min-width:0;width:100%}
.dsh-usage .calendar .day{aspect-ratio:1;min-width:0;border:1px solid #8883;border-radius:3px;padding:0;width:100%}.dsh-usage .day[aria-pressed=true]{outline:2px solid #447bdd;outline-offset:1px}
.dsh-usage .level-0{background:#fff}.dsh-usage .level-1{background:#c9d8f4}.dsh-usage .level-2{background:#99b7ec}.dsh-usage .level-3{background:#6292e4}.dsh-usage .level-4{background:#2f69cb}
.dsh-usage .heat-legend{display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:8px;font-size:10px;opacity:.8}.dsh-usage .heat-legend i{width:10px;height:10px;border-radius:2px;border:1px solid #8883}
.dsh-usage .day-detail{font-size:11px;min-height:20px;margin-top:12px}.dsh-usage .plot{height:130px;margin-top:20px;border-bottom:1px solid #8882}.dsh-usage .plot svg{width:100%;height:100%;fill:#7299df;stroke:#447bdd}.dsh-usage .series-row{display:flex;justify-content:space-between;font-variant-numeric:tabular-nums}
.dsh-usage .toolbar select{max-width:100%;min-width:0}.dsh-usage .toolbar select[aria-label="模型"],.dsh-usage .toolbar select[aria-label="Model"]{max-width:180px}
@media(max-width:500px){.dsh-usage .insights-strip{grid-template-columns:1fr 1fr;gap:16px}.dsh-usage .totals-strip strong{font-size:18px}}
`
