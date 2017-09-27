const Bluebird = require('bluebird');
const _ = require('lodash');
const request = Bluebird.promisify(require('request'));
const cheerio = require('cheerio');

const WEBSITE = 'https://www.idealista.com';
const BASE_PATHNAME = '/alquiler-viviendas/madrid/centro/malasana-universidad/';

function getUrlFromPathname(pathname) {
  return `${WEBSITE}${pathname}`;
}

function getBody(url) {
  // https://i.imgur.com/ugrzqvl.png (no headers needed)
  return request(url)
    .then(response => _.get(response, 'body', null));
}

/**
 * @param {string} body
 * @return {Bluebird<object>} Data parsed from the html page
 *
 * The javascript has been disabled in the browser so that it disables
 * possible ajax requests that might populate the DOM (check photos).
 * It means that we miss some visible information in the website
 */
function parseBody(body) {
  if (_.isEmpty(body)) {
    return null;
  }
  const $ = cheerio.load(body);
  const parsedData = {};
  parsedData.pagination = {
    currentPageNumber: $('li.selected span').text(), // https://i.imgur.com/PFUx1NQ.png
    nextPageHref: $('.next a').attr('href'), // https://i.imgur.com/mBpVTwN.png
  };
  // https://i.imgur.com/wAVyYuc.png
  parsedData.listings = [];
  $('.item').each((i, elementContainer) => {
    parsedData.listings.push({
      listingId: $(elementContainer).attr('data-adid'),
    });
  });

  return parsedData;
}

getBody(getUrlFromPathname(BASE_PATHNAME))
  .then(body => parseBody(body))
  .then(console.dir)
  .catch(err => console.error(err));
