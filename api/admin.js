import { nodeHandler } from '../server/http.js';
import { adminEndpoint } from '../server/api.js';
export default nodeHandler(adminEndpoint);
