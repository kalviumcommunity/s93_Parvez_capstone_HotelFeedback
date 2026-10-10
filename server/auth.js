const { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } = require('crypto');
const { promisify } = require('util');
const Session = require('./models/Session');

const scryptAsync = promisify(scrypt);
const PASSWORD_HASH_BYTES = 64;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const JWT_ISSUER = 'hotel-feedback';

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, PASSWORD_HASH_BYTES);
  return `scrypt$${salt.toString('hex')}$${Buffer.from(derivedKey).toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, saltHex, hashHex, extra] = storedHash.split('$');
  if (
    algorithm !== 'scrypt' ||
    extra !== undefined ||
    !/^[a-f\d]{32}$/i.test(saltHex) ||
    !/^[a-f\d]{128}$/i.test(hashHex)
  ) {
    return false;
  }

  const expected = Buffer.from(hashHex, 'hex');
  const actual = Buffer.from(await scryptAsync(password, Buffer.from(saltHex, 'hex'), PASSWORD_HASH_BYTES));
  return timingSafeEqual(actual, expected);
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 bytes');
  }
  return secret;
}

function signSessionToken(userId) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SESSION_TTL_SECONDS;
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: String(userId),
    iss: JWT_ISSUER,
    iat: issuedAt,
    exp: expiresAt,
  })).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const signature = createHmac('sha256', getJwtSecret()).update(signingInput).digest('base64url');

  return {
    token: `${signingInput}.${signature}`,
    expiresAt: new Date(expiresAt * 1000),
  };
}

function verifySessionToken(token) {
  const segments = token.split('.');
  if (segments.length !== 3 || segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) {
    throw new Error('Invalid JWT');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Invalid JWT algorithm');
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac('sha256', getJwtSecret()).update(signingInput).digest();
  const actualSignature = Buffer.from(encodedSignature, 'base64url');
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    throw new Error('Invalid JWT signature');
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    payload.iss !== JWT_ISSUER ||
    typeof payload.sub !== 'string' ||
    !Number.isSafeInteger(payload.iat) ||
    payload.iat > now + 60 ||
    !Number.isSafeInteger(payload.exp) ||
    payload.exp <= now
  ) {
    throw new Error('Invalid or expired JWT');
  }

  return payload;
}

async function createSession(userId) {
  const { token, expiresAt } = signSessionToken(userId);
  await Session.create({ userId, tokenHash: hashSessionToken(token), expiresAt });
  return { token, expiresAt };
}

async function authenticate(req, res, next) {
  const [scheme, token, extra] = (req.get('Authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token || extra !== undefined) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  let claims;
  try {
    claims = verifySessionToken(token);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Session is invalid or expired' });
  }

  try {
    const tokenHash = hashSessionToken(token);
    const session = await Session.findOne({
      tokenHash,
      userId: claims.sub,
      expiresAt: { $gt: new Date() },
    })
      .populate('userId', 'username');
    if (!session?.userId) {
      return res.status(401).json({ success: false, message: 'Session is invalid or expired' });
    }

    req.auth = {
      userId: session.userId._id,
      username: session.userId.username,
      tokenHash,
    };
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate, createSession, hashPassword, hashSessionToken, verifyPassword };