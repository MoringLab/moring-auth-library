import { withMoringAuth } from '@moring-auth/nextjs/middleware';

export default withMoringAuth({
  publicPaths: ['/'],
  redirectTo: '/',
});
