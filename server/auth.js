const { createHash, randomBytes, scrypt, timingSafeEqual } = require('crypto');
const { promisify } = require('util');
const Session = require('./models/Session');

const scryptAsync = promisify(scrypt);
const PASSWORD_HASH_BYTES = 64;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

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

async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await Session.create({ userId, tokenHash: hashSessionToken(token), expiresAt });
  return { token, expiresAt };
}

async function authenticate(req, res, next) {
  const [scheme, token, extra] = (req.get('Authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token || extra !== undefined) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const tokenHash = hashSessionToken(token);
    const session = await Session.findOne({ tokenHash, expiresAt: { $gt: new Date() } })
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