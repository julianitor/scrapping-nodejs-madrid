/* eslint-disable func-names */

const Bluebird = require('bluebird');
const _ = require('lodash');
const request = Bluebird.promisify(require('request'));
const cheerio = require('cheerio');
const queue = require('async/queue');

const WEBSITE = 'https://www.idealista.com';
const BASE_PATHNAME = '/alquiler-viviendas/madrid-madrid/';

function getUrlFromPathname(pathname) {
  return `${WEBSITE}${pathname}`;
}

function getBody(url) {
  // https://i.imgur.com/ugrzqvl.png (no headers needed)
  return request({
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'accept-encoding': 'deflate, sdch, br',
      'accept-language': 'en-GB,en;q=0.8,en-US;q=0.6,es;q=0.4,ca;q=0.2',
      'upgrade-insecure-requests': '1',
    },
    uri: url,
  })
    .then(response => _.get(response, 'body', null));
}

/**
 * @param {string} body
 * @return {object} Data parsed from the html page
 *
 * The javascript has been disabled in the browser so that it disables
 * possible ajax requests that might populate the DOM (check photos).
 * It means that we miss some visible information in the website
 */
function parsePageBody(body) {
  if (_.isEmpty(body)) {
    return null;
  }
  const $ = cheerio.load(body);
  const parsedData = {};
  parsedData.pagination = {
    currentPageNumber: $('li.selected span').text(),
    nextPageHref: $('.next a').attr('href'),
  };
  parsedData.listings = [];
  $('.item').each((i, elementContainer) => {
    parsedData.listings.push({
      listingId: $(elementContainer).attr('data-adid'),
      listingHref: $(elementContainer).find('.item-link').attr('href'),
    });
  });

  return parsedData;
}

/**
 * @param {string} body
 * @return {object} Data parsed from the html page
 */
function parseListingBody(body) {
  if (_.isEmpty(body)) {
    return null;
  }
  const $ = cheerio.load(body);
  const parsedData = {
    title: _.trim($('.main-info h1').text()),
  };
  $('.info-data span').each((i, element) => {
    if (_.includes($(element).text(), '€/mes')) {
      _.set(parsedData, 'price', $(element).find('.txt-big').text());
    }
    if (_.includes($(element).text(), 'm²')) {
      _.set(parsedData, 'area', $(element).find('.txt-big').text());
    }
    if (_.includes($(element).text(), 'hab.')) {
      _.set(parsedData, 'rooms', $(element).find('.txt-big').text());
    }
  });
  const agency = $('.advertiser-data .professional-name').length;
  _.set(parsedData, 'agency', !!agency);
  return parsedData;
}

/**
 * Queue worker for detailing
 *
 * @param {object} listing
 * @param {function} callback
 * @return {Promise} Callback call
 */
const detailer = queue((listing, callback) => {
  const listingUrl = getUrlFromPathname(_.get(listing, 'listingHref'));
  return getBody(listingUrl)
    .then(parseListingBody)
    .then((parsedData) => {
      const data = _.assign({}, listing, parsedData, { url: listingUrl });
      // console.dir(data);
      console.log(JSON.stringify(data));
    })
    .finally(() => callback());
});

/**
 * Crawler recursive async function
 *
 * @param {object} bodyData
 * @return {undefined}
 */
const crawl = async function (bodyData) {
  let url;
  if (_.isEmpty(bodyData)) {
    url = BASE_PATHNAME;
  } else {
    url = _.get(bodyData, 'pagination.nextPageHref');
  }

  const body = await getBody(getUrlFromPathname(url));
  const pageData = parsePageBody(body);
  if (_.get(pageData, 'listings.length')) {
    detailer.push(pageData.listings);
  }
  if (_.get(pageData, 'pagination.nextPageHref')) {
    await crawl(pageData);
  }
};

crawl()
  .catch(err => console.error(err));
