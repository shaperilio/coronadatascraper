const imports = require('esm')(module);
const path = require('path');

const shared = path.join(process.cwd(), 'src', 'shared');
const lib = path.join(shared, 'lib');
const log = imports(path.join(lib, 'log.js')).default;

const fields = imports('./fields.js');

function checkSchema(data) {
  const keys = Object.keys(data);
  const dataFields = fields.accumulateAllFieldsOf(data);
  // Show this sorted by values.
  log(`There are ${dataFields.length} unique fields.`);
  for (const field of dataFields.sort((a, b) => (a.value > b.value ? 1 : -1))) {
    log(`  "${field.field}" occurs ${field.value} times (${((field.value / keys.length) * 100).toFixed(2)}%).`);
  }
  log('');

  const theDates = fields.accumulateAllFieldsOf(data, 'dates');
  const sortedByDate = theDates.sort((a, b) => (a.field > b.field ? 1 : -1));
  log(`Dates range from ${theDates[0].field} to ${theDates[theDates.length - 1].field}`);
  for (const date of sortedByDate) {
    log(`  "${date.field}" occurs ${date.value} times (${((date.value / keys.length) * 100).toFixed(2)}%).`);
  }
  log('');

  const levelValues = fields.accumulateAllValuesOf(data, 'level');
  log(`There are ${levelValues.length} unique values for the field "level"`);
  for (const value of levelValues) {
    log(`  "${value.field}" occurs ${value.value} times (${((value.value / keys.length) * 100).toFixed(2)}%).`);
  }
  log('');
}

export { checkSchema as default };
