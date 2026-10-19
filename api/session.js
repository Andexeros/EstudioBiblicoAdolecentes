import { nodeHandler } from '../server/http.js';
import { sessionEndpoint } from '../server/api.js';
export default nodeHandler(sessionEndpoint);
