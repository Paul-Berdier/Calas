import { resourceMetadata } from '../../server/agent/oauth';
import { oauthResponse } from '../../server/agent/oauth-http';
export const GET = () => oauthResponse(resourceMetadata());
