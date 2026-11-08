'use strict';

/**
 * print-template service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::print-template.print-template');
