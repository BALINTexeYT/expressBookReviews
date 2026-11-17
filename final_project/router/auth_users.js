const express = require('express');
const jwt = require('jsonwebtoken');
const books = require('./booksdb.js');
const regdUsers = express.Router();
const users = [];

const isValid = (username) => users.some((user) => user.username === username);
const authenticatedUser = (username, password) => users.some(
  (user) => user.username === username && user.password === password
);

regdUsers.post('/login', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });
  if (!authenticatedUser(username, password)) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  const { jwtSecret } = require('../index.js');
  const accessToken = jwt.sign({ username }, jwtSecret, { expiresIn: '1h' });
  req.session.authorization = { username, accessToken };
  return req.session.save((error) => {
    if (error) return res.status(500).json({ message: 'Unable to establish session.' });
    return res.json({ message: 'Login successful.', username, accessToken });
  });
});

regdUsers.put('/auth/review/:isbn', (req, res) => {
  const book = books[req.params.isbn];
  if (!book) return res.status(404).json({ message: 'Book not found.' });
  const review = typeof req.body?.review === 'string' ? req.body.review.trim() : '';
  if (!review) return res.status(400).json({ message: 'Review text is required.' });
  const username = req.user.username;
  book.reviews[username] = review;
  return res.json({ message: 'Review added or updated successfully.', isbn: req.params.isbn, username, review }