require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const { RateLimit } = require('async-sema');
const dayjs = require('dayjs');
const duration = require('dayjs/plugin/duration');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(duration);
dayjs.extend(relativeTime);

const { ORGANIZATION_ID, START_DATE, END_DATE, ACCESS_TOKEN } = process.env;

const axiosInstance = axios.create({
  baseURL: 'https://api.axept.io/v1',
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    'X-Requested-With': 'XMLHttpRequest'
  }
});

axiosRetry(axiosInstance, {
  retries: 10,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: e => axiosRetry.isNetworkOrIdempotentRequestError(e) || e.response.status === 429
});

const startDate = dayjs(START_DATE).startOf('day');
const endDate = dayjs(END_DATE).endOf('day');
const limit = RateLimit(100, { timeUnit: 60 * 1000, uniformDistribution: true }); // 100 requests per minute
const headers = ['projectId', 'token', 'collection', 'identifier', 'accept', 'date', 'value', 'preferences'];

const getConsents = async () => {
  const publishedProjectIds = await getPublishedProjectsIds();
  if (!publishedProjectIds.length) {
    console.log('No published projects found.');
    return;
  }
  console.log(`${publishedProjectIds.length} published projects found`);

  const csvFilePath = path.join(
    __dirname,
    'results',
    `organization_${ORGANIZATION_ID}_consents_from_${startDate.format('YYYY-MM-DD')}_to_${endDate.format('YYYY-MM-DD')}.csv`
  );
  if (fs.existsSync(csvFilePath)) {
    fs.unlinkSync(csvFilePath);
  }
  const csvWriteStream = fs.createWriteStream(csvFilePath, { flags: 'w' });
  csvWriteStream.write(headers.join(';') + '\n');

  const start = dayjs();
  for (const projectId of publishedProjectIds) {
    await getConsentsByProjectId(projectId, csvWriteStream);
  }
  csvWriteStream.end();
  console.log(`Consents written to ${csvFilePath} ${dayjs.duration(dayjs().diff(start)).humanize(true)}`);
};

const getPublishedProjectsIds = async () => {
  let lastPage = -1;
  let currentPage = 1;
  const publishedProjectIds = [];
  while (lastPage !== currentPage) {
    const projectsRequestResponse = await axiosInstance.get(
      `/vault/projects?data.organizationId=${ORGANIZATION_ID}&with=metadata&page=${currentPage}&perPage=100`
    );
    publishedProjectIds.push(
      ...projectsRequestResponse.data.map(project => (!project.metadata.lastPublishedAt ? null : project.id)).filter(Boolean)
    );
    lastPage = parseInt(projectsRequestResponse.headers['x-last-page']);
    currentPage = lastPage === currentPage ? currentPage : currentPage + 1;
  }
  return publishedProjectIds;
};

const getConsentsByProjectId = async (projectId, csvWriteStream) => {
  if (!projectId || !csvWriteStream) {
    throw new Error('projectId and csvWriteStream are required');
  }
  let lastPage = -1;
  let currentPage = 1;
  while (lastPage !== currentPage) {
    await limit();
    console.log(`Fetching consents for project ${projectId} page ${currentPage}/${lastPage === -1 ? '?' : lastPage}...`);
    const consentsRequestResponse = await axiosInstance.get(
      `/app/consents/${projectId}?sort=-createdAt&page=${currentPage}&start=${startDate.toISOString()}&end=${endDate.toISOString()}`
    );
    if (consentsRequestResponse.data.length) {
      consentsRequestResponse.data.forEach(consent => csvWriteStream.write(consentToCsvString(consent) + '\n'));
    }
    lastPage = parseInt(consentsRequestResponse.headers['x-last-page']);
    currentPage = lastPage === currentPage ? currentPage : currentPage + 1;
  }
};

const consentToCsvString = consent => {
  if (!consent || typeof consent !== 'object') {
    throw new Error('consent is required and must be an object');
  }
  return headers
    .map(header => {
      let value = consent[header];
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      } else if (header === 'date') {
        value = consent.createdAt;
      } else if (typeof value === 'boolean') {
        value = value ? 1 : 0;
      } else if (header === 'value') {
        value = String(value);
      }
      value = typeof value === 'string' ? String(value).replaceAll(/;/g, ',') : value;
      return value;
    })
    .join(';');
};

getConsents()
  .then(() => console.log('done'))
  .catch(err => {
    console.error(err);
    throw err;
  });
