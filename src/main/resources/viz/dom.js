/** DOM handles for the page shell and chart. */
const byId = id => document.getElementById(id);

export const els = {
  heading: document.querySelector('h1'),
  lede: document.querySelector('.lede'),
  groups: byId('view-groups'),
  granularity: byId('granularity'),
  stats: byId('stats'),
  chart: byId('chart'),
  yAxis: byId('y-axis'),
  scroll: byId('plot-scroll'),
  plot: byId('plot'),
  object: byId('object'),
  tooltip: byId('tooltip'),
  candleHelpLink: byId('candle-help-link'),
  candleModal: byId('candle-modal'),
  candleModalClose: byId('candle-modal-close'),
  cars: byId('cars'),
  dashAverage: byId('dash-average'),
  langToggle: byId('lang-toggle'),
};
