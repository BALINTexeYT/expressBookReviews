const express = require('express');
const axios = require('axios');
const books = require('./booksdb.js');
const { isValid, users } = require('./auth_users.js');

const publicUsers = express.Router();
const dataService = express();
let dataServiceServer;
let dataServiceUrl;
let dataServiceReady;

dataService.get('/books', (req, res) => {
  const { isbn, author, title } = req.query;
  let results = Object.entries(books);
  if (isbn !== undefined) results = results.filter(([id]) => id === isbn);
  if (author !== undefined) {
    const normalizedAuthor = author.trim().toLocaleLowerCase();
    results = results.filter(([, book]) => book.author.toLocaleLowerCase() === normalizedAuthor);
  }
  if (title !== undefined) {
    const normalizedTitle = title.trim().toLocaleLowerCase();
    results = results.filter(([, book]) => book.title.toLocaleLowerCase().includes(normalizedTitle));
  }
  res.json(Object.fromEntries(results));
});

function startBookDataService() {
  if (dataServiceReady) return dataServiceReady;
  dataServiceReady = new Promise((resolve, reject) => {
    dataServiceServer = dataService.listen(0, '127.0.0.1', () => {
      const address = dataServiceServer.address();
      dataServiceUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
    dataServiceServer.once('error', reject);
  });
  return dataServiceReady;
}

function stopBookDataService() {
  if (!dataServiceServer) return Promise.resolve();
  const server = dataServiceServer;
  dataServiceServer = undefined;
  dataServiceReady = undefined;
  dataServiceUrl = undefined;
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function getBooks(params = {}) {
  await startBookDataService();
  const response = await axios.get(`${dataServiceUrl}/books`, { params, timeout: 3000 });
  return response.data;
}

function badRequest(res, message) {
  return res.status(400).json({ message });
}

publicUsers.post('/register', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password.trim()) return badRequest(res, 'Username and password are required.');
  if (isValid(username)) return res.status(409).json({ message: 'Username already exists.' });

  users.push({ username, password });
  return res.status(201).json({ message: 'User registered successfully.' });
});

publicUsers.get('/', async (req, res, next) => {
  try {
    return res.json(await getBooks());
  } catch (error) {
    return next(error);
  }
});

publicUsers.get('/isbn/:isbn', async (req, res, next) => {
  try {
    const result = await getBooks({ isbn: req.params.isbn.trim() });
    if (Object.keys(result).length === 0) return res.status(404).json({ message: 'Book not found.' });
    return res.json(result[req.params.isbn.trim()]);
  } catch (error) {
    return next(error);
  }
});

publicUsers.get('/author/:author', async (req, res, next) => {
  try {
    const author = req.params.author.trim();
    if (!author) return badRequest(res, 'Author is required.');
    const result = await getBooks({ author });
    return Object.keys(result).length ? res.json(result) : res.status(404).json({ message: 'No books found for this author.' });
  } catch (error) {
    return next(error);
  }
});

publicUsers.get('/title/:title', async (req, res, next) => {
  try {
    const title = req.params.title.trim();
    if (!title) return badRequest(res, 'Title is required.');
    const result = await getBooks({ title });
    return Object.keys(result).length ? res.json(result) : res.status(404).json({ message: 'No books found with this title.' });
  } catch (error) {
    return next(error);
  }
});

publicUsers.get('/review/:isbn', (req, res) => {
  const book = books[req.params.isbn];
  if (!book) return res.status(404).json({ message: 'Book not found.' });
  if (Object.keys(book.reviews).length === 0) return res.json({ message: 'No reviews found for this book.' });
  return res.json(book.reviews);
});

module.exports = { general: publicUsers, startBookDataService, stopBookDataService };
