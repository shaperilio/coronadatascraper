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

export const accumulateAllFieldsOf = (data, inField = '') => {
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
      addToList(fields, f, 1);
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
