import { nodeHandler } from '../server/http.js';
import { authReturn } from '../server/auth.js';
export default nodeHandler(authReturn);
