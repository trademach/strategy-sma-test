'use strict';

const config = require('config');
const zmq = require('zmq');
const mongoose = require('mongoose');
const moment = require('moment');

const socketIn = zmq.socket('sub');
const socketOut = zmq.socket('pub');

const TickSchema = new mongoose.Schema({}, { strict: false, toObject: true });
const Tick = mongoose.model('ticks', TickSchema, 'ticks');

function init() {
  socketIn.connect(config.get('mq.inflow.uri'));
  socketIn.subscribe('oanda');
  socketIn.on('message', handleMessage);

  socketOut.connect(config.get('mq.outflow.uri'));
}

function handleMessage(topic, data) {
  const tick = JSON.parse(data);

  const instrument = tick.instrument;
  console.log(`received - ${instrument}`);
}

init();
