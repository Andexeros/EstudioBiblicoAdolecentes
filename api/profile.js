import { nodeHandler } from '../server/http.js';
import { profileEndpoint } from '../server/api.js';
export default nodeHandler(profileEndpoint);
