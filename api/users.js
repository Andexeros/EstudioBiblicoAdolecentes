import { nodeHandler } from '../server/http.js';
import { usersEndpoint } from '../server/api.js';
export default nodeHandler(usersEndpoint);
