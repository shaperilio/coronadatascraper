// import assert from 'assert';
import * as fetch from '../../lib/fetch/index.js';
import maintainers from '../../lib/maintainers.js';
import log from '../../lib/log.js';
import provinceToIso2 from './province-to-iso2.json';
import * as transform from '../../lib/transform.js';
import datetime from '../../lib/datetime/index.js';

function getProvinceIso2(provinceName) {
  // source: https://en.wikipedia.org/wiki/ISO_3166-2:CO
  // This is where we check for potentially different spellings.
  provinceName = transform.toTitleCase(provinceName);
  provinceName = provinceName.replace(' De ', ' de ');
  provinceName = provinceName.replace(' Del ', ' del ');
  if (provinceName === 'Bogotá D.c.') provinceName = 'Distrito Capital de Bogotá';
  if (provinceName === 'San Andrés') provinceName = 'San Andrés, Providencia y Santa Catalina';
  // They have cities in there too. We don't support that, so we force the names of the Departamentos here.
  // Wish we could support this!
  if (provinceName === 'Santa Marta D.t. Y C.') provinceName = 'Magdalena';
  if (provinceName === 'Barranquilla D.e.') provinceName = 'Atlántico';
  if (provinceName === 'Cartagena D.t. Y C') provinceName = 'Bolívar';
  if (provinceName === 'Buenaventura D.e.') provinceName = 'Valle del Cauca';
  const iso2 = provinceToIso2[provinceName];
  if (!iso2) {
    throw new Error(`Cannot obtain ISO2 code for "${provinceName}".`);
  }
  return iso2;
}

function addEmptyStates(data) {
  for (const province in provinceToIso2) {
    let found = false;
    for (const entry of data) {
      if (entry.state === provinceToIso2[province]) {
        found = true;
        break;
      }
    }
    if (!found) {
      log(`Adding ${province} with zero cases.`);
      data.push({ state: provinceToIso2[province] });
    }
  }
}

const patientLocation = {
  FALLECIDO: 'deaths',
  CASA: 'quarantine',
  HOSPITAL: 'hospitalized',
  'HOSPITAL UCI': 'icu',
  RECUPERADO: 'recovered',
  'RECUPERADO (HOSPITAL)': 'recovered'
};

function getCountsFromLocation(location) {
  const parsed = patientLocation[location.toUpperCase()];
  const counts = {};
  if (!parsed) {
    log.warn(`Patient location is "${location}", it will not be counted.`);
    return counts;
  }
  counts.cases = 1;
  counts[parsed] = 1;
  return counts;
}

async function TEMPfetchArcGISJSON(obj, featureURL, cachekey, date) {
  // temporary handling of pagination here until Quentin's pull request is brought in
  let offset = 0;
  const recordCount = 50000;
  const result = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = `where=0%3D0&outFields=*&resultOffset=${offset}&resultRecordCount=${recordCount}&f=json`;
    const theURL = `${featureURL}?${query}`;
    const thisCacheKey = `${cachekey}_${offset}`;
    const response = await fetch.json(obj, theURL, thisCacheKey, date);
    if (!response) throw new Error(`Response was null for "${theURL}`);
    if (response.features && response.features.length === 0) break;
    const n = response.features.length;
    log(`${n} records from "${theURL}`);
    offset += n;
    result.push(...response.features.map(({ attributes }) => attributes));
  }
  return result;
}

const scraper = {
  priority: 1,
  country: 'iso1:CO',
  sources: [
    {
      url: 'http://www.ins.gov.co/Noticias/Paginas/Coronavirus.aspx',
      name: 'Instituto Nacional de Salud',
      note: 'Distritos were mapped into counties in this data set; data exists at corregimiento level.'
    }
  ],
  // URLs were obtained by snooping. See
  // https://docs.google.com/document/d/1__rE8LbiB0pK4qqG3vIbjbgnT8SrTx86A_KI7Xakgjk/edit#

  // List of "corregimientos" (smaller than a county)
  _corregimientosListUrl: 'https://opendata.arcgis.com/datasets/61980f00977b4dcdad46eda02268ab48_0.csv',

  // So much good stuff!
  _cacheOnlyFeatureURLs: [
    // cases, deaths, hospitalizations, and recoveries by municipality.
    'https://services.arcgis.com/BQTQBNBsmxjF8vus/ArcGIS/rest/services/Colombia_COVID19V/FeatureServer/0/query',
    // cases by departamento (equivalent to state)
    'https://services.arcgis.com/BQTQBNBsmxjF8vus/ArcGIS/rest/services/Colombia_COVID19V/FeatureServer/1/query',
    // national stats, including e.g. how many cases came from other countries.
    'https://services.arcgis.com/BQTQBNBsmxjF8vus/ArcGIS/rest/services/Colombia_COVID19V/FeatureServer/2/query',
    // every case (i.e. patient list) located by city and state, with status, date, and country of origin
    'https://services.arcgis.com/BQTQBNBsmxjF8vus/ArcGIS/rest/services/Colombia_COVID19V/FeatureServer/3/query',
    // time series at national level; cases, deaths, recoveries.
    'https://services.arcgis.com/BQTQBNBsmxjF8vus/ArcGIS/rest/services/Colombia_COVID19V/FeatureServer/6/query'
  ],

  // every case (i.e. patient list) located by city and state, with status, date, and country of origin
  _caseListFeatureURL:
    'https://services.arcgis.com/BQTQBNBsmxjF8vus/ArcGIS/rest/services/Colombia_COVID19V/FeatureServer/3/query',

  type: 'json',
  aggregate: 'state',
  maintainers: [maintainers.shaperilio],

  async scraper() {
    const scrapeDate = datetime.getYYYYMMDD(datetime.scrapeDate());

    // use datetime.old here, just like the caching system does.
    if (!datetime.dateIsBefore(scrapeDate, datetime.old.getDate())) {
      log(`Caching amazing data...`);
      // Grab the stuff we want to cache with this date.
      // TODO: deal with this after migrating to li
      for (let i = 0; i < this._cacheOnlyFeatureURLs.length; i++) {
        const cacheKey = `cache_only_${i}`;
        try {
          await TEMPfetchArcGISJSON(this, this._cacheOnlyFeatureURLs[i], cacheKey);
        } catch (err) {
          log(`Error fetching cache-only source: ${err}`);
        }
      }
    }

    this.url = this._caseListFeatureURL;
    const caseList = await TEMPfetchArcGISJSON(this, this._caseListFeatureURL, 'default', false);

    const data = [];
    log(`Colombia has ${caseList.length} cumulative cases.`);
    let rejectedByDate = 0;
    for (const patient of caseList) {
      const confirmedDate = datetime.getYYYYMMDD(patient.FECHA);
      if (!datetime.dateIsBeforeOrEqualTo(confirmedDate, scrapeDate)) {
        rejectedByDate++;
        continue;
      } // this turns this scraper into a timeseries.

      const counts = getCountsFromLocation(patient.ATENCION);
      const state = getProvinceIso2(patient.DPTO);

      let found = false;
      for (const item of data) {
        if (item.state !== state) continue;
        found = true;
        for (const key of Object.keys(counts)) {
          if (Object.keys(item).includes(key)) {
            item[key] += counts[key];
          } else {
            item[key] = counts[key];
          }
        }
      }
      if (!found) {
        data.push({
          state,
          ...counts
        });
      }
    }

    log(`Counting up to ${scrapeDate}: ${rejectedByDate} out of ${caseList.length} rejected by date.`);

    if (data.length === 0) return data;

    // add empty states
    addEmptyStates(data);

    data.push(transform.sumData(data));
    return data;
  }
};

export default scraper;
