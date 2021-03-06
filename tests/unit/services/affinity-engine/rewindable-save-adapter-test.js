import Ember from 'ember';
import { moduleFor, test } from 'ember-qunit';
import { initialize as initializeEngine } from 'affinity-engine';
import { initializeQUnitAssertions } from 'ember-message-bus';
import multiton from 'ember-multiton-service';

const {
  getOwner,
  run
} = Ember;

const { later, next } = run;

const Publisher = Ember.Object.extend({ eBus: multiton('message-bus', 'engineId'), engineId: 'foo' });
let publisher;

moduleFor('service:affinity-engine/data-manager-rewindable-lokijs', 'Unit | Service | affinity engine/rewindable save state manager', {
  integration: true,

  beforeEach() {
    const appInstance = getOwner(this);

    localStorage.clear();

    initializeEngine(appInstance);
    initializeQUnitAssertions(appInstance, 'eBus', Ember.Object.extend({ eBus: multiton('message-bus', 'engineId'), engineId: 'foo' }));
    appInstance.register('ember-message-bus:publisher', Publisher);
    publisher = appInstance.lookup('ember-message-bus:publisher');
  }
});

test('saves returns a promise of all saves namespaced to dataGroup', function(assert) {
  assert.expect(2);

  const engineId = 'foo';
  const dataGroup = 'bar';
  const service = this.subject({ engineId, dataGroup });
  const store = service.get('store');

  run(() => {
    store.createRecord('affinity-engine/data-manager-rewindable-lokijs/save', { dataGroup, engineId }).save().then(() => {
      return store.createRecord('affinity-engine/data-manager-rewindable-lokijs/save', { dataGroup, engineId }).save();
    }).then(() => {
      return store.createRecord('affinity-engine/data-manager-rewindable-lokijs/save', { dataGroup: 'baz', engineId }).save();
    }).then(() => {
      return service.get('saves');
    }).then((saves) => {
      assert.equal(saves.get('length'), 2, 'is correctly filtered');
      assert.equal(saves.get('firstObject.constructor.modelName'), 'affinity-engine/data-manager-rewindable-lokijs/save', 'correct model');
    });
  });
});

test('data returns the stateBuffer', function(assert) {
  assert.expect(1);

  const engineId = 'foo';
  const statePointManager = { stateBuffer: { bar: 'baz' } };
  const service = this.subject({ engineId, statePointManager });

  assert.equal(service.get('data.bar'), 'baz', 'is correct initially');
});

test('data has a getSharedData function that returns a sharedData buffer', function(assert) {
  assert.expect(2);

  const engineId = 'foo';
  const statePointManager = { stateBuffer: { } };
  const sharedDataManager = { data: { bar: 'baz' } };
  const service = this.subject({ engineId, sharedDataManager, statePointManager });
  const sharedData = service.get('data').getSharedData();

  assert.equal(sharedData.get('bar'), 'baz', 'is correct initially');

  assert.willPublish('shouldPersistSharedData', '`shouldPersistSharedData` was triggered');

  sharedData.save();
});

test('mostRecentSave returns a promise of the most recent save', function(assert) {
  assert.expect(2);

  const engineId = 'foo';
  const dataGroup = engineId;
  const service = this.subject({ engineId, dataGroup });
  const store = service.get('store');

  run(() => {
    store.createRecord('affinity-engine/data-manager-rewindable-lokijs/save', { engineId, dataGroup, name: 'foo' }).save().then(() => {
      return store.createRecord('affinity-engine/data-manager-rewindable-lokijs/save', { engineId, dataGroup, name: 'bar' }).save();
    }).then(() => {
      return store.createRecord('affinity-engine/data-manager-rewindable-lokijs/save', { engineId, dataGroup, name: 'baz' }).save();
    }).then(() => {
      return service.get('mostRecentSave');
    }).then((mostRecentSave) => {
      assert.equal(mostRecentSave.get('name'), 'baz', 'using createdAt');

      return store.peekRecord('affinity-engine/data-manager-rewindable-lokijs/save', 2).save();
    }).then((mostRecentSave) => {
      assert.equal(mostRecentSave.get('name'), 'bar', 'using updatedAt');
    });
  });
});

test('shouldCreateSave creates a save', function(assert) {
  assert.expect(5);

  const done = assert.async();

  const engineId = 'foo';
  const version = '1.0.0';
  const statePoints = [{}, {}, { foo: 1, bar: 1 }];
  const name = 'nom';
  const options = { autosave: true };
  const service = this.subject({ engineId, statePoints, version, sharedDataManager: {} });
  const store = service.get('store');

  run(() => {
    publisher.get('eBus').publish('shouldCreateSave', name, options);
  });

  later(() => {
    store.findRecord('affinity-engine/data-manager-rewindable-lokijs/save', 1).then((record) => {
      assert.deepEqual(record.get('statePoints'), [{}, {}, { foo: 1, bar: 1 }], 'statePoints are correct');
      assert.equal(record.get('engineId'), engineId, 'engineId is correct');
      assert.equal(record.get('name'), name, 'name is correct');
      assert.equal(record.get('version'), version, 'version is correct');
      assert.equal(record.get('autosave'), true, 'options applied correctly');

      done();
    })
  }, 1);
});

test('shouldUpdateSave updates a save', function(assert) {
  assert.expect(5);

  const done = assert.async();

  const engineId = 'foo';
  const version = '1.0.0';
  const statePoints = [{}, {}, { foo: 1, bar: 1 }];
  const name = 'nom';
  const options = { autosave: true };
  const service = this.subject({ engineId, statePoints, version, sharedDataManager: {} });
  const store = service.get('store');

  run(() => {
    store.createRecord('affinity-engine/data-manager-rewindable-lokijs/save', { name, engineId: 'bar', statePoints: [{ blah: 'blah' }]}).save().then((record) => {
      publisher.get('eBus').publish('shouldUpdateSave', record, options);
    });
  });

  later(() => {
    store.findRecord('affinity-engine/data-manager-rewindable-lokijs/save', 1).then((record) => {
      assert.deepEqual(record.get('statePoints'), [{}, {}, { foo: 1, bar: 1 }], 'statePoints are correct');
      assert.equal(record.get('engineId'), engineId, 'engineId is correct');
      assert.equal(record.get('name'), name, 'name is correct');
      assert.equal(record.get('version'), version, 'version is correct');
      assert.equal(record.get('autosave'), true, 'options applied correctly');

      done();
    }, 1);
  });
});

test('shouldDeleteSave deletes a save', function(assert) {
  assert.expect(1);

  const engineId = 'foo';
  const service = this.subject({ engineId, sharedDataManager: {} });
  const store = service.get('store');

  run(() => {
    store.createRecord('affinity-engine/data-manager-rewindable-lokijs/save', { engineId }).save().then((record) => {
      publisher.get('eBus').publish('shouldDeleteSave', record);
    });
  });

  next(() => {
    store.findAll('affinity-engine/data-manager-rewindable-lokijs/save').then((records) => {
      assert.equal(records.get('length'), 0, 'record deleted');
    })
  });
});

test('shouldLoadSave reloads the record and then triggers shouldLoadLatestStatePoint', function(assert) {
  assert.expect(1);

  const engineId = 'foo';
  const statePoints = ['foo', 'bar', 'baz'];
  const service = this.subject({ engineId });
  const store = service.get('store');

  assert.willPublish('shouldLoadLatestStatePoint', [statePoints], 'shouldLoadLatestStatePoint with reloaded statePoints');

  run(() => {
    store.createRecord('affinity-engine/data-manager-rewindable-lokijs/save', { engineId, statePoints }).save().then((record) => {
      record.set('statePoints', ['oooops']);

      publisher.get('eBus').publish('shouldLoadSave', record);
    });
  });
});
