'use strict';

class CourierNotConfiguredError extends Error {
  constructor(message = 'Courier is not configured for this company') {
    super(message);
    this.name = 'CourierNotConfiguredError';
  }
}

module.exports = CourierNotConfiguredError;
