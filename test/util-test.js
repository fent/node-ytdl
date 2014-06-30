var util   = require('../lib/util');
var assert = require('assert');


describe('util.toHumanTime()', function() {
  it('Returns correctly formatted time', function() {
    assert.equal(util.toHumanTime(60 * 20 + 30), '20:30');
    assert.equal(util.toHumanTime(60 * 60 * 4 + 60 * 8 + 8), '4:08:08');
  });
});

describe('util.toHumanSize()', function() {
  it('Returns correctly formatted size', function() {
    assert.equal(util.toHumanSize(1 << 3), '8B');
    assert.equal(util.toHumanSize((1 << 10) * 4.5), '4.5KB');
  });
});
