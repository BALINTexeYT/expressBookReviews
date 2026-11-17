const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const customerRoutes = require('./router/auth_users.js').authenticated;
const generalRoutes = require('./router/general.js').general;
const { startBookDataService } = require('./router/general.js');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/customer', session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));

app.use('/customer/auth/*', (req, res, next) => {
  const authorization = req.session.authorization;
  if (!authorization || !authorization.accessToken || !authorization.username) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const headerToken = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (headerToken && headerToken !== authorization.accessToken) {
    return res.status(401).json({ message: 'Invalid access token.' });
  }

  try {
    const decoded = jwt.verify(authorization.accessToken, jwtSecret);
    if (decoded.username !== authorization.username) {
      return res.status(401).json({ message: 'Invalid access token.' });
    }
    req.user = { username: decoded.username };
    next();
  } catch (_error) {
    return res.status(401).json({ message: 'Invalid or expired access token.' });
  }
});

app.use('/customer', customerRoutes);
app.use('/', generalRoutes);

app.use((err, req, res, next) => {
  