import Ember from 'ember';
import StateBuffer from 'affinity-engine-data-manager-rewindable-lokijs/models/affinity-engine/data-manager-rewindable-lokijs/state-buffer';
import { configurable } from 'affinity-engine';
import multiton from 'ember-multiton-service';

const {
  Service,
  computed,
  get,
  getProperties,
  set
} = Ember;

const configurationTiers = [
  'config.attrs.plugin.dataManager',
  'config.attrs.global'
];

export default Service.extend({
  config: multiton('affinity-engine/config', 'engineId'),
  eBus: multiton('message-bus', 'engineId'),

  maxStatePoints: configurable(configurationTiers, 'maxStatePoints'),

  statePoints: computed(() => Ember.A([])),
  stateBuffer: computed('statePoints.lastObject', {
    get() {
      return StateBuffer.create(get(this, 'statePoints.lastObject'));
    }
  }),

  init(...args) {
    this._super(...args);

    const eBus = get(this, 'eBus');

    eBus.subscribe('restartingEngine', this, this._reset);
    eBus.subscribe('shouldLoadLatestStatePoint', this, this._loadStatePoints);
    eBus.subscribe('shouldFileStateBuffer', this, this._fileStateBuffer);
  },

  _reset() {
    set(this, 'statePoints', Ember.A([]));
  },

  _loadStatePoints(statePoints) {
    set(this, 'statePoints', Ember.A(statePoints));
  },

  _fileStateBuffer() {
    const { stateBuffer, maxStatePoints, statePoints } = getProperties(this, 'stateBuffer', 'maxStatePoints', 'statePoints');

    statePoints.pushObject(stateBuffer.toPojo());

    while (statePoints.length > maxStatePoints) {
      statePoints.shiftObject();
    }
  }
});
