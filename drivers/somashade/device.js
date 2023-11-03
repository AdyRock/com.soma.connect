/*jslint node: true */
'use strict';

const Homey = require( 'homey' );
const SomaConnectBridge = require( '../../lib/SomaConnectBridge' );

class somaShade extends Homey.Device
{

    async onInit()
    {
        if ( this.homey.app.logEnabled )
        {
            this.homey.app.updateLog( 'Device initialising( Name: ' + this.getName() + ', Class: ' + this.getClass() + ")" );
        }

        this.onlineState = true;
        this.lowBatteryReadings = 0;
        this.lowBatteryValue = 380;
        this.version = "";
        this.deviceType = this.getSetting( 'deviceType' );
        if ( !this.deviceType )
        {
            this.deviceType = 'shade';
            this.setSettings( {'deviceType': this.deviceType} );
        }
        this.reverseDirection = this.getSetting( 'reverseDirection' );
        if ( !this.reverseDirection )
        {
            this.reverseDirection = false;
            this.setSettings( {'reverseDirection': this.reverseDirection} );
        }

        this.morning_mode = this.getSetting( 'morning_mode' );
        if ( !this.morning_mode )
        {
            this.morning_mode = false;
            this.setSettings( {'morning_mode': this.morning_mode} );
        }

        if ( this.hasCapability( 'windowcoverings_state' ) )
        {
            this.removeCapability( 'windowcoverings_state' );
        }

        if ( this.hasCapability( 'windowcoverings_closed' ) )
        {
            this.removeCapability( 'windowcoverings_closed' );
        }

        if ( this.hasCapability( 'alarm_battery' ) )
        {
            this.removeCapability( 'alarm_battery' );
        }

        // register a capability listener
        this.registerCapabilityListener( 'windowcoverings_set', this.onCapabilityPosition.bind( this ) );

        this.initialised = true;

        this.getDeviceValues();
        
        if ( this.homey.app.logEnabled )
        {
            this.homey.app.updateLog( 'Device initialise complete( Name: ' + this.getName() + ', Class: ' + this.getClass() + ")" );
        }
    }

    async onAdded()
    {
        this.getDeviceValues();
        this.getBatteryValues();
    }

    async onSettings( { oldSettings, newSettings, changedKeys } )
    {
        if ( changedKeys.indexOf( "deviceType" ) >= 0 )
        {
            this.deviceType = newSettings.deviceType;
        }
        if ( changedKeys.indexOf( "reverseDirection" ) >= 0 )
        {
            this.reverseDirection = newSettings.reverseDirection;
        }
        if ( changedKeys.indexOf( "morning_mode" ) >= 0 )
        {
            this.morning_mode = newSettings.morning_mode;
        }

        this.getDeviceValues();
    }

    setOffline( message, forceUpdate )
    {
        if (this.onlineState || forceUpdate)
        {
            this.onlineState = false;

            if (message === 'NOSHADEWITHMAC')
            {
                message = "No Shade with this MAC address found on the Hub. Try the Repair option if it has moved to a different Hub";
            }
            else if (message === 'HTTP Catch: Timeout')
            {
                message = "No response from Hub. Check the IP address is correct and the Hub is powered on";
            }
    
            this.setUnavailable( message );
            this.driver.triggerDeviceOnlineStateChange( this, this.onlineState );
        }
        this.homey.app.updateLog( this.getName() + " onCapabilityPosition Error: " + this.homey.app.varToString( message ), true );
    }

    async getBridgeId()
    {
        const devData = this.getData();
        let bridgeId = this.getSetting( 'bridgeId');
        if (!bridgeId)
        {
            //Find the bridge that has this device
            bridgeId = await thisfindBridgeWithDevice();
        }

        return {bridgeId: bridgeId, devId: devData.id};

    }

    async findBridgeWithDevice()
    {
        let devices = await this.homey.app.getDevices();
        let index = devices.findIndex( ( device ) =>
        {
            return device.data.id === devData.id;
        } );

        if (index >= 0)
        {
            bridgeId = devices[index].settings.bridgeId;
            this.setSettings( {'bridgeId': bridgeId} );
            return bridgeId;
        }
        return null;
    }

    async stop()
    {
        let bridgeData = await this.getBridgeId();
        const bridge = await this.homey.app.getBridge(bridgeData.bridgeId);
        if (!bridge)
        {
            this.setOffline( "No Bridge detected" );
            throw new Error("No Bridge detected");
        }
        return bridge.stop( bridgeData.devId );
    }

    // this method is called when the Homey device has requested a position change ( 0 to 1)
    async onCapabilityPosition( value, opts )
    {
        var result = "";

        //        try
        {
            if ( this.reverseDirection )
            {
                value = 1 - value;
            }

            let upwards = "";

            // Homey return a value of 0 to 1 but the real device requires a value of 0 to 100 prior to version 2.2.0 and -100 to 100 for 2.2.0. and later
            if ( ( this.deviceType === 'tilt' ) && this.homey.app.compareVersions( this.version, "2.2.0" ) >= 0 )
            {
                value *= 200;
                value -= 100;

                if (this.homey.app.compareVersions( this.version, "2.2.5" ) >= 0 )
                {
                    if (value < 0)
                    {
                        value *= -1;
                        upwards = "?close_upwards=1";
                    }

                    if (this.morning_mode || opts.slow)
                    {
                        upwards += "?morning_mode=1";
                    }
                }
            }
            else
            {
                value *= 100;
            }

            // Get the device information stored during pairing
            let bridgeData = await this.getBridgeId();

            // Set the dim Value on the device using the unique feature ID stored during pairing
            if ( this.homey.app.logEnabled )
            {
                this.homey.app.updateLog( this.getName() + " Set Position " + value );
            }

            const bridge = await this.homey.app.getBridge(bridgeData.bridgeId);
            if (!bridge)
            {
                this.setOffline( "No Bridge detected" );
                throw new Error("No Bridge detected");
            }
            result = await bridge.setPosition( bridgeData.devId, value, upwards );
            if ( result.result != 'error' )
            {
                if ( this.homey.app.logEnabled )
                {
                    this.homey.app.updateLog( this.getName() + " Set Position " +  this.homey.app.varToString( result ) );
                }
                
                this.setAvailable();
                //this.getDeviceValues();

                if ( !this.onlineState )
                {
                    this.onlineState = true;

                    this.driver.triggerDeviceOnlineStateChange( this, this.onlineState );
                }
            }
            else
            {
                this.setOffline( result.msg );
            }
        }
        // catch ( err )
        // {
        //     this.setOffline( result );
        // }
    }

    async getDeviceValues()
    {
        try
        {
            // Get the current position Value from the device using the unique mac stored during pairing
            let bridgeData = await this.getBridgeId();
            if (!bridgeData.bridgeId)
            {
                this.setOffline( "No Bridge detected" );
                return false;
            }

            const bridge = await this.homey.app.getBridge(bridgeData.bridgeId);
            if (!bridge)
            {
                this.setOffline( "No Bridge detected" );
                throw new Error("No Bridge detected");
            }
            const result = await bridge.getPosition( bridgeData.devId );
            if ( this.homey.app.logEnabled )
            {
                this.homey.app.updateLog( this.getName() + ': Position = ' + this.homey.app.varToString( result ) );
            }

            if ( ( result != -1 ) && ( result.result === "success" ) )
            {
                this.setAvailable();

                let position = result.position;
                this.version = result.version;
                if ( ( this.deviceType === 'tilt' ) && this.homey.app.compareVersions( this.version, "2.2.0" ) >= 0 )
                {
                    if (this.homey.app.compareVersions( this.version, "2.2.5" ) >= 0 )
                    {
                        position = position / 2;
                        if (!result.closed_upwards)
                        {
                            position = 50 + position;
                        }
                        else
                        {
                            position = 50 - position;
                        }
                    }
                    else
                    {
                        position = position / 2 + 50;
                    }
                }

                position = position / 100;

                if ( this.reverseDirection )
                {
                    position = 1 - position;
                }

                await this.setCapabilityValue( 'windowcoverings_set', position );

                if ( !this.onlineState )
                {
                    this.onlineState = true;
                    this.getBatteryValues();
                }

                return true;
            }
            else
            {
                this.setOffline( result.msg );
                return false;
            }
        }
        catch ( err )
        {
            this.setOffline( err.message );
        }

        return false;
    }

    async getBatteryValues()
    {
        try
        {
            let bridgeData = await this.getBridgeId();
            if (!bridgeData.bridgeId)
            {
                this.setOffline( "No Bridge detected" );
                return false;
            }

            // Get the battery voltage. Comes back as v * 100, e.g. 391 = 3.91v
            const bridge = await this.homey.app.getBridge(bridgeData.bridgeId);
            if (!bridge)
            {
                this.setOffline( "No Bridge detected" );
                throw new Error("No Bridge detected");
            }
            const battery = await bridge.getBattery( bridgeData.devId );
            if ( this.homey.app.logEnabled )
            {
                this.homey.app.updateLog( this.getName() + ': Battery = ' + battery );
            }

            if ( battery === undefined )
            {
                await this.setCapabilityValue( 'measure_battery', null );
                return false;
            }

            // if battery.battery_percentage is defined then use that
            if (battery.battery_percentage !== undefined)
            {
                await this.setCapabilityValue( 'measure_battery', battery.battery_percentage );
            }
            else if ( battery.battery_level >= 0 )
            {
                // Calculate battery level as a percentage of full charge that matches the official Soma App
                // The range should be between 3.6 and 4.1 volts for 0 to 100% charge
                var batteryPct = ( battery.battery_level - 360 ) * 2;

                // Keep in range of 0 to 100% as the level can be more than 100% when on the charger
                if ( batteryPct > 100 )
                {
                    batteryPct = 100;
                }
                else if ( batteryPct < 0 )
                {
                    batteryPct = 0;
                }

                await this.setCapabilityValue( 'measure_battery', batteryPct );
            }

            return true;
        }
        catch ( err )
        {
            this.homey.app.updateLog( this.getName() + " getBatteryValues Error " + this.homey.app.varToString( err ), true );
        }

        return false;
    }

    async getLightValues()
    {
        try
        {
            let bridgeData = await this.getBridgeId();
            if (!bridgeData.bridgeId)
            {
                this.setOffline( "No Bridge detected" );
                return false;
            }

            // Get the light level. Comes back as 
            const bridge = await this.homey.app.getBridge(bridgeData.bridgeId);
            if (!bridge)
            {
                this.setOffline( "No Bridge detected" );
                throw new Error("No Bridge detected");
            }
            const light = await bridge.getLightLevel( bridgeData.devId );
            if ( this.homey.app.logEnabled )
            {
                this.homey.app.updateLog( this.getName() + ': Light Level = ' + light );
            }

            if ( light === undefined )
            {
                await this.setCapabilityValue( 'measure_battery', null );
            }

            if ( light >= 0 )
            {
                if (!this.hasCapability('measure_luminance'))
                {
                    await this.addCapability('measure_luminance');
                }
                await this.setCapabilityValue( 'measure_luminance', light );
            }

            return true;
        }
        catch ( err )
        {
            this.homey.app.updateLog( this.getName() + " getBatteryValues Error " + this.homey.app.varToString( err ), true );
        }

        return false;
    }
}

module.exports = somaShade;