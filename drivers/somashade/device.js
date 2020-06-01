'use strict';

const Homey = require( 'homey' );
const SomaConnectBridge = require( '../../lib/SomaConnectBridge' );

class somaShade extends Homey.Device
{

    async onInit()
    {
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

    // this method is called when the Homey device has requested a position change ( 0 to 1)
    async onCapabilityPosition( value, opts )
    {
        var result = "";

        try
        {
            // Homey return a value of 0 to 1 but the real device requires a value of 0 to 100
            value *= 100;

            // Get the device information stored during pairing
            const devData = this.getData();

            // Set the dim Value on the device using the unique feature ID stored during pairing
            result = await Homey.app.getBridge().setPosition( devData[ 'id' ], value );
            if ( result != -1 )
            {
                this.setAvailable();
                this.getDeviceValues();
            }
        }
        catch ( err )
        {
            Homey.app.updateLog( this.getName() + " onCapabilityOnDimError " + err );
        }
    }

    async getDeviceValues()
    {
        try
        {
            const devData = this.getData();

            // Get the current position Value from the device using the unique mac stored during pairing
            const position = await Homey.app.getBridge().getPosition( devData[ 'id' ] );
            Homey.app.updateLog( this.getName() + ': Position = ' + position );
            if ( position >= 0 )
            {
                this.setAvailable();
                await this.setCapabilityValue( 'windowcoverings_set', position / 100 );
            }
        }
        catch ( err )
        {
            Homey.app.updateLog( this.getName() + " getDeviceValues Error " + err );
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
        catch ( err )
        {
            Homey.app.updateLog( this.getName() + " getBatteryValues Error " + err );
        }
    }
}

module.exports = somaShade;