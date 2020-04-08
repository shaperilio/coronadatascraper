const imports = require('esm')(module);
const path = require('path');

const shared = path.join(process.cwd(), 'src', 'shared');
const lib = path.join(shared, 'lib');
const log = imports(path.join(lib, 'log.js')).default;
const fs = require('fs');
// const assert = require('assert');

const getFileUpdatedDate = path => {
  const stats = fs.statSync(path);
  return stats.mtime;
};

function countCommas(string) {
  return string.split(',').length - 1;
}

function extractStateByCommas(string) {
  const parts = string.split(',');
  let theState = parts[0];
  for (let i = 1; i < parts.length - 1; i++) {
    theState += `,${parts[i]}`;
  }
  return theState;
}

function checkForWords(string, wordArray, exceptionArray = []) {
  for (const word of wordArray) {
    if (string.toUpperCase().includes(word.toUpperCase())) {
      // We found an offensive word. But is it contained within one of our exceptions?
      let excepted = false;
      for (const exception of exceptionArray) {
        if (exception.toUpperCase().includes(word.toUpperCase())) {
          excepted = true;
          break;
        }
      }
      if (!excepted) {
        log.warn(`${string} constains "${word}".`);
      }
    }
  }
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
  // Check what should be a country. We have a few ways to do this:
  // 1. Check keys which don't have commas (this was my original Python hack before the level field existed)
  // 2. Check level==="country" (case sensitive) - we assume this is what we actually want.
  // 3. Check the level in a case insensitive manner - these would be typos.
  const keys = Object.keys(data);
  const noCommas = [];
  const levelIsCountryCaseSensitive = [];
  const levelIsCountryCaseInsensitive = [];
  for (const k of keys) {
    if (countCommas(k) === 0) {
      noCommas.push(k);
    }
    const entry = data[k];
    if (entry.level === 'country') {
      levelIsCountryCaseSensitive.push(k);
    }
    if (entry.level.toUpperCase() === 'COUNTRY') {
      levelIsCountryCaseInsensitive.push(k);
    }
  }

  const countriesByCommas = noCommas.length;
  const countriesByLevel = levelIsCountryCaseSensitive.length;
  const countriesByLevelCI = levelIsCountryCaseInsensitive.length;

  // Check counts. First signs of trouble is if there's something off here.

  if (countriesByCommas !== countriesByLevel) {
    log.error(`There are ${countriesByCommas} countries as classified by the number of commas, 
    but ${countriesByLevel} keys with level==="country" (case sensitive).`);
  }
  if (countriesByCommas !== countriesByLevelCI) {
    log.error(`There are ${countriesByCommas} countries as classified by the number of commas, 
    but ${countriesByLevelCI} keys with level==="cOuNtRy" (case insensitive).`);
  }
  if (countriesByLevel !== countriesByLevelCI) {
    log.error(`There are ${countriesByLevel} keys with level==="country" (case sensitive), 
    but ${countriesByLevelCI} keys with level==="cOuNtRy" (case insensitive).`);
  }

  // We checked the count, but we still need to check the members.

  for (const country of noCommas) {
    if (levelIsCountryCaseInsensitive.indexOf(country) === -1) {
      log.error(`${country} is not in the list of keys with level==="cOuNtRy" (case insensitive).`);
    }
    if (levelIsCountryCaseSensitive.indexOf(country) === -1) {
      log.error(`${country} is not in the list of keys with level==="country" (case sensitive).`);
    }
    if (data[country].country !== country) {
      log.error(`${country} has country==="${data[country].country}`);
    }
  }

  for (const country of levelIsCountryCaseSensitive) {
    if (noCommas.indexOf(country) === -1) {
      log.error(`${country} is not in the list of keys with no commas.`);
    }
    if (levelIsCountryCaseInsensitive.indexOf(country) === -1) {
      log.error(`${country} is not in the list of keys with level==="cOuNtRy" (case insensitive).`);
    }
    if (data[country].country !== country) {
      log.error(`${country} has country==="${data[country].country}`);
    }
  }

  for (const country of levelIsCountryCaseInsensitive) {
    if (noCommas.indexOf(country) === -1) {
      log.error(`${country} is not in the list of keys with no commas.`);
    }
    if (levelIsCountryCaseSensitive.indexOf(country) === -1) {
      log.error(`${country} is not in the list of keys with level==="country" (case sensitive).`);
    }
    if (data[country].country !== country) {
      log.error(`${country} has country==="${data[country].country}`);
    }
  }

  // These are what we assume are correctly classified countries.
  log(`There are ${countriesByLevel} countries in the data with level==="country" (case sensitive).`);

  for (const country of levelIsCountryCaseSensitive) {
    checkForWords(country, ['city', 'county', 'state', 'country', 'region', 'parish'], ['United States']);
  }
}

function checkStates(data) {
  const keys = Object.keys(data);
  const oneComma = [];
  const levelIsStateCaseSensitive = [];
  const levelIsStateCaseInsensitive = [];
  for (const k of keys) {
    if (countCommas(k) === 1) {
      oneComma.push(k);
    }
    const entry = data[k];
    if (entry.level === 'state') {
      levelIsStateCaseSensitive.push(k);
    }
    if (entry.level.toUpperCase() === 'STATE') {
      levelIsStateCaseInsensitive.push(k);
    }
  }

  const statesByCommas = oneComma.length;
  const statesByLevel = levelIsStateCaseSensitive.length;
  const statesByLevelCI = levelIsStateCaseInsensitive.length;

  if (statesByCommas !== statesByLevel) {
    log.error(`There are ${statesByCommas} states as classified by the number of commas, 
    but ${statesByLevel} keys with level==="state" (case sensitive).`);
  }
  if (statesByCommas !== statesByLevelCI) {
    log.error(`There are ${statesByCommas} states as classified by the number of commas, 
    but ${statesByLevelCI} keys with level==="sTaTe" (case insensitive).`);
  }
  if (statesByLevel !== statesByLevelCI) {
    log.error(`There are ${statesByLevel} keys with level==="state" (case sensitive)., 
    but ${statesByLevelCI} keys with level==="sTaTe" (case insensitive).`);
  }

  for (const state of oneComma) {
    if (levelIsStateCaseInsensitive.indexOf(state) === -1) {
      log.error(`${state} not found in list of keys with level==="sTaTe" (case insensitive).`);
    }
    if (levelIsStateCaseSensitive.indexOf(state) === -1) {
      log.error(`${state} not found in list of keys with level==="state" (case sensitive).`);
    }
    const theState = extractStateByCommas(state);
    if (theState !== data[state].state) {
      log.error(`${state} has state==="${data[state].state}"`);
    }
  }

  for (const state of levelIsStateCaseInsensitive) {
    if (oneComma.indexOf(state) === -1) {
      log.error(`${state} not found in list of keys with one comma.`);
    }
    if (levelIsStateCaseSensitive.indexOf(state) === -1) {
      log.error(`${state} not found in list of keys with level==="state" (case sensitive).`);
    }
    const theState = extractStateByCommas(state);
    if (theState !== data[state].state) {
      log.error(`${state} has state==="${data[state].state}"`);
    }
  }

  for (const state of levelIsStateCaseSensitive) {
    if (oneComma.indexOf(state) === -1) {
      log.error(`${state} not found in list of keys with one comma.`);
    }
    if (levelIsStateCaseInsensitive.indexOf(state) === -1) {
      log.error(`${state} not found in list of keys with level==="sTaTe" (case insensitive).`);
    }
    const theState = extractStateByCommas(state);
    if (theState !== data[state].state) {
      log.error(`${state} has state==="${data[state].state}"`);
    }
  }

  log(`There are ${statesByLevel} province equivalents in the data.`);

  for (const state of levelIsStateCaseSensitive) {
    checkForWords(state, ['city', 'county', 'state', 'country', 'region', 'parish'], ['United States']);
  }
}

const inputFile = './dist/timeseries-byLocation.json';
log(`${inputFile} was last modified ${getFileUpdatedDate(inputFile)}.`);

const data = JSON.parse(fs.readFileSync(inputFile).toString());
const keys = Object.keys(data);
log(`There are ${keys.length} keys (locations).`);

accumulateAllFieldsOf(data);
log('');

accumulateAllFieldsOf(data, 'dates');
log('');

accumulateAllValuesOf(data, 'level');
log('');

log('Check of countries:');
checkCountries(data);
log('');

log('Check of province equivalents:');
checkStates(data);
log('');
