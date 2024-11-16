'use strict';
const isDeepEqual = require('deep-equal');
const { Thing, State } = require('abstract-things');
const { boolean } = require('abstract-things/values');
const automations = require('../../automations');

module.exports = Thing.mixin(Parent => class extends Parent.with(State) {
	static get capability() {
		return 'miio:automation';
	}

    _automation = {
        enabled: false,
        cfg: {},
        swUpPoint: 0,
        swDownPoint: 0,
        swCmd: {},
        pauseEndTime: null,
        status: 'ready' // 'paused...' / 'busy' / 'error' / 'disabled'
    }

    /**
	 * Get or set if the automation is active.
	 *
	 * @param {boolean} active
	 *   Optional boolean to switch automation to.
	 */
    automation(active){ // get or set and save automation state
        if(active === undefined){ 
            if(this._automation.pauseEndTime) {  
                let pauseTimeout = this._automation.pauseEndTime - Date.now();
                if(pauseTimeout > 0){
                    return {automation: 'paused for '+ Math.ceil(pauseTimeout/60000) +'m'};
                }
            }
            return {automation: this._automation.enabled};
        }
        if(this._automation.pauseEndTime){ // turn off automation pause;
            this._automation.pauseEndTime = null;
        }

        this._automation.enabled = boolean(active);

        if(!this._automation._saveingEnabled){
            let automationEnabledToSave = boolean(active);
            this._automation._saveingEnabled = setTimeout(()=>{

                delete this._automation._saveingEnabled;

                if(this._automation.enabled === automationEnabledToSave){ 
                    automations.update(this.id, "automation", automationEnabledToSave)
                    .catch(err => {
                        this._automation.status = 'error';
                        return {error: 'Automation > '+ err};
                    });
                }
            }, 5000);
        }
        return {automation: this._automation.enabled};
    }
    
    autocfg(cfg){ // get or set automation cfg object
        if(cfg === undefined){
            return {autocfg: this._automation.cfg}; // get active automation config
        }
        if(!isDeepEqual(cfg, this._automation.cfg)){ 
            this._automation.cfg = cfg; // set new automation config.
            this._automation.swUpPoint = 0; // update swUpPoint & swDownPoint at the next run of doAutomation() 
        } 
        return true;
    }

    saveAutocfg(cfg){
        let cfgToSave = cfg ? cfg : this._automation.cfg; // save cfg or active automation config to file
        if(typeof(cfgToSave) === 'object'){
            automations.update(this.id, cfgToSave.name , cfgToSave)
            .then(()=>{return true;})
            .catch(err => {
                this._automation.status = 'error';
                return {error: 'Automation > '+ err};
            });
        }
    }

    readAutocfg(cfgName){
        let cfgToRead = cfgName ? cfgName : automations._loadedCfgName[this.id] || 'default';       
        return automations.get(this.id, cfgToRead) // read automation config from file
            .then(cfg => { 
                let cfgToReturn = cfg.name ? {autocfg: cfg} : cfg
                return cfgToReturn;
            })
            .catch(err => {
                this._automation.status = 'error';
                return {error: 'Automation > '+ err};
            });
    }

    loadAutocfg(cfgName){
        let cfgToLoad = undefined;
        if(cfgName){
            cfgToLoad = cfgName;
            automations._loadedCfgName[this.id] = cfgToLoad;
        } 
        this.readAutocfg(cfgToLoad) // read automation config from file
            .then(cfg => {
                if(cfg.autocfg){
                    return this.autocfg(cfg.autocfg); // set automation config.
                }
                this._automation.status = 'error';
                return {error: 'Automation > loadAutocfg(): incorrect automation config'};
            });    
        this.readAutocfg("automation") // read automation status from file
            .then(cfg => {
                if(!cfg.error){
                    this._automation.enabled = boolean(cfg); // set automation status
                }
                return {automation: this._automation.enabled};
            })
    }

    doAutomation(sensor){ 
        let a = this._automation, p = this.properties;

        if(a.cfg.sensor === undefined){
            return {error: 'Automation > Error: Automation config undefined'};
        } else if(sensor === undefined){ // use internal sensor
            sensor = p[a.cfg.sensor];  //console.log("---> Device: " + this.id + " enabled: " + a.enabled + " automation sensor value: "+ p[a.cfg.sensor]);
        } else if(sensor < a.cfg.sensorMin || sensor > a.cfg.sensorMax){     // do przetestowania
            return {error: 'Automation > Error: Invalid sensor value `'+ sensor +'`'};
        } 
        let payload = {};
        if(a.enabled){
            if(a.status !== 'busy'){
                if(a.status !== 'error'){
                    // Check if there was any manual switching. If yes, pause automation mode, for time = pauseTime.
                    for(let key in a.swCmd){
                        if(p[key] !== undefined && a.swCmd[key] !== p[key]){   
                            if(a.swUpPoint && a.swCmd[key] !== undefined){
                                a.pauseEndTime = Date.now() + a.cfg.pauseTime * 60000;
                                a.swUpPoint = 0; // update swUpPoint & swDownPoint after pause time ends
                            }
                            a.swCmd[key]= p[key];
                            payload[key]= p[key];
                        }
                    }
                }
                if(a.pauseEndTime){  
                    let pauseTimeout = a.pauseEndTime - Date.now();
                    if(pauseTimeout > 0){
                        payload.automation = 'paused for '+ Math.ceil(pauseTimeout/60000) +'m';
                        return payload;
                    } else {
                        a.pauseEndTime = null;
                    }
                }  
                if((sensor < a.swDownPoint)||(sensor > a.swUpPoint)){ 
                    a.status = 'busy';       
                    let maxIndex = a.cfg.swPoints.length -1;
                    for(let i = maxIndex; i > -1; i--){
                        let swPoint = a.cfg.swPoints[i];
                        if(sensor > swPoint.value){
                            a.swCmd = {}; // delete old swCmd keys
                            for(let key in swPoint){ // save switching commands state
                                if(key !== 'value'){
                                    a.swCmd[key]= swPoint[key];
                                } 
                            }
                            a.swDownPoint = swPoint.value - a.cfg.swPointDelta;
                            if(i === 0){
                                a.swUpPoint = a.cfg.swOnPoint;
                            } else if(i === maxIndex) {
                                a.swUpPoint = a.cfg.sensorMax + 1;
                            } else {
                                a.swUpPoint = a.cfg.swPoints[i+1].value + a.cfg.swPointDelta;
                            } break;
                        }
                    }
                }
                if(a.status !== 'ready'){
                    return (async ()=>{
                        try{
                            for(let key in a.swCmd){
                                if(p[key] !== undefined && a.swCmd[key] !== p[key]){
                                    payload[key] = await this[key](a.swCmd[key]);
                                }
                            }
                            a.status = 'ready';
                            payload.automation = a.status;
                            return payload;
                        }catch(err){
                            a.status = 'error';
                            return {error: 'Automation > '+ err};
                        }
                    })();
                } // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
            } 
            payload.automation = a.status;
            return payload;
        } else {
            if(a.status !== 'disabled'){
                a.status = 'disabled';
            }
            payload.automation = 'disabled';
            return payload;
        }
    }
})
