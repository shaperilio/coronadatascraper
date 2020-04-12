const imports = require('esm')(module);
const path = require('path');

const shared = path.join(process.cwd(), 'src', 'shared');
const lib = path.join(shared, 'lib');
const log = imports(path.join(lib, 'log.js')).default;
const fs = require('fs');

const checkSchema = imports('./schema.js').default;
// const assert = require('assert');

const getFileUpdatedDate = path => {
  const stats = fs.statSync(path);
  return stats.mtime;
};

function countCommas(string) {
  return string.split(',').length - 1;
}

function getKeysByCommaCount(keys, numCommas) {
  const result = [];
  for (const k of keys) {
    if (countCommas(k) === numCommas) {
      result.push(k);
    }
  }
  return result;
}

function getCountriesByCommas(data) {
  const keys = Object.keys(data);
  return getKeysByCommaCount(keys, 0);
}

function getStatesByCommas(data) {
  const keys = Object.keys(data);
  return getKeysByCommaCount(keys, 1);
}

function getKeysWithLevel(data, level) {
  const caseSensitive = [];
  const caseInsensitive = [];
  const keys = Object.keys(data);
  for (const k of keys) {
    const entry = data[k];
    if (entry.level === level) {
      caseSensitive.push(k);
    }
    if (entry.level.toUpperCase() === level.toUpperCase()) {
      caseInsensitive.push(k);
    }
  }
  return [caseSensitive, caseInsensitive];
}

function extractStateByCommas(string) {
  const parts = string.split(',');
  let theState = parts[0];
  for (let i = 1; i < parts.length - 1; i++) {
    theState += `,${parts[i]}`;
  }
  return theState;
}

function checkForWords(stringArray, wordArray, exceptionArray = []) {
  for (const string of stringArray) {
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
}

function checkCountries(data) {
  // Check what should be a country. We have a few ways to do this:
  // 1. Check keys which don't have commas (this was my original Python hack before the level field existed)
  // 2. Check level==="country" (case sensitive) - we assume this is what we actually want.
  // 3. Check the level in a case insensitive manner - these would be typos.
  const byComma = getCountriesByCommas(data);
  let byLevelCaseSensitive = [];
  let byLevelCaseInsensitive = [];
  [byLevelCaseSensitive, byLevelCaseInsensitive] = getKeysWithLevel(data, 'country');

  const numByComma = byComma.length;
  const numByLevel = byLevelCaseSensitive.length;
  const numByLevelCI = byLevelCaseInsensitive.length;

  // Check counts. First signs of trouble is if there's something off here.

  if (numByComma !== numByLevel) {
    log.error(`There are ${numByComma} countries as classified by the number of commas, 
    but ${numByLevel} keys with level==="country" (case sensitive).`);
  }
  if (numByComma !== numByLevelCI) {
    log.error(`There are ${numByComma} countries as classified by the number of commas, 
    but ${numByLevelCI} keys with level==="cOuNtRy" (case insensitive).`);
  }
  if (numByLevel !== numByLevelCI) {
    log.error(`There are ${numByLevel} keys with level==="country" (case sensitive), 
    but ${numByLevelCI} keys with level==="cOuNtRy" (case insensitive).`);
  }

  // We checked the count, but we still need to check the members.

  for (const country of byComma) {
    if (!byLevelCaseInsensitive.includes(country)) {
      log.error(`${country} is not in the list of keys with level==="cOuNtRy" (case insensitive).`);
    }
    if (!byLevelCaseSensitive.includes(country)) {
      log.error(`${country} is not in the list of keys with level==="country" (case sensitive).`);
    }
    if (data[country].country !== country) {
      log.error(`${country} has country==="${data[country].country}`);
    }
  }

  for (const country of byLevelCaseSensitive) {
    if (!byComma.includes(country)) {
      log.error(`${country} is not in the list of keys with no commas.`);
    }
    if (!byLevelCaseInsensitive.includes(country)) {
      log.error(`${country} is not in the list of keys with level==="cOuNtRy" (case insensitive).`);
    }
    if (data[country].country !== country) {
      log.error(`${country} has country==="${data[country].country}`);
    }
  }

  for (const country of byLevelCaseInsensitive) {
    if (!byComma.includes(country)) {
      log.error(`${country} is not in the list of keys with no commas.`);
    }
    if (!byLevelCaseSensitive.includes(country)) {
      log.error(`${country} is not in the list of keys with level==="country" (case sensitive).`);
    }
    if (data[country].country !== country) {
      log.error(`${country} has country==="${data[country].country}`);
    }
  }

  // These are what we assume are correctly classified countries.
  log(`There are ${numByLevel} countries in the data with level==="country" (case sensitive).`);

  checkForWords(byLevelCaseSensitive, ['city', 'county', 'state', 'country', 'region', 'parish'], ['United States']);
}

function checkStates(data) {
  const byComma = getStatesByCommas(data);
  let byLevelCaseSensitive = [];
  let byLevelCaseInsensitive = [];
  [byLevelCaseSensitive, byLevelCaseInsensitive] = getKeysWithLevel(data, 'state');

  const numByCommas = byComma.length;
  const numByLevel = byLevelCaseSensitive.length;
  const numByLevelCI = byLevelCaseInsensitive.length;

  if (numByCommas !== numByLevel) {
    log.error(`There are ${numByCommas} states as classified by the number of commas, 
    but ${numByLevel} keys with level==="state" (case sensitive).`);
  }
  if (numByCommas !== numByLevelCI) {
    log.error(`There are ${numByCommas} states as classified by the number of commas, 
    but ${numByLevelCI} keys with level==="sTaTe" (case insensitive).`);
  }
  if (numByLevel !== numByLevelCI) {
    log.error(`There are ${numByLevel} keys with level==="state" (case sensitive)., 
    but ${numByLevelCI} keys with level==="sTaTe" (case insensitive).`);
  }

  for (const state of byComma) {
    if (!byLevelCaseInsensitive.includes(state)) {
      log.error(`${state} not found in list of keys with level==="sTaTe" (case insensitive).`);
    }
    if (!byLevelCaseSensitive.includes(state)) {
      log.error(`${state} not found in list of keys with level==="state" (case sensitive).`);
    }
    const theState = extractStateByCommas(state);
    if (theState !== data[state].state) {
      log.error(`${state} has state==="${data[state].state}"`);
    }
  }

  for (const state of byLevelCaseInsensitive) {
    if (!byComma.includes(state)) {
      log.error(`${state} not found in list of keys with one comma.`);
    }
    if (!byLevelCaseSensitive.includes(state)) {
      log.error(`${state} not found in list of keys with level==="state" (case sensitive).`);
    }
    const theState = extractStateByCommas(state);
    if (theState !== data[state].state) {
      log.error(`${state} has state==="${data[state].state}"`);
    }
  }

  for (const state of byLevelCaseSensitive) {
    if (!byComma.includes(state)) {
      log.error(`${state} not found in list of keys with one comma.`);
    }
    if (!byLevelCaseInsensitive.includes(state)) {
      log.error(`${state} not found in list of keys with level==="sTaTe" (case insensitive).`);
    }
    const theState = extractStateByCommas(state);
    if (theState !== data[state].state) {
      log.error(`${state} has state==="${data[state].state}"`);
    }
  }

  log(`There are ${numByLevel} province equivalents in the data.`);

  for (const state of byLevelCaseSensitive) {
    checkForWords(state, ['city', 'county', 'state', 'country', 'region', 'parish'], ['United States']);
  }
}

if (!module.parent) {
  const inputFile = './dist/timeseries-byLocation.json';
  log(`${inputFile} was last modified ${getFileUpdatedDate(inputFile)}.`);

  const data = JSON.parse(fs.readFileSync(inputFile).toString());
  const keys = Object.keys(data);
  log(`There are ${keys.length} keys (locations).`);

  checkSchema(data);

  log('Check of countries:');
  checkCountries(data);
  log('');

  log('Check of province equivalents:');
  checkStates(data);
  log('');
}
