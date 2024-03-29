'use strict';

const config = require('config');
const zmq = require('zmq');
const mongoose = require('mongoose');
const moment = require('moment');

const indicators = require('./indicators');

const INSTRUMENTS = config.get('instruments');
const SMA_DURATION = config.get('strategy.sma-duration');

const MQ_INFLOW_URI = config.get('mq.inflow.uri');
const MQ_INFLOW_TOPIC = config.get('mq.inflow.topic');

const MQ_OUTFLOW_URI = config.get('mq.outflow.uri');
const MQ_OUTFLOW_TOPICS = config.get('mq.outflow.topics');

const socketIn = zmq.socket('sub');
const socketOut = zmq.socket('pub');

const TickSchema = new mongoose.Schema({}, { strict: false, toObject: true });
const Tick = mongoose.model('ticks', TickSchema, 'ticks');

let tickQueues = {};
INSTRUMENTS.forEach(i => tickQueues[i] = []);
let lastDiffs = {};

function init() {
  socketIn.connect(MQ_INFLOW_URI);
  socketIn.subscribe(MQ_INFLOW_TOPIC);
  socketIn.on('message', handleMessage);

  socketOut.connect(MQ_OUTFLOW_URI);
}

function handleMessage(topic, data) {
  const tick = JSON.parse(data);

  const instrument = tick.instrument;

  delete tick.instrument;
  delete tick.time;
  delete tick.source;

  // return if instrument is not included
  if(INSTRUMENTS.indexOf(instrument) === -1) return;

  const tickQueue = tickQueues[instrument];
  tickQueue.push(tick);

  // return if there aren't enough ticks yet
  if(tickQueue.length < SMA_DURATION) return;

  // calculate difference between latest price and SMA
  const price = (tick.bid + tick.ask) / 2;
  const sma = indicators.sma(SMA_DURATION, tickQueues[instrument]);
  const diff = price - sma;

  const lastDiff = lastDiffs[instrument];
  lastDiffs[instrument] = diff;

  // return if there is not last diff yet
  if(typeof lastDiff !== 'number') return;

  let signal;
  if(lastDiff < 0 && diff > 0) {
    signal = 'long';

  } else if(lastDiff > 0 && diff < 0) {
    signal = 'short';

  }

  if(signal) {
    const positionSize = config.get('strategy.position-size');
    let position;

    if(signal === 'long') {
      position = positionSize;

    } else if(signal === 'short') {
      position = -positionSize;

    } else {
      return;
    }

    console.log(`signal - ${signal} => ${instrument}`);

    const outflowMessage = {
      strategy: 'smaTest',
      instrument: instrument,
      action: 'match',
      position: position,
      ask: tick.ask,
      bid: tick.bid,
      type: 'market',
    };

    MQ_OUTFLOW_TOPICS.forEach(t => socketOut.send([t, JSON.stringify(outflowMessage)]));
  }
}

init();
