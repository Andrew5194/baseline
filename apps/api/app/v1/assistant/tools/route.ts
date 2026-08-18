import { proxyToPro } from '../../../../lib/pro-route';

// What the assistant can reach, from the Pro service's definitions rather than from
// anything the model says about itself.
export async function GET() {
  return proxyToPro('max_assistant', '/max/tools');
}
