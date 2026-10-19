import { nodeHandler } from '../server/http.js';
import { lessonsEndpoint } from '../server/api.js';
export default nodeHandler(lessonsEndpoint);
