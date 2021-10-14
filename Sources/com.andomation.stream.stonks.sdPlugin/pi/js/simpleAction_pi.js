class SimpleActionPI extends ActionPI {

    constructor(){
        super()
        this.type = this.type + ".simple";
    }

    init(jsn) {
        super.init(jsn)
        
        this.settings.symbol = this.settings.symbol ? this.settings.symbol : "CRM";
        this.settings.decimals = this.settings.decimals ? this.settings.decimals : 2;
        this.settings.interval = this.settings.interval ? this.settings.interval : 60;
        //this.settings.single-check = "checked" //true//this.settings.interval ? this.settings.interval : 60;
        //singlechk
        $SD.api.setSettings(this.uuid, this.settings);
        this.injectContent("content/simpleAction.html", this.onContentLoaded);
    }

    onContentLoaded = () => {
        console.log("Callback")
        updateUI(this.settings);
        document.dispatchEvent(new Event('DOMContentLoaded'));
        // this.initField("symbol");//, "CRM");
        // this.initField("decimals");//, 2);
        // this.initField("interval");//, 60);
    };
};