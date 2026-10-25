import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'**/*.spec.ts',timeout:45000,expect:{timeout:7000},fullyParallel:false,workers:2,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:4322',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'firefox',testMatch:/journeys\.spec\.ts/,use:{...devices['Desktop Firefox']}}],
  webServer:[
    {command:'node --env-file-if-exists=.env dist/server/entry.mjs',cwd:'apps/web',url:'http://127.0.0.1:4322/api/health/',reuseExistingServer:false,env:{HOST:'127.0.0.1',PORT:'4322',CONTENT_MODE:'demo',SITE_ENV:'staging',MAIL_TRANSPORT:'simulation',CONTACT_RATE_LIMIT:'100',ASTRO_TELEMETRY_DISABLED:'1'}},
    {command:'node --env-file-if-exists=.env dist/server/entry.mjs',cwd:'apps/web',url:'http://127.0.0.1:4324/api/health/',reuseExistingServer:false,env:{HOST:'127.0.0.1',PORT:'4324',CONTENT_MODE:'sanity',SITE_ENV:'staging',PUBLIC_SANITY_PROJECT_ID:'',ASTRO_TELEMETRY_DISABLED:'1'}},
    {command:'node --env-file-if-exists=.env dist/server/entry.mjs',cwd:'apps/web',url:'http://127.0.0.1:4325/api/health/',reuseExistingServer:false,env:{HOST:'127.0.0.1',PORT:'4325',CONTENT_MODE:'demo',SITE_ENV:'staging',MAIL_TRANSPORT:'unavailable',CONTACT_RATE_LIMIT:'100',ASTRO_TELEMETRY_DISABLED:'1'}}
  ]
});
