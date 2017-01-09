import Model from 'ember-data/model';
import attr from 'ember-data/attr';
import { LokiJSModelMixin } from 'ember-lokijs';

export default Model.extend(LokiJSModelMixin, {
  engineId: attr('string'),
  dataMap: attr()
});
