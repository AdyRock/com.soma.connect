'use strict';

const Homey = require( 'homey' );
const SomaConnectBridge = require( '../../lib/SomaConnectBridge' );

class somaShade extends Homey.Device
{

    async onInit()
    {
        this.onlineState = false;
        try
        {
            Homey.app.updateLog( 'Device initialising( Name: ' + this.getName() + ', Class: ' + this.getClass() + ")" );

            this.initDevice();
            Homey.app.updateLog( 'Device initialised( Name: ' + this.getName() + ")" );
        }
        catch ( err )
        {
            Homey.app.updateLog( this.getName() + " OnInit Error: " + err );
        }

        this.lowBatteryReadings = 0;
        this.lowBatteryValue = 380;
        this.version = "";
        this.deviceType = this.getSetting( 'deviceType' );
        if ( !this.deviceType )
        {
            this.deviceType = 'shade';
        }
        this.reverseDirection = this.getSetting( 'reverseDirection' );
        if ( !this.reverseDirection )
        {
            this.reverseDirection = false;
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
    }

    initDevice()
    {
        this.getDeviceValues();
        this.getBatteryValues();
    }

    async onSettings( oldSettingsObj, newSettingsObj, changedKeysArr )
    {
        if ( changedKeysArr.indexOf( "deviceType" ) >= 0 )
        {
            this.deviceType = newSettingsObj.deviceType;
        }
        if ( changedKeysArr.indexOf( "reverseDirection" ) >= 0 )
        {
            this.reverseDirection = newSettingsObj.reverseDirection;
        }
    }

    async stop()
    {
        const devData = this.getData();
        return await Homey.app.getBridge().stop( devData[ 'id' ] );
    }

    // this method is called when the Homey device has requested a position change ( 0 to 1)
    async onCapabilityPosition( value, opts )
    {
        var result = "";

        try
        {
            if ( this.reverseDirection )
            {
                value = 1 - value;
            }

            // Homey return a value of 0 to 1 but the real device requires a value of 0 to 100 prior to version 2.2.0 and -100 to 100 for 2.2.0. and later
            if ( ( this.deviceType === 'tilt' ) && Homey.app.compareVersions( this.version, "2.2.0" ) >= 0 )
            {
                value *= 200;
                value -= 100;
            }
            else
            {
                value *= 100;
            }

            // Get the device information stored during pairing
            const devData = this.getData();

            // Set the dim Value on the device using the unique feature ID stored during pairing
            Homey.app.updateLog( this.getName() + " onCapabilityPosition " + value );
            result = await Homey.app.getBridge().setPosition( devData[ 'id' ], value );
            if ( result != -1 )
            {
                this.setAvailable();
                this.getDeviceValues();

                if ( !this.onlineState )
                {
                    this.onlineState = true;

                    let driver = this.getDriver();
                    driver.triggerDeviceOnlineStateChange( this, this.onlineState );
                }
            }
            else
            {
                if ( this.onlineState )
                {
                    this.onlineState = false;

                    let driver = this.getDriver();
                    driver.triggerDeviceOnlineStateChange( this, this.onlineState );
                }

            }
        }
        catch ( err )
        {
            Homey.app.updateLog( this.getName() + " onCapabilityPosition Error: " + Homey.app.varToString( err ) );
        }
    }

    async getDeviceValues()
    {
        try
        {
            const devData = this.getData();

            // Get the current position Value from the device using the unique mac stored during pairing
            const result = await Homey.app.getBridge().getPosition( devData[ 'id' ] );
            Homey.app.updateLog( this.getName() + ': Position = ' + Homey.app.varToString( result ) );
            if ( ( result != -1 ) && ( result.result === "success" ) )
            {
                this.setAvailable();

                let position = result.position;
                this.version = result.version;
                if ( ( this.deviceType === 'tilt' ) && Homey.app.compareVersions( this.version, "2.2.0" ) >= 0 )
                {
                    position = position / 2 + 50;
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

                    let driver = this.getDriver();
                    driver.triggerDeviceOnlineStateChange( this, this.onlineState );
                }
            }
            else
            {
                if ( this.onlineState )
                {
                    this.onlineState = false;

                    let driver = this.getDriver();
                    driver.triggerDeviceOnlineStateChange( this, this.onlineState );
                }

            }
        }
        catch ( err )
        {
            Homey.app.updateLog( this.getName() + " getDeviceValues Error " + Homey.app.varToString( err ) );
        }
    }

    async getBatteryValues()
    {
        try
        {
            const devData = this.getData();

            // Get the battery voltage. Comes back as v * 100, e.g. 391 = 3.91v
            const battery = await Homey.app.getBridge().getBattery( devData[ 'id' ] );
            Homey.app.updateLog( this.getName() + ': Battery = ' + battery );

            if ( battery >= 0 )
            {
                // Calculate battery level as a percentage of full charge that matches the official Soma App
                // The range should be between 3.6 and 4.1 volts for 0 to 100% charge
                var batteryPct = ( battery - 360 ) * 2;

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
        }
        catch ( err )
        {
            Homey.app.updateLog( this.getName() + " getBatteryValues Error " + Homey.app.varToString( err ) );
        }
    }
}

module.exports = somaShade;