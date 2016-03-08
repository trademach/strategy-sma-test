'use strict';

function sma(length, ticks) {
  if(ticks.length < length) return null;

  let sumOfPrices = 0;
  for(let i = ticks.length - length; i < ticks.length; i++) {
    const tick = ticks[i];
    const price = (tick.bid + tick.ask) / 2;
    sumOfPrices += price;
  }

  return sumOfPrices / length;
}

module.exports = sma;
