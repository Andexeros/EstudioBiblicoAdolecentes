import { nodeHandler } from '../../server/http.js';
import { authProxy } from '../../server/auth.js';
export default nodeHandler(authProxy);
