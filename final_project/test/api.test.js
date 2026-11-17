const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { app } = require('../index.js');
const { startBookDataService, stopBookDataService } = require('../router/general.js');

let server;
let baseUrl;

before(async () => {
  await startBookDataService();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await stopBookDataService();
});

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: await response.json() };
}

function postBody(data, cookie) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(data)
  };
}

test('book search and session review ownership work end to end', async () => {
  const allBooks = await jsonRequest('/');
  assert.equal(allBooks.response.status, 200);
  assert.equal(Object.keys(allBooks.body).length, 10);

  const title = await jsonRequest('/title/Divine%20Comedy');
  assert.equal(title.body['3'].author, 'Dante Alighieri');
  const missingBook = await jsonRequest('/isbn/unknown');
  assert.equal(missingBook.response.status, 404);

  const userA = `test-user-a-${Date.now()}`;
  const userB = `test-user-b-${Date.now()}`;
  const missingCredentials = await jsonRequest('/register', postBody({}));
  assert.equal(missingCredentials.response.status, 400);
  for (const username of [userA, userB]) {
    const registered = await jsonRequest('/register', postBody({ username, password: 'test-password' }));
    assert.equal(registered.response.status, 201);
  }
  const duplicate = await jsonRequest('/register', postBody({ username: userA, password: 'another-password' }));
  assert.equal(duplicate.response.status, 409);

  const anonymous = await jsonRequest('/customer/auth/review/1', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ review: 'blocked' })
  });
  assert.equal(anonymous.response.status, 401);

  async function login(username) {
    const response = await fetch(`${baseUrl}/customer/login`, postBody({ username, password: 'test-password' }));
    const result = await response.json();
    assert.equal(response.status, 200);
    return { cookie: response.headers.get('set-cookie').split(';')[0], ...result };
  }

  const sessionA = await login(userA);
  const sessionB = await login(userB);
  for (const [sessionInfo, review] of [[sessionA, 'A review'], [sessionB, 'B review']]) {
    const added = await jsonReque