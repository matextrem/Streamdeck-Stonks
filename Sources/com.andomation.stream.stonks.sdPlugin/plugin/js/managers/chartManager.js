const CHART_SCALE = 50
const CHART_BASE = 130
const CHART_WIDTH = 140

const ChartType = Object.freeze({
    // ranges    ["1d","5d","1mo","3mo","6mo","1y","2y","5y","10y","ytd","max"]
    // intervals [1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo]
    
    // NOTE : The ranges below were chosen to optimize API polling.
    CHART_MIN_30    : {range:'1d',  interval:'1m',  label:'30m', type:'range1', subset:30},
    CHART_HR_1      : {range:'1d',  interval:'1m',  label:'1hr', type:'range1', subset:60},
    CHART_HR_2      : {range:'1d',  interval:'1m',  label:'2hr', type:'range1', subset:120},
    CHART_DAY_1     : {range:'1d',  interval:'2m',  label:'1d',  type:'range2', subset:195},
    CHART_DAY_5     : {range:'5d',  interval:'15m', label:'5d',  type:'range3', subset:0},
    CHART_MONTH_1   : {range:'3mo', interval:'60m', label:'1M',  type:'range4', subset:0.33},
    CHART_MONTH_3   : {range:'3mo', interval:'60m', label:'3M',  type:'range4', subset:0},
    CHART_MONTH_6   : {range:'1y',  interval:'1d',  label:'6M',  type:'range5', subset:0.5},
    CHART_MONTH_12  : {range:'1y',  interval:'1d',  label:'1y',  type:'range5', subset:0}
});

class ChartManager extends Manager {
    
    constructor() {
        super()
    }

    get chart(){
        return this.context.chartData || {}
    }

    set chart(value){
        this.context.chartData = value
    }

    get fill(){
        return this.settings.fillCharts
    }

    set fill(value){
        this.settings.fillCharts = value
    }

    get type(){
        if(Utils.isUndefined(this.context.chartType))
            this.initType()
        
        return this.context.chartType
    }

    set type(value){
        this.context.chartType = value
    }

    get isDay(){
        return this.type.range == '1d'
    }

    initType(){
        let viewName = ViewType.keyFor(this.currentView.id)
        
        for (const [key, value] of Object.entries(ChartType)) {
            if(viewName == key){
                this.type = value
                return
            }
        }
    }
    
    //-----------------------------------------------------------------------------------------

    dataMatch(jsn) {
        this.uuid = jsn.context
        return !Utils.isUndefined(this.type) && this.type.type == jsn.payload.userInfo.type
    }

    //-----------------------------------------------------------------------------------------

    onDidReceiveSettings(jsn) {
        super.onDidReceiveSettings(jsn)
        this.fill = this.fill || 'enabled'
        this.initType()
    } 

    //-----------------------------------------------------------------------------------------

    onKeyUp(jsn) {
        super.onKeyUp(jsn)
        this.initType()
    }

    //-----------------------------------------------------------------------------------------

    onDidReceiveData(jsn) {
        super.onDidReceiveData(jsn)
        console.log("ChartManager - onDidReceiveData: ", jsn)

        this.chart = Object.assign({}, jsn.payload.response[0].meta)
        let raw = jsn.payload.response[0].indicators.quote[0].close
        raw = raw.map(x => x * rateManager.rateFor(this.settings.currency))

        if(Utils.isUndefined(raw) || raw.length == 0){
            console.log("ChartManager - REFRESH")
            dataManager.scheduleData()
            return
        }
        
        this.chart.raw = raw
        .filter(function(item){
            return typeof item == 'number' && isFinite(item);
        })
        .map(function (value, index){
            return {index:index, value:value}
        })
        
        let subset = this.type.subset < 1 ? this.chart.raw.length * this.type.subset : this.type.subset
        this.chart.data = this.chart.raw.slice(-subset)

        let extent = d3.extent(this.chart.data, function(d) { return d.value; })
        this.chart.min = extent[0]
        this.chart.max = extent[1]
        this.chart.dataMax = extent[1]
        this.chart.rangeMax = 145

        if(this.isDay){
            this.chart.min = this.data.prevClose.min(this.chart.min)
            this.chart.max = this.data.prevClose.max(this.chart.max)
            this.chart.isUp = this.data.prevClose < this.chart.data[this.chart.data.length-1].value
        }
        else
            this.chart.isUp = this.chart.data[0] < this.chart.data[this.chart.data.length-1].value

        return
    }

    //-----------------------------------------------------------------------------------------

    updateDisplay(jsn){
        super.updateDisplay(jsn)
        this.drawLeft(this.type.label,COLOR_FOREGROUND, 16, 21, 600, 6)
        
        if(!this.chart.hasOwnProperty('data') || this.chart.data.length == 0){
            this.drawingCtx.textAlign = "center"
            this.drawingCtx.fillStyle = COLOR_DIM
            this.drawingCtx.fillText('Loading', CANVAS_WIDTH/2, 110);
            return
        }
        
        this.drawChartData()
        
        if(this.isDay == true)
            this.drawCharLine()
    }

    //-----------------------------------------------------------------------------------------

    drawCharLine(){
        let scale = Utils.rangeToPercent(this.data.prevClose, this.chart.min, this.chart.max)
        
        this.drawingCtx.setLineDash([6, 3]);
        this.drawingCtx.lineWidth = 2
        this.drawingCtx.strokeStyle = COLOR_FOREGROUND
        this.drawingCtx.beginPath()
        this.drawingCtx.moveTo(0, CHART_BASE - (CHART_SCALE * scale))
        this.drawingCtx.lineTo(CHART_WIDTH, CHART_BASE - (CHART_SCALE * scale))
        this.drawingCtx.stroke()
        this.drawingCtx.setLineDash([]);
    }

    //-----------------------------------------------------------------------------------------

    drawChartData(){
        var x = d3.scaleLinear()
            .domain(d3.extent(this.chart.data, function(d) { return d.index; }))
            .range([-1, this.chart.rangeMax]);

        var y = d3.scaleLinear()
            .domain([this.chart.min, this.chart.max])
            .range([130, 75]);

        var area = d3.area()
            .x(function(d) { return x(d.index); })
            .y0(145)
            .y1(function(d) { return y(d.value); })
            .context(this.drawingCtx);

        var yMax = y(this.chart.dataMax)
        var grd = this.drawingCtx.createLinearGradient(0, yMax - 20, 0, 144);
        grd.addColorStop(0.4, this.chart.isUp ? COLOR_GREEN_CL : COLOR_RED_CL);
        grd.addColorStop(0.9, COLOR_BACKGROUND);

        this.drawingCtx.beginPath();
        this.drawingCtx.lineWidth = 2
        this.drawingCtx.fillStyle = grd
        this.drawingCtx.strokeStyle = this.chart.isUp ? COLOR_GREEN : COLOR_RED
        area(this.chart.data);        
        if(this.fill == 'enabled')
            this.drawingCtx.fill();
        this.drawingCtx.stroke();
        
    }
    
}
