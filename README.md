# com.soma.connect

This app is for Soma devices via the Soma Connect hub.

# How does it work
It connects via the Soma API for the Connect hub.

> Note: If you have a previous version for this app installed, then you need to remove the already added devices and add them again to enable additional or changed functionality.
You will also have to repair all related flows because of that. This only applies to new features for existing devices so should not be a problems yet.

# Currently supported:
* Soma Shades and Tilt 

## Capabilities
* Open / Close / Stop (removed in v1.0.1)
* Position
* Battery

# Flows:
## Triggers:
* Position Changed

## Conditions:
* Position

## Then:
* Set Position to

# Configuration
* Be sure that your Soma blinds are paired and working with the connect hub.
* Specify the IP address of your connect hub in the App settings page

# Notes
Currently only supports one hub

# Version Log

## 1.0.1
Simplified interface to follow Athom guidelines, e.g. removed Open / Close / Stop controls.

## 1.0.0
* Fixed battery % and alarm, Added window covering state for Open / Close / Stop controls.

## 0.0.7
* Fixed battery levels so they match the Soma App.

## 0.0.6
* Added battery alarm trigger
* Fixed battery polling

## 0.0.5
* First beta
