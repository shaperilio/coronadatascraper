// const imports = require('esm')(module);
// const path = require('path');
//
// const shared = path.join(process.cwd(), 'src', 'shared');
// const lib = path.join(shared, 'lib');
// const log = imports(path.join(lib, 'log.js')).default;

function addToList(list, field, value) {
  for (const l of list) {
    if (l.field === field) {
      l.value += value;
      return;
    }
  }
  list.push({ field, value });
}

// Terrible. This function replicates the loop of that below just to count fields.
export const countKeysOf = (data, inField = '') => {
  const keys = Object.keys(data);

  if (inField.includes('.*')) {
    [inField] = inField.split('.*');
  }
  let keyCount = 0;
  for (const k of keys) {
    let entry;
    if (inField === '') {
      entry = data[k];
    } else {
      entry = data[k][inField];
    }
    const theseFields = Object.keys(entry);
    keyCount += theseFields.length;
  }
  return keyCount;
};

export const accumulateAllFieldsOf = (data, inField = '') => {
  const keys = Object.keys(data);

  let enterChildren = false;
  if (inField.includes('.*')) {
    enterChildren = true;
    [inField] = inField.split('.*');
  }
  const fields = [];
  for (const k of keys) {
    let entry;
    if (inField === '') {
      entry = data[k];
    } else {
      entry = data[k][inField];
    }
    const theseFields = Object.keys(entry);
    if (enterChildren) {
      for (const f of theseFields) {
        const children = Object.keys(entry[f]);
        for (const c of children) {
          addToList(fields, c, 1);
        }
      }
    } else {
      for (const f of theseFields) {
        addToList(fields, f, 1);
      }
    }
  }
  return fields;
};

export const accumulateAllValuesOf = (data, field) => {
  const keys = Object.keys(data);
  const values = [];
  for (const k of keys) {
    const entry = data[k];
    const value = entry[field];
    addToList(values, value, 1);
  }
  return values;
};
