const express = require('express');
const { createMoringAuth } = require('@moring-auth/core');
const { requireMoringAuth } = require('@moring-auth/express');

const app = express();

// Pre-fill environment variables for demo purposes
process.env.MORING_ISSUER = 'https://sso.moring.co';
process.env.MORING_CLIENT_ID = 'demo-client-id';
process.env.MORING_CLIENT_SECRET = 'demo-client-secret';
process.env.MORING_REDIRECT_URI = 'http://localhost:3001/auth/callback';

const auth = createMoringAuth();

// OAuth Login Route
app.get('/login', async (req, res) => {
  try {
    const { url } = await auth.getLoginUrl();
    res.redirect(url);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// OAuth Callback Route
app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');
  
  try {
    const tokens = await auth.handleCallback(code);
    res.cookie('moring_session', tokens.id_token, { httpOnly: true });
    res.redirect('/secure');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Secured Route using express adapter middleware
app.get('/secure', requireMoringAuth(), (req, res) => {
  res.json({
    message: 'Hello from secure endpoint!',
    user: req.user
  });
});

app.listen(3001, () => {
  console.log('Express demo app running on http://localhost:3001');
});
