const imports = require('esm')(module);
const path = require('path');

const shared = path.join(process.cwd(), 'src', 'shared');
const lib = path.join(shared, 'lib');
const log = imports(path.join(lib, 'log.js')).default;
const fs = require('fs');
const assert = require('assert');

const getFileUpdatedDate = path => {
  const stats = fs.statSync(path);
  return stats.mtime;
};

function countCommas(string) {
  return string.split(',').length - 1;
}

function accumulateAllFieldsOf(data, inField = '') {
  const keys = Object.keys(data);
  const fields = [];
  for (const k of keys) {
    let entry;
    if (inField === '') {
      entry = data[k];
    } else {
      entry = data[k][inField];
    }
    const theseFields = Object.keys(entry);
    for (const f of theseFields) {
      if (fields.indexOf(f) === -1) {
        fields.push(f);
      }
    }
  }
  let suffix = '';
  if (inField !== '') {
    suffix = ` in "${inField}"`;
  }
  log(`There are ${fields.length} unique fields${suffix}.`);
  for (const field of fields) {
    log(`  ${field}`);
  }
  return fields;
}

function accumulateAllValuesOf(data, field) {
  const keys = Object.keys(data);
  const values = [];
  for (const k of keys) {
    const entry = data[k];
    const value = entry[field];
    if (values.indexOf(value) === -1) {
      values.push(value);
    }
  }
  log(`There are ${values.length} unique values for the field "${field}"`);
  for (const value of values) {
    log(`  ${value}`);
  }
  return values;
}

function checkCountries(data) {
  const keys = Object.keys(data);
  const noCommas = [];
  const levelIsCountryCaseSensitive = [];
  const levelIsCountry = [];
  for (const k of keys) {
    if (countCommas(k) === 0) {
      noCommas.push(k);
    }
    const entry = data[k];
    if (entry.level === 'country') {
      levelIsCountryCaseSensitive.push(k);
    }
    if (entry.level.toUpperCase() === 'COUNTRY') {
      levelIsCountry.push(k);
    }
  }

  const countriesByCommas = noCommas.length;
  const countriesByLevel = levelIsCountryCaseSensitive.length;
  const countriesByLevelCI = levelIsCountryCaseSensitive.length;

  assert(countriesByCommas === countriesByLevel);
  assert(countriesByCommas === countriesByLevelCI);
  assert(countriesByLevel === countriesByLevelCI);

  const n = countriesByCommas;
  const countries = levelIsCountryCaseSensitive;

  for (let i = 0; i < n; i++) {
    assert(noCommas[i] === levelIsCountry[i]);
    assert(noCommas[i] === levelIsCountryCaseSensitive[i]);
    assert(levelIsCountry[i] === levelIsCountryCaseSensitive[i]);
    assert(data[countries[i]].country === countries[i]);
  }

  log(`There are ${n} countries in the data.`);

  for (const country of countries) {
    if (country.toUpperCase().includes('CITY')) {
      log.warn(`${country} has "city" in the name!`);
    }
    if (country.toUpperCase().includes('COUNTY')) {
      log.warn(`${country} has "county" in the name!`);
    }
  }
}

function checkStates(data) {
  const keys = Object.keys(data);
  const oneComma = [];
  const levelIsStateCaseSensitive = [];
  const levelIsState = [];
  for (const k of keys) {
    if (countCommas(k) === 1) {
      oneComma.push(k);
    }
    const entry = data[k];
    if (entry.level === 'state') {
      levelIsStateCaseSensitive.push(k);
    }
    if (entry.level.toUpperCase() === 'STATE') {
      levelIsState.push(k);
    }
  }

  const statesByCommas = oneComma.length;
  const statesByLevel = levelIsStateCaseSensitive.length;
  const statesByLevelCI = levelIsStateCaseSensitive.length;

  assert(statesByCommas === statesByLevel);
  assert(statesByCommas === statesByLevelCI);
  assert(statesByLevel === statesByLevelCI);

  const n = statesByCommas;
  const states = levelIsStateCaseSensitive;

  for (let i = 0; i < n; i++) {
    const stateByComma = oneComma[i];
    assert(
      levelIsState.indexOf(stateByComma) !== -1,
      `${stateByComma} not found in list of keys with level==="sTaTe" (case insensitive).`
    );
    assert(
      levelIsStateCaseSensitive.indexOf(stateByComma) !== -1,
      `${stateByComma} not found in list of keys with level==="state" (case sensitive).`
    );
    const theState = states[i].split(',')[0];
    assert(data[states[i]].state === theState, `${theState} has state="${data[states[i]].state}".`);
  }

  log(`There are ${n} province equivalents in the data.`);

  for (const state of states) {
    if (state.toUpperCase().includes('CITY')) {
      log.warn(`${state} has "city" in the name!`);
    }
    if (state.toUpperCase().includes('COUNTY')) {
      log.warn(`${state} has "county" in the name!`);
    }
  }
}

const inputFile = './dist/timeseries-byLocation.json';
log(`${inputFile} was last modified ${getFileUpdatedDate(inputFile)}.`);

const data = JSON.parse(fs.readFileSync(inputFile).toString());
const keys = Object.keys(data);
log(`There are ${keys.length} keys (locations).`);

accumulateAllFieldsOf(data);
accumulateAllFieldsOf(data, 'dates');

accumulateAllValuesOf(data, 'level');

checkCountries(data);

checkStates(data);
