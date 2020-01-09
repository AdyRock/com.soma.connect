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
        Homey.app.updateLog( this.getName() + ': Getting Values' );
        try
        {
            const devData = this.getData();
            const settings = this.getSettings();

            // Get the current position Value from the device using the unique mac stored during pairing
            const position = await Homey.app.getBridge().getPosition( devData[ 'id' ] );
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

            const battery = await Homey.app.getBridge().getBattery( devData[ 'id' ] );
            if ( battery > 320 )
            {
                await this.setCapabilityValue( 'measure_battery', ( battery - 320 ) );
            }
            else
            {
                await this.setCapabilityValue( 'measure_battery', 0 );
            }

            if ( battery > 310 )
            {
                await this.setCapabilityValue( 'alarm_battery', ( battery < 370 ) );
                if ( battery < 370 )
                {
                    Homey.app.updateLog( 'Low Battery: ' + battery, true );
                }
            }
            else
            {
                Homey.app.updateLog( 'Odd Battery: ' + battery );
            }
        }
        catch ( err )
        {
            Homey.app.updateLog( this.getName() + " getBatteryValues Error " + err );
        }

        //        setTimeout( this.getBatteryValues.bind( this ), 600000 );
    }
}

module.exports = somaShade;