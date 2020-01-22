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

        // register a capability listener
        this.registerCapabilityListener( 'windowcoverings_closed', this.onCapabilityClosed.bind( this ) );
        this.registerCapabilityListener( 'windowcoverings_set', this.onCapabilityPosition.bind( this ) );
    }

    initDevice()
    {
        this.getDeviceValues();
        this.getBatteryValues();
    }

    // this method is called when the Homey device has requested a state change (turned on or off)
    async onCapabilityClosed( value, opts )
    {
        var result = "";

        try
        {
            // Get the device information stored during pairing
            const devData = this.getData();
            const settings = this.getSettings();

            // The device requires '100' for closed and '50' for open
            var data = settings.openPosition;
            if ( value )
            {
                data = settings.closedPosition;
            }

            // Set the switch Value on the device using the unique mac stored during pairing
            result = await Homey.app.getBridge().setPosition( devData[ 'id' ], data );
            if ( result != -1 )
            {
                this.setAvailable();
                this.getDeviceValues();
            }
        }
        catch ( err )
        {
            Homey.app.updateLog( this.getName() + " onCapabilityOnoff Error " + err );
        }
    }

    // this method is called when the Homey device has requested a dim level change ( 0 to 1)
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
            const settings = this.getSettings();

            // Get the current position Value from the device using the unique mac stored during pairing
            const position = await Homey.app.getBridge().getPosition( devData[ 'id' ] );
            Homey.app.updateLog( this.getName() + ': Position = ' + position);
            if ( position >= 0 )
            {
                this.setAvailable();
                await this.setCapabilityValue( 'windowcoverings_closed', ( position == ( settings.closedPosition / 100 ) ) );
                await this.setCapabilityValue( 'windowcoverings_set', position );
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
            Homey.app.updateLog( this.getName() + ': Battery = ' + battery);

            // Calculate battery level as a percentage of full charge that matches the official Soma App
            // The range should be between 3.6 and 4.1 volts for 0 to 100% charge
            var battertPct = ( battery - 360 ) * 2;

            // Keep in range of 0 to 100% as the level can be more than 100% when on the charger
            if (battertPct > 100)
            {
                battertPct = 100;
            }
            else if (battertPct < 0)
            {
                battertPct = 0;
            }

            await this.setCapabilityValue( 'measure_battery', battertPct );

            // Use a bit of hysteresis so we don't get multiple alarms especially as the voltage can drop temporarily when the blind moves
            if ((battery < 380) && (this.lowBatteryReadings < 4))
            {
                this.lowBatteryReadings++;
            }
            else
            {
                this.lowBatteryReadings = 0;
            }

            await this.setCapabilityValue( 'alarm_battery', (this.lowBatteryReadings >= 4) );
        }
        catch ( err )
        {
            Homey.app.updateLog( this.getName() + " getBatteryValues Error " + err );
        }
    }
}

module.exports = somaShade;