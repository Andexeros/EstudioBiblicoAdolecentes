import { nodeHandler } from '../server/http.js';
import { preferencesEndpoint } from '../server/api.js';
export default nodeHandler(preferencesEndpoint);
