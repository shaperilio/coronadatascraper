import * as fetch from '../../lib/fetch/index.js';
// import datetime from '../../lib/datetime/index.js';
import maintainers from '../../lib/maintainers.js';
import { NotImplemented } from '../../lib/errors.js';
import log from '../../lib/log.js';

// Strategy:
// Argentina has two PDF reports per day. Filenames are inconsistent. And then
// there's the issue that the contents of the PDFs is changing, too.
// The URLs to each PDF must be taken from the source page, so we can't
// have a different scraper function for each date.
//
// The parsing will be a whole other problem, because they could potentially
// change each day.
//
// So we define one scraper, which gets the URLs for the scrapeDate,
// and then just fetches them to cache them.

async function getUrls(sourceUrl) {
  // This function should return a dictionary of URLs by date, so that the scraper can work more like the
  // UA scraper.
  log('Getting PDF URLs for Argentina...');

  // treat it as a timeseries since there's previous days' data there.
  const page = await fetch.page(sourceUrl, false);
  if (page === null) {
    throw new Error('Argentina source page not fetched!');
  }
  log('Source page fetched.');
  // Ugh, this looks so brittle.
  // Page looks like this:
  // <div class="row row-flex">
  //   <div class="col-md-12 col-xs-12 col-sm-6">
  //     <p class="text-muted m-b-1">Reporte Diario Matutino / 04-04-2020 (292.8 Kb)</p>
  //     <a href="https://www.argentina.gob.ar/sites/default/files/04-04-20_reporte-matutino_covid-19.pdf" class="btn btn-primary btn-sm" download><i class="fa fa-download"></i>&nbsp; Descargar archivo</a>
  //   </div>
  //   <div class="col-md-12 col-xs-12 col-sm-6">
  //     <p class="text-muted m-b-1">Reporte Diario Vespertino / 03-04-2020 (207.7 Kb)</p>
  //     <a href="https://www.argentina.gob.ar/sites/default/files/03-04-20_reporte_vespertino_covid_19.pdf" class="btn btn-primary btn-sm" download><i class="fa fa-download"></i>&nbsp; Descargar archivo</a>
  //   </div>
  //   ...
  // </div>

  // this gives us the list of <div class="col-md-12 col-xs-12 col-sm-6"> items.
  const reports = page('div.row-flex').children();
  const urls = {};
  let pdfCount = 0;
  for (let i = 0; i < reports.length; i++) {
    const report = reports[i];
    // Inside each of these divs is a string with the date:
    const description = page(report).text();
    let subDay = 0;
    if (description.toUpperCase().includes('MATUTINO')) {
      subDay = 1; // 'evening report';
    }
    if (description.toUpperCase().includes('VESPERTINO')) {
      subDay = 0; // 'morning report';
    }
    let fileDate = description.match(/[0-9]{2}-[0-9]{2}-[0-4]{4}/);
    if (fileDate === null || fileDate.length < 1) {
      log.error(`  ❌ Cannot get date for PDF report from "${description}" on Argentina's source page.`);
      continue;
    }
    [fileDate] = fileDate; // Can't imagine how this is better than foo = foo[0]
    if (fileDate.length !== '00-00-0000'.length) {
      log.error(`  ❌ Attempt to get date from "${description}" yielded "${fileDate}" which doesn't look right.`);
      continue;
    }
    // Date is in D/M/Y; flip it.
    const dateParts = fileDate.split('-');
    const day = dateParts[0];
    const month = dateParts[1];
    const year = dateParts[2];
    fileDate = `${year}-${month}-${day}`;

    const url = page('a', report).attr('href');
    if (!(fileDate in urls)) {
      urls[fileDate] = {};
    }
    if (subDay in urls[fileDate]) {
      log.warn(`  ⚠️ URL list for ${fileDate} already contains a sub-day key of ${subDay}. 
      Previous entry of "${urls[fileDate][subDay]}" will be replaced with "${url}".`);
    }
    urls[fileDate][subDay] = url;
    // log(`Found a PDF report "${url}" for date ${fileDate} and sub-day ${subDay}.`);
    pdfCount++;
  }
  log(`Argentina source page has ${pdfCount} PDFs.`);
  return urls;
}

const scraper = {
  country: 'ARG',
  sources: [
    {
      url: 'https://www.argentina.gob.ar/salud/coronavirus-COVID-19',
      name: 'Ministerio de Salud',
      description: 'Argentinian Ministry of Health'
    }
  ],
  url: 'https://www.argentina.gob.ar/coronavirus/informe-diario',
  type: 'pdf',
  aggregate: 'state',
  maintainers: [maintainers.shaperilio],

  scraper: {
    '0': async function() {
      const date = process.env.SCRAPE_DATE;
      const urlsByDate = await getUrls(this.url);

      if (!(date in urlsByDate)) {
        throw new Error(`Cannot establish URL to scrape for Argentina on ${date}.`);
      }
      const urls = urlsByDate[process.env.SCRAPE_DATE];
      // sort the sub-days so we process morning before evening.
      const subDays = Object.keys(urls);
      for (const subDay of subDays.sort()) {
        // Hack! we have to say that this is a time series despite it not being one to avoid the
        // "Can't go back in time" error, however, that means we will go fetch this on the server every time.
        await fetch.pdf(urls[subDay], false);
      }
      throw new NotImplemented(`ARG scraper is cache-only for ${date}.`);
    }
  }
};

export default scraper;
